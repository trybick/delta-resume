const formatTimestamp = (date: Date): string => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  const rawHours = date.getHours();
  const suffix = rawHours >= 12 ? 'pm' : 'am';
  const hours = rawHours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${minutes} ${suffix}`;
};

export const formatDefaultResumeName = (
  date: Date,
  fileName?: string | null,
  existingNames: string[] = [],
): string => {
  const timestamp = formatTimestamp(date);
  const trimmedFileName = fileName?.trim();

  if (!trimmedFileName) {
    return `Resume ${timestamp}`;
  }

  const existing = new Set(existingNames.map((name) => name.toLowerCase()));
  if (!existing.has(trimmedFileName.toLowerCase())) {
    return trimmedFileName;
  }

  return `${trimmedFileName} (${timestamp})`;
};
