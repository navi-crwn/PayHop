<script lang="ts">
  /* Stroke icons from the sprite in index.html's body (see App.svelte). */
  let { name }: { name: string } = $props();
</script>

<svg class="ico" aria-hidden="true"><use href={'#i-' + name} /></svg>
