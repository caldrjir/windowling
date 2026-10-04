<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	interface Props {
		user: { name: string; isAnonymous: boolean } | null;
		googleEnabled: boolean;
	}

	let { user, googleEnabled }: Props = $props();
	let busy = $state(false);

	async function continueWithGoogle() {
		busy = true;
		// With an anonymous session active, Better Auth links the new account
		// and our onLinkAccount hook moves the existing world over.
		const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
		if (error) {
			console.error(error);
			busy = false;
		}
	}

	async function signOut() {
		busy = true;
		await authClient.signOut();
		await invalidateAll();
		busy = false;
	}
</script>

{#if user && !user.isAnonymous}
	<div class="flex items-center gap-3 text-sm">
		<span class="text-white/70">{user.name}</span>
		<button
			class="rounded-full bg-white/10 px-3 py-1.5 backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
			onclick={signOut}
			disabled={busy}>Sign out</button
		>
	</div>
{:else if user && googleEnabled}
	<button
		class="rounded-full bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
		onclick={continueWithGoogle}
		disabled={busy}
	>
		Keep this world · Sign in with Google
	</button>
{/if}
