import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import './index.css'
import AppBootstrap from './components/AppBootstrap.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { theme } from './lib/themes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="dark">
      <ErrorBoundary>
        <AppBootstrap />
      </ErrorBoundary>
    </MantineProvider>
  </StrictMode>,
)
