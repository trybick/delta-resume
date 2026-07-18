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
    title: 'See missing requirements',
    description:
      'See every requirement this job asks for that your resume doesn\u2019t show yet, plus where a bullet would fit',
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
  annualSavingsPercent: number | null;
  planId: string | null;
};

const getAnnualSavingsPercent = (
  monthlyAmount: number | undefined,
  annualMonthlyAmount: number | undefined,
): number | null => {
  if (!monthlyAmount || !annualMonthlyAmount || annualMonthlyAmount >= monthlyAmount) {
    return null;
  }

  return Math.round(((monthlyAmount - annualMonthlyAmount) / monthlyAmount) * 100);
};

export const useProPlan = (): ProPriceInfo => {
  const { data: plans } = usePlans({ for: 'user', pageSize: 20 });
  const proPlan = plans?.find((plan) => plan.slug === 'pro');

  if (!proPlan) {
    return {
      monthlyPrice: null,
      annualMonthlyPrice: null,
      annualSavingsPercent: null,
      planId: null,
    };
  }

  return {
    monthlyPrice: `${proPlan.fee.currencySymbol}${proPlan.fee.amountFormatted}`,
    annualMonthlyPrice: proPlan.annualMonthlyFee
      ? `${proPlan.annualMonthlyFee.currencySymbol}${proPlan.annualMonthlyFee.amountFormatted}`
      : null,
    annualSavingsPercent: getAnnualSavingsPercent(
      proPlan.fee?.amount,
      proPlan.annualMonthlyFee?.amount,
    ),
    planId: proPlan.id,
  };
};
