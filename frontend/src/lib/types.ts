export type TailorStatus = 'idle' | 'loading' | 'done';

export type ChangeKind = 'bullet' | 'skill' | 'paragraph';

export type BulletChange = {
  id: string;
  lineIndex: number;
  lineIndexes: number[];
  original: string;
  tailored: string;
  kind: ChangeKind;
};

export type ResumeItemKind = 'paragraph' | 'bullet' | 'subheading';

export type ResumeItem = {
  kind: ResumeItemKind;
  lines: number[];
};

export type ResumeSection = {
  headingLine: number | null;
  items: ResumeItem[];
};

export type ResumeStructure = {
  headerLines: number[];
  sections: ResumeSection[];
};

export type RequirementImportance = 'must' | 'nice';

export type JobRequirement = {
  text: string;
  importance: RequirementImportance;
  satisfiedBy: number[];
  satisfiedByChanges: number[];
  gapHint: string | null;
  draftBullet: string | null;
  insertAfterLine: number | null;
  locked: boolean;
};

export type AddedBullet = {
  id: string;
  requirementText: string;
  text: string;
  afterLineIndex: number;
};

export type TailorResult = {
  resumeText: string;
  summary: string;
  changes: BulletChange[];
  requirements: JobRequirement[];
  structure?: ResumeStructure | null;
};

export type ChangeDecision = 'accepted' | 'reverted';

export type CoverLetterStatus = 'idle' | 'loading' | 'done' | 'error';

export type CoverLetterResult = {
  jobTitle: string;
  companyName: string;
  letter: string;
};

export type CoverLetterLength = 'short' | 'standard' | 'long';

export type CoverLetterTone = 'professional' | 'friendly' | 'enthusiastic' | 'formal';

export type CoverLetterSettings = {
  length: CoverLetterLength;
  tone: CoverLetterTone;
};

export type UserSettings = {
  coverLetter: CoverLetterSettings;
};

export const defaultUserSettings: UserSettings = {
  coverLetter: {
    length: 'standard',
    tone: 'professional',
  },
};

export const coverLetterLengthOptions: { value: CoverLetterLength; label: string }[] = [
  { value: 'short', label: 'Short (~150 words)' },
  { value: 'standard', label: 'Standard (~250 words)' },
  { value: 'long', label: 'Long (~400 words)' },
];

export const coverLetterToneOptions: { value: CoverLetterTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'formal', label: 'Formal' },
];

export type CreditStatus = {
  remaining: number;
  total: number;
  plan: string;
  isAuthenticated: boolean;
};

export type SavedResume = {
  id: string;
  name: string;
  resumeText: string;
  createdAt: string;
};

export type AttachedFile = {
  name: string;
  size: number;
};

export type OriginalDocx = {
  file: File;
  parsedText: string;
};

export type PaywallReason = 'credits' | 'savedLimit' | 'upgrade' | 'coverLetter' | 'gaps' | 'signUp';
