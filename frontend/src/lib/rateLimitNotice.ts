type RateLimitListener = (message: string) => void

const listeners = new Set<RateLimitListener>()

export const subscribeToRateLimit = (listener: RateLimitListener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const notifyRateLimited = (message: string): void => {
  listeners.forEach((listener) => listener(message))
}
