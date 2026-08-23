<script setup lang="ts">
const route = useRoute()
const { locale } = useI18n()

const available = ref(false)
const busy = ref(false)
const failed = ref(false)
const editToken = ref('')
const editPath = ref('')
const showBackToFilters = ref(false)

const searchKind = computed(() => {
  const path = route.path.replace(/^\/(?:ru|en|kk)(?=\/)/, '')
  if (path === '/flat-finder') return 'flats'
  if (path === '/jobs') return 'jobs'
  if (path === '/hiring') return 'candidates'
  return null
})

const normalizedPath = computed(() => route.path.replace(/^\/(?:ru|en|kk)(?=\/)/, ''))
const canScrollToFilters = computed(() => normalizedPath.value === '/flat-finder')

watch(
  () => [route.path, route.query._tgEdit] as const,
  ([path, rawToken], previous) => {
    if (typeof rawToken === 'string' && rawToken) {
      editToken.value = rawToken
      editPath.value = path
      return
    }
    const previousPath = previous?.[0]
    if (previousPath && path !== previousPath && path !== editPath.value) {
      editToken.value = ''
      editPath.value = ''
    }
  },
  { immediate: true },
)

function filtersElement(): HTMLElement | null {
  if (!import.meta.client || !canScrollToFilters.value) return null
  return document.querySelector<HTMLElement>('.flats__controls_redesign')
}

function updateBackToFilters() {
  if (!import.meta.client || !canScrollToFilters.value) {
    showBackToFilters.value = false
    return
  }
  const filters = filtersElement()
  showBackToFilters.value = !!filters && filters.getBoundingClientRect().bottom < 88
}

function scrollToFilters() {
  const filters = filtersElement()
  if (!filters) return
  filters.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  window.addEventListener('scroll', updateBackToFilters, { passive: true })
  window.addEventListener('resize', updateBackToFilters, { passive: true })
  updateBackToFilters()

  try {
    const status = await $fetch<{ enabled: boolean }>('/subscription-status')
    available.value = status.enabled === true
  } catch {
    available.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateBackToFilters)
  window.removeEventListener('resize', updateBackToFilters)
})

watch(
  () => route.path,
  () => nextTick(updateBackToFilters),
)

const editing = computed(() => !!editToken.value && editPath.value === route.path)
const isEnglish = computed(() => String(locale.value).toLowerCase().startsWith('en'))
const label = computed(() => {
  if (busy.value) return isEnglish.value ? 'Opening Telegram…' : 'Открываю Telegram…'
  if (editing.value) return isEnglish.value ? 'Update subscription' : 'Обновить подписку'
  return isEnglish.value ? 'Subscribe to updates' : 'Подписаться на обновления'
})
const backLabel = computed(() => isEnglish.value ? 'Top' : 'Наверх')
const errorText = computed(() => isEnglish.value
  ? 'Could not create the Telegram subscription link.'
  : 'Не удалось создать ссылку подписки в Telegram.')
const showStack = computed(() => showBackToFilters.value || (!!searchKind.value && available.value))

async function subscribe() {
  if (!searchKind.value || busy.value) return
  busy.value = true
  failed.value = false
  try {
    const searchUrl = new URL(window.location.href)
    if (editing.value) searchUrl.searchParams.set('_tgEdit', editToken.value)
    else searchUrl.searchParams.delete('_tgEdit')

    const data = await $fetch<{ url: string }>('/subscription-link', {
      method: 'POST',
      body: { searchUrl: searchUrl.toString() },
    })
    window.location.assign(data.url)
  } catch (error) {
    console.warn('[telegram-subscription] handoff failed:', error)
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="showStack" class="search-actions">
    <p v-if="failed" class="search-actions__error">{{ errorText }}</p>

    <div class="search-actions__stack">
      <button
        v-if="showBackToFilters"
        type="button"
        class="search-action"
        :aria-label="backLabel"
        :title="backLabel"
        @click="scrollToFilters"
      >
        <u-icon name="i-lucide-arrow-up" class="search-action__icon" aria-hidden="true" />
        <span class="search-action__label">{{ backLabel }}</span>
      </button>

      <button
        v-if="searchKind && available"
        type="button"
        class="search-action search-action_subscription"
        :class="{ 'search-action_busy': busy }"
        :aria-label="label"
        :title="label"
        :disabled="busy"
        @click="subscribe"
      >
        <u-icon
          :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-bell-plus'"
          class="search-action__icon"
          :class="{ 'search-action__icon_spin': busy }"
          aria-hidden="true"
        />
        <span class="search-action__label">{{ label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
:global(.flats__back-top) {
  display: none !important;
}

.search-actions {
  position: fixed;
  right: max(18px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 4000;
  display: flex;
  max-width: calc(100vw - 36px);
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.search-actions__stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: auto;
}

.search-action {
  width: auto;
  min-width: 44px;
  height: 44px;
  padding: 0 11px;
  display: inline-flex;
  flex-direction: row-reverse;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
  overflow: hidden;
  border: 1px solid rgba(113, 137, 217, .28);
  border-radius: 999px;
  background: rgba(16, 20, 48, .96);
  color: var(--text-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .24);
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.search-action:hover,
.search-action:focus-visible {
  color: var(--text-white, #fff);
  border-color: rgba(224, 103, 154, .58);
  background: rgba(26, 27, 58, .98);
  box-shadow: 0 10px 28px rgba(0, 0, 0, .3);
  outline: none;
}

.search-action_subscription .search-action__icon {
  color: var(--accent-pink);
}

.search-action:disabled {
  cursor: wait;
  opacity: .78;
}

.search-action__icon {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.search-action__label {
  display: block;
  max-width: 0;
  margin-right: 0;
  overflow: hidden;
  opacity: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  transition:
    max-width 180ms ease,
    margin-right 180ms ease,
    opacity 120ms ease;
}

.search-action:focus-visible .search-action__label {
  max-width: 220px;
  margin-right: 9px;
  opacity: 1;
}

.search-action__icon_spin {
  animation: search-action-spin .75s linear infinite;
}

.search-actions__error {
  margin: 0;
  max-width: min(340px, calc(100vw - 36px));
  padding: 8px 10px;
  border: 1px solid rgba(239, 68, 68, .35);
  border-radius: 10px;
  background: rgba(15, 23, 42, .96);
  color: #fecaca;
  font-size: 12px;
  line-height: 1.35;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .28);
  pointer-events: auto;
}

@media (hover: hover) and (pointer: fine) {
  .search-action:hover .search-action__label {
    max-width: 220px;
    margin-right: 9px;
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .search-actions {
    right: max(12px, env(safe-area-inset-right));
    bottom: max(12px, env(safe-area-inset-bottom));
    max-width: calc(100vw - 24px);
  }

  .search-actions__stack {
    gap: 8px;
  }

  .search-action {
    min-width: 42px;
    height: 42px;
    padding-inline: 10px;
  }

  .search-action:focus-visible .search-action__label {
    max-width: 0;
    margin-right: 0;
    opacity: 0;
  }
}

@keyframes search-action-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .search-action,
  .search-action__label {
    transition: none;
  }

  .search-action__icon_spin {
    animation-duration: 1.5s;
  }
}
</style>
