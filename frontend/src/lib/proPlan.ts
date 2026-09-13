import {
  IconCoins,
  IconFileTypeDocx,
  IconFolders,
  IconMail,
  IconPencilPlus,
  IconTargetArrow,
} from '@tabler/icons-react';

export type ProFeature = {
  icon: typeof IconCoins;
  title: string;
  description: string;
};

export const PRO_FEATURES: ProFeature[] = [
  {
    icon: IconCoins,
    title: 'Never send an untailored resume again',
    description: 'Tailor every application, 100 runs a month.',
  },
  {
    icon: IconTargetArrow,
    title: 'See exactly what the job asks for that you\u2019re missing',
    description: 'The full requirements list, not just the first gap.',
  },
  {
    icon: IconPencilPlus,
    title: 'Fill every gap in one click',
    description: 'A ready-to-edit bullet for each, placed where it fits.',
  },
  {
    icon: IconFileTypeDocx,
    title: 'Keep your Word formatting on every export',
    description: 'DOCX and PDF that look exactly like the resume you uploaded, fit to one page.',
  },
  {
    icon: IconFolders,
    title: 'Every application in one place',
    description: 'Full history, re-open and re-export anything.',
  },
  {
    icon: IconMail,
    title: 'Cover letters in your voice',
    description: 'Pick length and tone.',
  },
];

export type ProPriceInfo = {
  monthlyPrice: string | null;
  annualMonthlyPrice: string | null;
  annualSavingsPercent: number | null;
  planId: string | null;
  isLoading: boolean;
};