export type ProAccent = {
  gradient: { from: string; to: string };
  badgeColor: string;
  insightLabelColor: string;
  insightIconColor: string;
  insightBorderColor: string;
  insightBackground: string;
};

export const proAccent: ProAccent = {
  gradient: { from: 'teal.4', to: 'green.8' },
  badgeColor: 'teal',
  insightLabelColor: 'teal.4',
  insightIconColor: 'var(--mantine-color-teal-4)',
  insightBorderColor: 'var(--mantine-color-teal-6)',
  insightBackground: 'rgba(18, 184, 134, 0.07)',
};
