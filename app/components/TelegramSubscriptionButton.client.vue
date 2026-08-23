<script setup lang="ts">
const route = useRoute()
const { locale } = useI18n()

const available = ref(false)
const busy = ref(false)
const failed = ref(false)
const editToken = ref('')
const editPath = ref('')

const searchKind = computed(() => {
  const path = route.path.replace(/^\/(?:ru|en|kk)(?=\/)/, '')
  if (path === '/flat-finder') return 'flats'
  if (path === '/jobs') return 'jobs'
  if (path === '/hiring') return 'candidates'
  return null
})

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

onMounted(async () => {
  try {
    const status = await $fetch<{ enabled: boolean }>('/subscription-status')
    available.value = status.enabled === true
  } catch {
    available.value = false
  }
})

const editing = computed(() => !!editToken.value && editPath.value === route.path)
const isEnglish = computed(() => String(locale.value).toLowerCase().startsWith('en'))
const label = computed(() => {
  if (busy.value) return isEnglish.value ? 'Opening Telegram…' : 'Открываю Telegram…'
  if (editing.value) return isEnglish.value ? 'Update subscription' : 'Обновить подписку'
  return isEnglish.value ? 'Subscribe to new results' : 'Подписаться на новые'
})
const errorText = computed(() => isEnglish.value
  ? 'Could not create the Telegram subscription link.'
  : 'Не удалось создать ссылку подписки в Telegram.')

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
  <div v-if="searchKind && available" class="tg-subscribe">
    <p v-if="failed" class="tg-subscribe__error">{{ errorText }}</p>
    <u-button
      icon="i-lucide-bell-plus"
      size="lg"
      :loading="busy"
      :disabled="busy"
      @click="subscribe"
    >
      {{ label }}
    </u-button>
  </div>
</template>

<style scoped>
.tg-subscribe {
  position: fixed;
  right: max(18px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 45;
  display: flex;
  max-width: min(360px, calc(100vw - 36px));
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.tg-subscribe__error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.94);
  color: #fecaca;
  font-size: 12px;
  line-height: 1.35;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28);
}

@media (max-width: 640px) {
  .tg-subscribe {
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
    max-width: calc(100vw - 24px);
  }
}
</style>
