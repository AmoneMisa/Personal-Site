<script setup lang="ts">
const open = defineModel<boolean>('open', {default: false})

const props = defineProps<{
  maxWidthClass?: string
}>()

function closeModal() {
  open.value = false
}
</script>

<template>
  <UModal
      v-model:open="open"
      :ui="{
        content: props.maxWidthClass || 'sm:max-w-2xl'
      }"
  >
    <template #content>
      <UCard
          class="app-modal"
          :ui="{ root: 'ring-0 bg-transparent' }"
      >
        <div class="app-modal__inner">
          <div class="app-modal__header">
            <div class="app-modal__title">
              <slot name="title"/>
            </div>

            <button type="button" class="app-modal__close" @click="closeModal" :aria-label="$t('common.close')">
              <UIcon name="i-lucide-x"/>
            </button>
          </div>

          <div class="app-modal__body">
            <slot/>
          </div>

          <div class="app-modal__actions">
            <slot name="actions" :close="closeModal"/>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<style scoped lang="scss">
.app-modal {
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--color-border, var(--ui-border));
  background: rgba(14, 16, 39, 0.98);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.app-modal__inner {
  padding: 22px 24px 24px;
}

.app-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--color-border, var(--ui-border));
}

.app-modal__title {
  min-width: 0;
  font-weight: 800;
  font-size: 20px;
  line-height: 1.25;
}

.app-modal__body {
  min-width: 0;
}

/* Dialog forms share the same 44px control metric as service toolbars. Modals
 * are teleported to <body>, so they cannot inherit the service-page rule. */

.app-modal :deep(.btn),
.app-modal :deep(.u-button) {
  height: var(--ui-control-h-lg, 44px);
}

.app-modal__actions {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border, var(--ui-border));
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.app-modal__close {
  flex: 0 0 auto;
  height: 36px;
  width: 36px;
  border-radius: 10px;
  border: 1px solid var(--color-border, var(--ui-border));
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.78);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 140ms ease;
}

.app-modal__close:hover {
  color: #fff;
  border-color: rgba(224, 103, 154, 0.55);
  background: rgba(224, 103, 154, 0.12);
}

.app-modal__close:active {
  transform: translateY(1px);
}

@media (max-width: 639px) {
  .app-modal__inner {
    padding: 18px;
  }

  .app-modal__title {
    font-size: 18px;
  }

  .app-modal__actions :deep(button) {
    flex: 1 1 140px;
  }
}
</style>
