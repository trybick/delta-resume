type GtagCommand = 'config' | 'event' | 'js' | 'set'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (command: GtagCommand, ...args: unknown[]) => void
  }
}

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
  name: string,
  params?: Record<string, string | number | boolean>,
) => {
  if (!measurementId) return
  window.gtag('event', name, params)
}
