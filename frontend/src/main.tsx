import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import './index.css'
import App from './App.tsx'
import { theme } from './lib/themes'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

if (!clerkPublishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to frontend/.env.development.')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
      <MantineProvider theme={theme} forceColorScheme="dark">
        <App />
      </MantineProvider>
    </ClerkProvider>
  </StrictMode>,
)
