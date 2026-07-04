import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import App from '../App'
import { getClerkPublishableKey } from '../lib/env'
import { useAppTheme } from '../lib/themeContext'

const AppBootstrap = () => {
  const clerkPublishableKey = getClerkPublishableKey()
  const { appTheme } = useAppTheme()

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: appTheme.clerkPrimary,
          borderRadius: '0.5rem',
        },
      }}
    >
      <App />
    </ClerkProvider>
  )
}

export default AppBootstrap
