/**
 * The smallest interface a language model needs to implement to become the
 * character's brain. Backends: an OpenAI-compatible HTTP API (Workers AI,
 * Ollama, any self-hosted server) and, in the browser, WebLLM.
 */
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface CompletionOptions {
	/** JSON Schema the answer must follow, for backends that support constrained output. */
	jsonSchema?: Record<string, unknown>;
	maxTokens: number;
	temperature: number;
	signal?: AbortSignal;
}

export interface ChatModel {
	complete(messages: ChatMessage[], options: CompletionOptions): Promise<string>;
}

export interface OpenAICompatibleOptions {
	/** Base URL up to and including `/v1`, e.g. http://localhost:11434/v1 for Ollama. */
	baseUrl: string;
	model: string;
	apiKey?: string;
	timeoutMs?: number;
	/** Injected for tests and runtimes with a custom fetch. */
	fetch?: typeof fetch;
}

/** Plain `POST /chat/completions` - no SDK, works in Workers, browsers and Node. */
export class OpenAICompatibleChatModel implements ChatModel {
	constructor(private readonly options: OpenAICompatibleOptions) {}

	async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
		const doFetch = this.options.fetch ?? fetch;
		const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 20_000);
		const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
		const response = await doFetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
			},
			body: JSON.stringify({
				model: this.options.model,
				messages,
				max_tokens: options.maxTokens,
				temperature: options.temperature,
				...(options.jsonSchema
					? {
							response_format: {
								type: 'json_schema',
								json_schema: { name: 'decision', schema: options.jsonSchema },
							},
						}
					: {}),
			}),
			signal,
		});
		if (!response.ok) {
			throw new Error(`chat completion failed with HTTP ${response.status}`);
		}
		const body = (await response.json()) as {
			choices?: Array<{ message?: { content?: unknown } }>;
		};
		const content = body.choices?.[0]?.message?.content;
		// Some backends already return the parsed object in JSON mode.
		if (content && typeof content === 'object') return JSON.stringify(content);
		if (typeof content !== 'string') throw new Error('chat completion returned no content');
		return content;
	}
}
