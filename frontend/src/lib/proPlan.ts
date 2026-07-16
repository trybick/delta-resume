import {
  IconCoins,
  IconFileTypeDocx,
  IconFolders,
  IconMail,
  IconTargetArrow,
} from '@tabler/icons-react';
import { usePlans } from '@clerk/clerk-react/experimental';

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
    title: 'Gap analysis',
    description: 'See every job requirement your resume doesn\u2019t cover yet',
  },
  {
    icon: IconFolders,
    title: '10 saved resumes',
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
  planId: string | null;
};

export const useProPlan = (): ProPriceInfo => {
  const { data: plans } = usePlans({ for: 'user', pageSize: 20 });
  const proPlan = plans?.find((plan) => plan.slug === 'pro');

  if (!proPlan) {
    return { monthlyPrice: null, annualMonthlyPrice: null, planId: null };
  }

  return {
    monthlyPrice: `${proPlan.fee.currencySymbol}${proPlan.fee.amountFormatted}`,
    annualMonthlyPrice: proPlan.annualMonthlyFee
      ? `${proPlan.annualMonthlyFee.currencySymbol}${proPlan.annualMonthlyFee.amountFormatted}`
      : null,
    planId: proPlan.id,
  };
};
