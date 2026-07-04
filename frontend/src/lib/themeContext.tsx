import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { getAppTheme, type AppTheme, type AppThemeId } from './themes'

type ThemeContextValue = {
  appTheme: AppTheme
  setThemeId: (id: AppThemeId) => void
}

const storageKey = 'delta-resume-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export const useAppTheme = (): ThemeContextValue => {
  const contextValue = useContext(ThemeContext)
  if (!contextValue) {
    throw new Error('useAppTheme must be used within AppThemeProvider')
  }
  return contextValue
}

type AppThemeProviderProps = {
  children: ReactNode
}

export const AppThemeProvider = ({ children }: AppThemeProviderProps) => {
  const [themeId, setThemeIdState] = useState<AppThemeId>(
    () => getAppTheme(localStorage.getItem(storageKey)).id,
  )

  const contextValue = useMemo<ThemeContextValue>(() => {
    const setThemeId = (id: AppThemeId) => {
      localStorage.setItem(storageKey, id)
      setThemeIdState(id)
    }
    return { appTheme: getAppTheme(themeId), setThemeId }
  }, [themeId])

  return (
    <ThemeContext.Provider value={contextValue}>
      <MantineProvider theme={contextValue.appTheme.theme} forceColorScheme="dark">
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  )
}
