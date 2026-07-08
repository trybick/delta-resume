type GtagCommand = 'config' | 'event' | 'js' | 'set'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (command: GtagCommand, ...args: unknown[]) => void
  }
}

export type AnalyticsEventParams = Record<string, string | number | boolean>

export const AnalyticsEvents = {
  TailorResume: 'tailor_resume',
  UpgradeToProHeader: 'upgrade_to_pro_header',
} as const

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]

let measurementId: string | null = null

export const initAnalytics = (id: string) => {
  if (measurementId) return

  measurementId = id
  window.dataLayer = window.dataLayer ?? []
  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args)
  }

  window.gtag('js', new Date())
  window.gtag('config', id)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(script)
}

export const trackEvent = (
  name: AnalyticsEventName | (string & {}),
  params?: AnalyticsEventParams,
) => {
  if (!measurementId) return
  window.gtag('event', name, params)
}
