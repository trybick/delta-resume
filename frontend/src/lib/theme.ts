import { createTheme } from '@mantine/core'
import type { MantineColorsTuple, MantineThemeOverride } from '@mantine/core'

export type AppTheme = {
  theme: MantineThemeOverride
  gradient: { from: string; to: string }
  clerkPrimary: string
}

const fontStack =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const baseTheme = {
  primaryShade: { light: 6, dark: 5 } as const,
  fontFamily: fontStack,
  defaultRadius: 'md' as const,
  autoContrast: true,
  headings: {
    fontFamily: fontStack,
    fontWeight: '600',
  },
}

const deepOceanDark: MantineColorsTuple = [
  '#e7f0f4',
  '#cbdde6',
  '#a8c4d2',
  '#82a7ba',
  '#3f5d70',
  '#345264',
  '#284252',
  '#1f3543',
  '#182b37',
  '#11212b',
]

export const appTheme: AppTheme = {
  theme: createTheme({
    ...baseTheme,
    primaryColor: 'cyan',
    colors: { dark: deepOceanDark },
  }),
  gradient: { from: 'cyan.3', to: 'blue.4' },
  clerkPrimary: '#22b8cf',
}
