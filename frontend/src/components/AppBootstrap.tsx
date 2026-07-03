import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import App from '../App'
import { getClerkPublishableKey } from '../lib/env'

const AppBootstrap = () => {
  const clerkPublishableKey = getClerkPublishableKey()

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#22b8cf',
          borderRadius: '0.5rem',
        },
      }}
    >
      <App />
    </ClerkProvider>
  )
}

export default AppBootstrap
