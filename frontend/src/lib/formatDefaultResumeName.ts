export const formatDefaultResumeName = (date: Date): string => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  const rawHours = date.getHours();
  const suffix = rawHours >= 12 ? 'pm' : 'am';
  const hours = rawHours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `Resume ${month}/${day}/${year} ${hours}:${minutes} ${suffix}`;
};
