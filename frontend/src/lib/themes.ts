import { createTheme } from '@mantine/core'
import type { MantineColorsTuple } from '@mantine/core'

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

const fontStack =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

export const theme = createTheme({
  primaryColor: 'cyan',
  primaryShade: { light: 6, dark: 5 },
  colors: { dark: deepOceanDark },
  fontFamily: fontStack,
  defaultRadius: 'md',
  headings: {
    fontFamily: fontStack,
    fontWeight: '600',
  },
})
