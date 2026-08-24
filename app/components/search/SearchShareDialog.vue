<script setup lang="ts">
defineProps<{
  title: string;
  hint: string;
  url: string;
  copyLabel: string;
  copied?: boolean;
  copiedLabel?: string;
}>();
const open = defineModel<boolean>("open", { required: true });
defineEmits<{ copy: [] }>();
</script>

<template>
  <u-modal v-model:open="open" :title="title">
    <template #body>
      <p class="search-share-dialog__hint">{{ hint }}</p>
      <u-input :model-value="url" readonly />
    </template>
    <template #footer>
      <u-button :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="$emit('copy')">
        {{ copied ? copiedLabel || copyLabel : copyLabel }}
      </u-button>
    </template>
  </u-modal>
</template>

<style scoped>
.search-share-dialog__hint { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
</style>
