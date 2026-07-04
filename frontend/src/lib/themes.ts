import { createTheme } from '@mantine/core'
import type { MantineColorsTuple, MantineThemeOverride } from '@mantine/core'

export type AppThemeId =
  | 'deep-ocean'
  | 'carbon'
  | 'indigo-night'
  | 'glacier'
  | 'eclipse'

export type AppTheme = {
  id: AppThemeId
  label: string
  description: string
  theme: MantineThemeOverride
  gradient: { from: string; to: string }
  clerkPrimary: string
  swatch: string
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

const carbonDark: MantineColorsTuple = [
  '#f5f5f5',
  '#e3e3e3',
  '#c8c8c8',
  '#a8a8a8',
  '#3a3a3a',
  '#2e2e2e',
  '#232323',
  '#191919',
  '#101010',
  '#080808',
]

const silverAccent: MantineColorsTuple = [
  '#ffffff',
  '#f4f4f4',
  '#e4e4e4',
  '#d4d4d4',
  '#c4c4c4',
  '#dedede',
  '#a4a4a4',
  '#8a8a8a',
  '#6f6f6f',
  '#555555',
]

const indigoNightDark: MantineColorsTuple = [
  '#eeeff3',
  '#d5d7e0',
  '#babdcc',
  '#9da1b5',
  '#40435a',
  '#33364a',
  '#282b3c',
  '#1f212f',
  '#171923',
  '#101118',
]

const indigoAccent: MantineColorsTuple = [
  '#eceefc',
  '#d3d7f7',
  '#b7bef1',
  '#9aa4ea',
  '#7f8ce4',
  '#6a77dd',
  '#5e6ad2',
  '#4f59b6',
  '#404893',
  '#323871',
]

const glacierDark: MantineColorsTuple = [
  '#edf1f5',
  '#d3dce4',
  '#b6c4d1',
  '#98abbd',
  '#3e4f60',
  '#324151',
  '#273442',
  '#1d2834',
  '#151e28',
  '#0e151d',
]

const iceAccent: MantineColorsTuple = [
  '#e8f3ff',
  '#c9e2ff',
  '#a7cfff',
  '#86bcff',
  '#6caeff',
  '#58a2fb',
  '#4b97f2',
  '#3d7fd0',
  '#3066a8',
  '#244d80',
]

const eclipseDark: MantineColorsTuple = [
  '#f0f2f1',
  '#d9dedb',
  '#c0c6c3',
  '#a4ada9',
  '#3b423f',
  '#2f3532',
  '#242927',
  '#1a1f1d',
  '#121615',
  '#0b0e0d',
]

const mintAccent: MantineColorsTuple = [
  '#e6faf2',
  '#c3f2dd',
  '#9de9c7',
  '#78dfb1',
  '#57d69d',
  '#3ecf8e',
  '#35bd80',
  '#2c9e6b',
  '#237e56',
  '#1a5f41',
]

export const appThemes: AppTheme[] = [
  {
    id: 'deep-ocean',
    label: 'Deep Ocean',
    description: 'Blue-grey depths with a cyan accent (current)',
    theme: createTheme({
      ...baseTheme,
      primaryColor: 'cyan',
      colors: { dark: deepOceanDark },
    }),
    gradient: { from: 'cyan.3', to: 'blue.4' },
    clerkPrimary: '#22b8cf',
    swatch: '#22b8cf',
  },
  {
    id: 'carbon',
    label: 'Carbon',
    description: 'True-black monochrome, no color at all',
    theme: createTheme({
      ...baseTheme,
      primaryColor: 'accent',
      colors: { dark: carbonDark, accent: silverAccent },
    }),
    gradient: { from: 'accent.0', to: 'accent.3' },
    clerkPrimary: '#e4e4e4',
    swatch: '#e4e4e4',
  },
  {
    id: 'indigo-night',
    label: 'Indigo Night',
    description: 'Muted slate darks with a soft indigo accent',
    theme: createTheme({
      ...baseTheme,
      primaryColor: 'accent',
      colors: { dark: indigoNightDark, accent: indigoAccent },
    }),
    gradient: { from: 'accent.2', to: 'accent.5' },
    clerkPrimary: '#5e6ad2',
    swatch: '#5e6ad2',
  },
  {
    id: 'glacier',
    label: 'Glacier',
    description: 'Deep cool slate with a clean ice-blue accent',
    theme: createTheme({
      ...baseTheme,
      primaryColor: 'accent',
      colors: { dark: glacierDark, accent: iceAccent },
    }),
    gradient: { from: 'accent.2', to: 'accent.5' },
    clerkPrimary: '#58a2fb',
    swatch: '#58a2fb',
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    description: 'Near-black with a quiet mint accent',
    theme: createTheme({
      ...baseTheme,
      primaryColor: 'accent',
      colors: { dark: eclipseDark, accent: mintAccent },
    }),
    gradient: { from: 'accent.2', to: 'accent.5' },
    clerkPrimary: '#3ecf8e',
    swatch: '#3ecf8e',
  },
]

export const defaultThemeId: AppThemeId = 'deep-ocean'

export const getAppTheme = (id: string | null): AppTheme =>
  appThemes.find((appTheme) => appTheme.id === id) ?? appThemes[0]
