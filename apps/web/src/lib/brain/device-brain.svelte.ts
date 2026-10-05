import type { ChatMessage, ChatModel, CompletionOptions } from '@windowling/ai';
import type { AppConfig, InitProgressReport, WebWorkerMLCEngine } from '@mlc-ai/web-llm';

/**
 * The character's brain running on this device (WebLLM over WebGPU). Weights
 * (~0.7 GB) come from the Hugging Face Hub once, after the player agrees, and
 * stay in the browser cache; the compiled kernels are served by us.
 */
export type DeviceBrainStatus =
	| 'checking'
	| 'unsupported'
	| 'absent'
	/** Downloaded earlier, not loaded into the GPU yet (happens on first use). */
	| 'downloaded'
	| 'downloading'
	| 'loading'
	| 'ready'
	| 'error';

export const DEVICE_MODEL_DOWNLOAD_GB = 0.7;

/** Just the part of WebGPU we need (avoids pulling in the full WebGPU typings). */
interface MinimalGpu {
	requestAdapter(): Promise<{ features: ReadonlySet<string> } | null>;
}

interface Variant {
	id: string;
	lib: string;
	vram: number;
}

// Llama 3.2 1B: the smallest model that still holds a conversation and follows the JSON schema.
const F16: Variant = {
	id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
	lib: 'Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm',
	vram: 879,
};
const F32: Variant = {
	id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
	lib: 'Llama-3.2-1B-Instruct-q4f32_1_cs1k-webgpu.wasm',
	vram: 1129,
};

function appConfig(variant: Variant): AppConfig {
	return {
		cacheBackend: 'cache',
		model_list: [
			{
				model: `https://huggingface.co/mlc-ai/${variant.id}`,
				model_id: variant.id,
				model_lib: new URL(`/webllm/${variant.lib}`, location.href).href,
				vram_required_MB: variant.vram,
				low_resource_required: true,
				overrides: { context_window_size: 2048 },
			},
		],
	};
}

class DeviceBrain implements ChatModel {
	status = $state<DeviceBrainStatus>('checking');
	/** 0..100 while downloading or loading. */
	progress = $state(0);
	private variant: Variant = F16;
	private engine: Promise<WebWorkerMLCEngine> | undefined;
	private detected: Promise<void> | undefined;

	/** Finds out whether this device can run it and whether it is already downloaded. */
	detect(): Promise<void> {
		this.detected ??= (async () => {
			try {
				const gpu = (navigator as Navigator & { gpu?: MinimalGpu }).gpu;
				const adapter = await gpu?.requestAdapter();
				if (!adapter) {
					this.status = 'unsupported';
					return;
				}
				this.variant = adapter.features.has('shader-f16') ? F16 : F32;
				const { hasModelInCache } = await import('@mlc-ai/web-llm');
				const cached = await hasModelInCache(this.variant.id, appConfig(this.variant));
				this.status = cached ? 'downloaded' : 'absent';
			} catch (error) {
				console.warn('On-device brain unavailable', error);
				this.status = 'unsupported';
			}
		})();
		return this.detected;
	}

	/** Only ever called after the player agreed to the download. */
	download(): Promise<WebWorkerMLCEngine> {
		this.status = 'downloading';
		return this.load();
	}

	get usable(): boolean {
		return this.status === 'ready' || this.status === 'downloaded' || this.status === 'loading';
	}

	/** Loads a downloaded model into the GPU ahead of need (the character is coming over). */
	warmUp(): void {
		if (this.status !== 'downloaded') return;
		this.status = 'loading';
		this.load().catch(() => {});
	}

	private load(): Promise<WebWorkerMLCEngine> {
		this.engine ??= (async () => {
			const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
			const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
			try {
				const engine = await CreateWebWorkerMLCEngine(worker, this.variant.id, {
					appConfig: appConfig(this.variant),
					initProgressCallback: (report: InitProgressReport) => {
						this.progress = Math.round(report.progress * 100);
					},
				});
				this.status = 'ready';
				return engine;
			} catch (error) {
				worker.terminate();
				this.engine = undefined;
				this.status = 'error';
				throw error;
			}
		})();
		return this.engine;
	}

	async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
		this.warmUp();
		if (!this.engine) throw new Error('on-device brain is not available');
		const engine = await this.engine;
		const reply = await engine.chat.completions.create({
			messages,
			max_tokens: options.maxTokens,
			temperature: options.temperature,
			...(options.jsonSchema
				? { response_format: { type: 'json_object', schema: JSON.stringify(options.jsonSchema) } }
				: {}),
		});
		const content = reply.choices[0]?.message.content;
		if (!content) throw new Error('on-device brain returned nothing');
		return content;
	}
}

export const deviceBrain = new DeviceBrain();
