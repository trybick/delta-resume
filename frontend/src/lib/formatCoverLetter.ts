export const COVER_LETTER_NAME_PLACEHOLDER = '[Your Name]';

export const formatCoverLetterDate = (date: Date = new Date()): string =>
  date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const cleanSubjectPart = (value: string): string =>
  value.trim().replace(/^[.\s]+/, '').replace(/[.\s]+$/, '').trim();

export const formatCoverLetterSubject = (jobTitle: string, companyName: string): string | null => {
  const subjectParts = [jobTitle, companyName]
    .map(cleanSubjectPart)
    .filter((part) => part.length > 0);
  if (subjectParts.length === 0) return null;
  return `Re: ${subjectParts.join(' at ')}`;
};

export const formatCoverLetterText = (
  letter: string,
  candidateName: string,
  date: Date = new Date(),
): string => {
  const dateLine = formatCoverLetterDate(date);
  const body = formatCoverLetterSignature(letter, candidateName);
  return `${dateLine}\n${body}`;
};

export const formatCoverLetterSignature = (letter: string, candidateName: string): string => {
  const signatureName = candidateName.trim() || COVER_LETTER_NAME_PLACEHOLDER;
  return `${letter.trimEnd()}\n${signatureName}`;
};

export const prependCoverLetterDate = (letter: string, date: Date = new Date()): string =>
  `${formatCoverLetterDate(date)}\n${letter.trimStart()}`;
