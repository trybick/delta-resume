export type ProAccent = {
  gradient: { from: string; to: string };
  badgeColor: string;
  insightLabelColor: string;
  insightIconColor: string;
  insightBorderColor: string;
  insightBackground: string;
};

export const proAccent: ProAccent = {
  gradient: { from: 'yellow.7', to: 'orange.9' },
  badgeColor: 'orange',
  insightLabelColor: 'orange.5',
  insightIconColor: 'var(--mantine-color-orange-5)',
  insightBorderColor: 'var(--mantine-color-orange-6)',
  insightBackground: 'rgba(232, 145, 45, 0.07)',
};
