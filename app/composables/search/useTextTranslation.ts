import { computed, ref, type Ref } from 'vue'
import { safeFetch } from '~/utils/safeFetch'

type TranslatableEntity = { description?: string | null }

type TranslationResult = {
  status: 'pending' | 'completed' | 'failed' | 'disabled' | 'not_found'
  key?: string
  data?: { translatedText?: string; sourceLanguage?: string | null }
}

export function useTextTranslation<T extends TranslatableEntity>(
  active: Ref<T | null>,
  locale: Ref<string>,
  entityKey: (entity: T) => string,
  feature: 'vacancy-description' | 'candidate-description',
) {
  const translatedText = ref('')
  const translating = ref(false)
  const translationFailed = ref(false)
  const cache = new Map<string, string>()
  let requestId = 0
  let pollTimer: ReturnType<typeof setTimeout> | undefined

  const targetLanguage = () => locale.value.startsWith('en') ? 'en' as const : 'ru' as const
  const cacheKey = (entity: T) => `${entityKey(entity)}:${targetLanguage()}`
  const canTranslate = computed(() => Boolean(active.value?.description?.trim()))

  function cancelTranslation() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = undefined
    requestId += 1
    translating.value = false
  }

  function prepareTranslation(entity: T | null) {
    cancelTranslation()
    translatedText.value = entity ? cache.get(cacheKey(entity)) || '' : ''
    translationFailed.value = false
  }

  function accept(result: TranslationResult, entity: T, id: number): boolean {
    if (id !== requestId || active.value !== entity || result.status !== 'completed') return result.status === 'completed'
    const text = result.data?.translatedText?.trim() || ''
    translating.value = false
    translationFailed.value = !text
    if (text) {
      cache.set(cacheKey(entity), text)
      translatedText.value = text
    }
    return true
  }

  async function poll(key: string, entity: T, id: number, attempt = 0) {
    if (id !== requestId || active.value !== entity) return
    const { data, error } = await safeFetch<TranslationResult>('/content-translate', { params: { key } })
    if (id !== requestId || active.value !== entity) return
    if (!error && data && accept(data, entity, id)) return
    if (error || !data || ['failed', 'disabled', 'not_found'].includes(data.status) || attempt >= 159) {
      translating.value = false
      translationFailed.value = true
      return
    }
    pollTimer = setTimeout(() => void poll(key, entity, id, attempt + 1), 1500)
  }

  async function translate() {
    const entity = active.value
    const text = entity?.description?.trim()
    if (!entity || !text || translating.value) return
    const cached = cache.get(cacheKey(entity))
    if (cached) {
      translatedText.value = cached
      return
    }

    cancelTranslation()
    const id = ++requestId
    translating.value = true
    translationFailed.value = false
    const { data, error } = await safeFetch<TranslationResult>('/content-translate', {
      method: 'POST',
      body: { text, targetLanguage: targetLanguage(), feature },
    })
    if (id !== requestId || active.value !== entity) return
    if (error || !data) {
      translating.value = false
      translationFailed.value = true
      return
    }
    if (accept(data, entity, id)) return
    if (data.status === 'pending' && data.key) {
      pollTimer = setTimeout(() => void poll(data.key!, entity, id), 1000)
      return
    }
    translating.value = false
    translationFailed.value = true
  }

  return { translatedText, translating, translationFailed, canTranslate, prepareTranslation, cancelTranslation, translate }
}
