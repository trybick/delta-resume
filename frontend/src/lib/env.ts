export const getClerkPublishableKey = (): string => {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

  if (!key) {
    throw new Error(
      'Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to frontend/.env.development and restart the dev server.',
    )
  }

  return key
}

export const getGaMeasurementId = (): string | null => {
  if (!import.meta.env.PROD) return null

  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
  return id?.trim() || null
}

export const getSentryDsn = (): string | null => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  return dsn?.trim() || null
}
