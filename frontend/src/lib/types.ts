export type TailorStatus = 'idle' | 'loading' | 'done';

export type ChangeKind = 'bullet' | 'skill' | 'paragraph';

export type BulletChange = {
  id: string;
  lineIndex: number;
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
