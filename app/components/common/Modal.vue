<script setup lang="ts">
const open = defineModel<boolean>('open', {default: false})

const props = defineProps<{
  maxWidthClass?: string
}>()
</script>

<template>
  <UModal
      v-model:open="open"
      :ui="{
      body: props.maxWidthClass || 'sm:max-w-2xl'
    }"
  >
    <template #content="{ close }">
      <UCard
          class="app-modal"
          :ui="{ root: 'ring-0 bg-transparent' }"
      >
        <div class="app-modal__inner">
          <div class="app-modal__header">
            <div class="app-modal__title">
              <slot name="title"/>
            </div>

            <button type="button" class="app-modal__close" @click="close()" aria-label="Close">
              <UIcon name="i-lucide-x"/>
            </button>
          </div>

          <div class="app-modal__body">
            <slot/>
          </div>

          <div class="app-modal__actions">
            <slot name="actions" :close="close"/>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<style scoped lang="scss">
.app-modal {
  border-radius: 20px;
  border: 1px solid var(--ui-border);
  background: rgba(14, 12, 21, 0.92);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.app-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.app-modal__title {
  font-weight: 900;
  font-size: 16px;
  line-height: 1.2;
}

.app-modal__close {
  height: 36px;
  width: 36px;
  border-radius: 12px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease;
}

.app-modal__close:hover {
  filter: brightness(1.06);
}

.app-modal__close:active {
  transform: translateY(1px);
}

.app-modal__actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.app-modal__close {
  height: 36px;
  width: 36px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.18);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease;
}

.app-modal__close:hover {
  filter: brightness(1.06);
}

</style>
