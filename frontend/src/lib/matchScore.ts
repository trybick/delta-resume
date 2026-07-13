const STOPWORDS = new Set([
  'a',
  'about',
  'above',
  'across',
  'after',
  'all',
  'along',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'best',
  'better',
  'between',
  'both',
  'build',
  'building',
  'business',
  'but',
  'by',
  'can',
  'candidate',
  'candidates',
  'company',
  'culture',
  'day',
  'demonstrated',
  'description',
  'do',
  'does',
  'each',
  'employee',
  'employees',
  'environment',
  'etc',
  'every',
  'excellent',
  'experience',
  'experiences',
  'familiarity',
  'for',
  'from',
  'good',
  'great',
  'has',
  'have',
  'having',
  'help',
  'high',
  'highly',
  'hire',
  'hiring',
  'how',
  'if',
  'in',
  'including',
  'into',
  'is',
  'it',
  'its',
  'job',
  'join',
  'knowledge',
  'like',
  'looking',
  'make',
  'may',
  'more',
  'most',
  'must',
  'new',
  'not',
  'of',
  'offer',
  'on',
  'one',
  'opportunity',
  'or',
  'other',
  'our',
  'out',
  'over',
  'own',
  'per',
  'plus',
  'position',
  'preferred',
  'proficiency',
  'proven',
  'qualifications',
  'related',
  'required',
  'requirements',
  'responsibilities',
  'role',
  'salary',
  'skills',
  'some',
  'strong',
  'such',
  'team',
  'teams',
  'than',
  'that',
  'the',
  'their',
  'them',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'understanding',
  'up',
  'us',
  'use',
  'using',
  'we',
  'well',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'will',
  'with',
  'within',
  'work',
  'working',
  'would',
  'year',
  'years',
  'you',
  'your',
]);

const MAX_KEYWORDS = 30;

export type MatchKeyword = {
  term: string;
  weight: number;
};

const tokenize = (text: string): string[] => {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9+#./-]*/g) ?? [];
  return matches
    .map((token) => token.replace(/[./-]+$/, ''))
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token));
};

const isKeywordToken = (token: string): boolean => !STOPWORDS.has(token);

export const extractKeywords = (jobDescription: string): MatchKeyword[] => {
  const tokens = tokenize(jobDescription);
  const weights = new Map<string, number>();

  tokens.filter(isKeywordToken).forEach((token) => {
    weights.set(token, (weights.get(token) ?? 0) + 1);
  });

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = tokens[i];
    const second = tokens[i + 1];
    if (!isKeywordToken(first) || !isKeywordToken(second)) continue;
    const bigram = `${first} ${second}`;
    weights.set(bigram, (weights.get(bigram) ?? 0) + 2);
  }

  return [...weights.entries()]
    .filter(([term, weight]) => (term.includes(' ') ? weight >= 4 : weight >= 1))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([term, weight]) => ({ term, weight }));
};

export const scoreResume = (resumeText: string, keywords: MatchKeyword[]): number => {
  if (keywords.length === 0) return 0;
  const haystack = ` ${tokenize(resumeText).join(' ')} `;
  const totalWeight = keywords.reduce((sum, keyword) => sum + keyword.weight, 0);
  const matchedWeight = keywords.reduce(
    (sum, keyword) => (haystack.includes(` ${keyword.term} `) ? sum + keyword.weight : sum),
    0,
  );
  return Math.round((matchedWeight / totalWeight) * 100);
};
