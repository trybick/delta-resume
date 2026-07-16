import { createTheme } from '@mantine/core';
import type { MantineColorsTuple, MantineThemeOverride } from '@mantine/core';

export type AppTheme = {
  theme: MantineThemeOverride;
  gradient: { from: string; to: string };
  upgradeGradient: { from: string; to: string };
  clerkPrimary: string;
};

export const manropeStack =
  'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const spaceGroteskStack =
  '"Space Grotesk", Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

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
];

export const appTheme: AppTheme = {
  theme: createTheme({
    scale: 1.1,
    primaryShade: { light: 6, dark: 5 },
    fontFamily: manropeStack,
    defaultRadius: 'md',
    autoContrast: true,
    headings: {
      fontFamily: manropeStack,
      fontWeight: '600',
    },
    primaryColor: 'cyan',
    colors: { dark: deepOceanDark },
  }),
  gradient: { from: 'cyan.3', to: 'blue.4' },
  upgradeGradient: { from: 'yellow.7', to: 'orange.9' },
  clerkPrimary: '#22b8cf',
};
