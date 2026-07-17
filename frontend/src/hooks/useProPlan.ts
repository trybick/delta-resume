import { usePlans } from '@clerk/clerk-react/experimental';
import type { ProPriceInfo } from '../lib/proPlan';

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

export const getProUpgradeCtaLabel = (price: string | null): string =>
  price ? `Upgrade to Pro — from ${price}/mo` : 'Upgrade to Pro';

export const useProUpgradeCtaLabel = (): string => {
  const { annualMonthlyPrice, monthlyPrice } = useProPlan();
  return getProUpgradeCtaLabel(annualMonthlyPrice ?? monthlyPrice);
};
