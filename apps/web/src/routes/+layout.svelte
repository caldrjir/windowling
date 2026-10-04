<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Windowling</title>
</svelte:head>

{@render children()}
