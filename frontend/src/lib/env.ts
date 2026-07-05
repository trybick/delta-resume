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
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
  return id?.trim() || null
}
