import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import './index.css'
import AppBootstrap from './components/AppBootstrap.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { AppThemeProvider } from './lib/themeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <ErrorBoundary>
        <AppBootstrap />
      </ErrorBoundary>
    </AppThemeProvider>
  </StrictMode>,
)
