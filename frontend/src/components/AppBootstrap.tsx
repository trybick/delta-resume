import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import App from '../App'
import { getClerkPublishableKey } from '../lib/env'
import { appTheme } from '../lib/theme'

const AppBootstrap = () => {
  const clerkPublishableKey = getClerkPublishableKey()

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      routerPush={(to: string) => window.history.pushState(null, '', to)}
      routerReplace={(to: string) => window.history.replaceState(null, '', to)}
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
