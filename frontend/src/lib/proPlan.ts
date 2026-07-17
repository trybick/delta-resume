import {
  IconCoins,
  IconFileTypeDocx,
  IconFolders,
  IconMail,
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
    title: '200 credits / month',
    description: 'Tailor your resume up to 200 times every month',
  },
  {
    icon: IconMail,
    title: 'Automatic cover letters',
    description: 'Every tailor run writes a matching cover letter',
  },
  {
    icon: IconTargetArrow,
    title: 'See missing requirements',
    description:
      'See every requirement this job asks for that your resume doesn\u2019t show yet, plus where a bullet would fit',
  },
  {
    icon: IconFolders,
    title: `${SAVED_RESUME_LIMIT_PRO} saved resumes`,
    description: 'Keep multiple versions ready for different roles',
  },
  {
    icon: IconFileTypeDocx,
    title: 'DOCX export',
    description: 'Download your tailored resume with formatting intact',
  },
];

export type ProPriceInfo = {
  monthlyPrice: string | null;
  annualMonthlyPrice: string | null;
  annualSavingsPercent: number | null;
  planId: string | null;
};
