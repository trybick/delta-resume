import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import AppBootstrap from './components/AppBootstrap.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { initAnalytics } from './lib/analytics'
import { getGaMeasurementId } from './lib/env'
import { appTheme } from './lib/theme'

const gaMeasurementId = getGaMeasurementId()
if (gaMeasurementId) {
  initAnalytics(gaMeasurementId)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={appTheme.theme} forceColorScheme="dark">
      <Notifications />
      <ErrorBoundary>
        <AppBootstrap />
      </ErrorBoundary>
    </MantineProvider>
  </StrictMode>,
)
