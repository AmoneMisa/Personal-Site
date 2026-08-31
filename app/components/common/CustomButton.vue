<script setup lang="ts">
type LegacyType = 'default' | 'white' | 'black' | 'gradient-white' | 'figure' | 'link' | 'full';

type Variant = 'primary' | 'secondary' | 'ghost' | 'full';

const props = defineProps<{
  buttonType?: LegacyType
  variant?: Variant
  _class?: string
}>();

const resolved = computed<Variant>(() => {
  if (props.variant) return props.variant;

  if (props.buttonType === 'white') return 'secondary';
  if (props.buttonType === 'link') return 'ghost';
  if (props.buttonType === 'gradient-white') return 'primary';
  return 'primary';
});

const buttonClass = computed(() => ({
  primary: 'btn_black',
  full: 'btn_primary',
  secondary: 'btn_secondary',
  ghost: 'btn_ghost',
}[resolved.value]));

const uiVariant = computed(() => resolved.value === 'ghost' ? 'ghost' : 'solid');
</script>

<template>
  <u-button
      :class="['btn', buttonClass, _class]"
      :variant="uiVariant"
  >
    <slot/>
  </u-button>
</template>

<style scoped lang="scss">
/* Flat buttons, synced with the home design system: solid pink primary, 1px
   line secondary, no glows/gradients/backdrop-blur. */
.btn {
  height: 46px;
  padding: 0 20px;
  border-radius: 8px;
  font-weight: 600;
  letter-spacing: 0.2px;
  transition: 0.2s ease;
}

:global(.btn_primary) {
  color: #1a0e14 !important;
  border: 1px solid transparent;
  background: var(--accent-pink);
}

.btn_primary:hover {
  filter: brightness(1.06);
}

.btn_black {
  color: var(--text-primary) !important;
  border: 1px solid var(--line);
  background: var(--bg-panel);
}

.btn_black:hover {
  border-color: var(--accent-pink);
}

.btn_secondary {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
}

.btn_secondary:hover {
  border-color: var(--accent-pink);
}

.btn_ghost {
  color: var(--text-primary);
  padding: 0;
  height: auto;
  border-radius: 8px;
}

.btn_ghost:hover {
  color: var(--accent-pink);
}

.btn_link {
  color: var(--accent-pink);
  padding: 0 !important;
}
</style>
