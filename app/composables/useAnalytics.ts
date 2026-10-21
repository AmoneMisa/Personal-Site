/**
 * Product events, recorded as Umami custom events (see app/plugins/umami.ts).
 *
 * Event names are a closed list so the dashboard stays readable. Event data
 * must never carry personal data or free text typed by the visitor: only
 * enum-like values such as a mode, a source or a search kind.
 */
export type AnalyticsEvent =
  | 'subscription_start'
  | 'converter_run'

type EventData = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (name: string, data?: EventData) => void }
  }
}

export function useAnalytics() {
  function trackEvent(name: AnalyticsEvent, data?: EventData) {
    if (!import.meta.client) return
    try {
      window.umami?.track(name, data)
    } catch {
      // Analytics must never break the feature that triggered it.
    }
  }

  return { trackEvent }
}
