import type { DocxCleanLayout } from './docxLayout';

export type TailorStatus = 'idle' | 'loading' | 'done';

export type ChangeKind = 'bullet' | 'skill' | 'paragraph';

export type BulletChange = {
  id: string;
  targetId: string;
  sourceLines: number[];
  original: string;
  tailored: string;
  kind: ChangeKind;
};

export type ResumeSourceNode = {
  id: string;
  sourceLines: number[];
};

export type ResumeDateRange = {
  start: string | null;
  end: string | null;
  text: string | null;
};

export type ResumeBulletNode = {
  id: string;
  sourceLines: number[];
};

export type ResumeEntry = {
  kind: 'entry';
  id: string;
  title: string | null;
  organization: string | null;
  location: string | null;
  dates: ResumeDateRange | null;
  headingSourceLines: number[];
  bullets: ResumeBulletNode[];
};

export type ResumeParagraphNode = {
  kind: 'paragraph';
  id: string;
  sourceLines: number[];
};

export type ResumeSkillsGroup = {
  kind: 'skillsGroup';
  id: string;
  label: string | null;
  sourceLines: number[];
};

export type ResumeStandaloneBullet = {
  kind: 'bullet';
  id: string;
  sourceLines: number[];
};

export type ResumeBlock =
  | ResumeEntry
  | ResumeParagraphNode
  | ResumeSkillsGroup
  | ResumeStandaloneBullet;

export type ResumeSection = {
  id: string;
  kind: string;
  heading: ResumeSourceNode | null;
  blocks: ResumeBlock[];
};

export type ResumeDocument = {
  version: number;
  header: {
    name: ResumeSourceNode;
    contact: ResumeSourceNode[];
  };
  sections: ResumeSection[];
};

export type RequirementImportance = 'must' | 'nice';

export type JobRequirement = {
  text: string;
  importance: RequirementImportance;
  satisfiedBy: string[];
  satisfiedByChanges: string[];
  gapHint: string | null;
  draftBullet: string | null;
  insertAfterId: string | null;
  locked: boolean;
};

export type AddedBullet = {
  id: string;
  requirementText: string;
  text: string;
  afterId: string;
};

export type TailorResult = {
  resumeText: string;
  summary: string;
  changes: BulletChange[];
  requirements: JobRequirement[];
  document?: ResumeDocument | null;
  resumeLayout?: DocxCleanLayout | null;
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
  resumeDocument: ResumeDocument | null;
  resumeLayout: DocxCleanLayout | null;
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
