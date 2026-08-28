import {
  IconCoins,
  IconFolders,
  IconMail,
  IconPencilPlus,
  IconTargetArrow,
} from '@tabler/icons-react';
import { SAVED_RESUME_LIMIT_PRO } from './constants';

export type ProFeature = {
  icon: typeof IconCoins;
  title: string;
  description: string;
};

export const PRO_FEATURES: ProFeature[] = [
  {
    icon: IconCoins,
    title: '100 credits / month',
    description: 'Tailor your resume up to 100 times, refreshed every month',
  },
  {
    icon: IconMail,
    title: 'Cover letter customization',
    description: 'Choose the length and tone of every cover letter',
  },
  {
    icon: IconTargetArrow,
    title: 'See missing requirements',
    description:
      'See every requirement this job asks for that your resume doesn\u2019t show yet, plus where a bullet would fit',
  },
  {
    icon: IconPencilPlus,
    title: 'Fill the gaps in one click',
    description:
      'Get a ready-to-edit bullet for each missing requirement, inserted right where it belongs',
  },
  {
    icon: IconFolders,
    title: `${SAVED_RESUME_LIMIT_PRO} saved resumes`,
    description: 'Keep multiple versions ready for different roles',
  },
];

export type ProPriceInfo = {
  monthlyPrice: string | null;
  annualMonthlyPrice: string | null;
  annualSavingsPercent: number | null;
  planId: string | null;
  isLoading: boolean;
};
