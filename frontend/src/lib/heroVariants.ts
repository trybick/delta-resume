export type HeroCopy = {
  headlineLead: string;
  headlineEmphasis: string;
  subhead: string;
};

export const DEFAULT_HERO_VARIANT = 'default';

export const HERO_VARIANTS: Record<string, HeroCopy> = {
  default: {
    headlineLead: 'See every change the AI makes to your resume.',
    headlineEmphasis: 'Approve each one.',
    subhead:
      'Paste a job post. Get word-level rewrites, a matching cover letter, and your resume back in your original Word formatting.',
  },
  keep: {
    headlineLead: 'Keep your Word formatting.',
    headlineEmphasis: 'Approve every rewrite.',
    subhead:
      'Paste a job post. Review word-level diffs, export a matching cover letter, and get your resume back looking exactly like the one you uploaded.',
  },
  diffs: {
    headlineLead: 'Every AI rewrite as an inline diff',
    headlineEmphasis: 'you control.',
    subhead:
      'Paste a job post. See exactly what changed, keep your original Word formatting, and never send an untailored resume again.',
  },
};

const HERO_VARIANT_KEY = 'deltaResume.heroVariant';

export const readStoredHeroVariant = (): string => {
  try {
    const stored = sessionStorage.getItem(HERO_VARIANT_KEY);
    if (stored && stored in HERO_VARIANTS) return stored;
  } catch {
    return DEFAULT_HERO_VARIANT;
  }
  return DEFAULT_HERO_VARIANT;
};

export const resolveHeroVariant = (search: string): string => {
  const params = new URLSearchParams(search);
  const fromQuery = params.get('v');
  if (fromQuery && fromQuery in HERO_VARIANTS) {
    try {
      sessionStorage.setItem(HERO_VARIANT_KEY, fromQuery);
    } catch {
      return fromQuery;
    }
    return fromQuery;
  }
  return readStoredHeroVariant();
};

export const heroCopyForVariant = (variant: string): HeroCopy =>
  HERO_VARIANTS[variant] ?? HERO_VARIANTS[DEFAULT_HERO_VARIANT];

export const heroHeadlineForVariant = (variant: string): string => {
  const copy = heroCopyForVariant(variant);
  return `${copy.headlineLead} ${copy.headlineEmphasis}`;
};
