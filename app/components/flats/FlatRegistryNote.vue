<script setup lang="ts">
// A note under the contact buttons when the listing's contact is in the realtor registry. It speaks about the
// listing's contact, never about a person, and links the public sources the classification rests on.
import { registrySignalOf, registrySourcesOf, registryText } from "~/utils/flats/registrySignal";

const props = defineProps<{ signal: unknown; sources?: unknown }>();

const { locale } = useI18n();
const kind = computed(() => registrySignalOf(props.signal));
const text = computed(() => registryText(locale.value));
const links = computed(() => registrySourcesOf(props.sources));
</script>

<template>
  <aside v-if="kind" class="flat-registry" :class="`flat-registry_${kind}`" role="note">
    <p class="flat-registry__text">{{ text[kind] }}</p>
    <p v-if="links.length" class="flat-registry__sources">
      <span>{{ text.sources }}</span>
      <a v-for="link in links" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer nofollow">{{ link.host }}</a>
    </p>
    <p class="flat-registry__caveat">{{ text.caveat }}</p>
  </aside>
</template>

<style scoped>
.flat-registry { margin: 10px 0; padding: 10px 12px; border: 1px solid var(--line); border-left-width: 3px; border-radius: 8px; background: rgba(255,255,255,.03); font-size: 12.5px; line-height: 1.4; }
.flat-registry_hidden_agent { border-left-color: #f2b86b; }
.flat-registry_flagged { border-left-color: #f87171; }
.flat-registry_trusted { border-left-color: #4ade80; }
.flat-registry__text { margin: 0; color: var(--text-primary); }
.flat-registry__sources { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 4px 10px; }
.flat-registry__sources a { color: var(--accent-pink); text-decoration: underline; overflow-wrap: anywhere; }
.flat-registry__caveat { margin: 6px 0 0; opacity: .7; font-size: 11.5px; }
</style>
