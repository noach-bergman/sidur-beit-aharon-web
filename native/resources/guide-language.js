// Respect the phone's primary language unless the reader explicitly chose one.
export function guideLanguage(saved, phoneLanguage = '') {
  if (saved === 'he' || saved === 'en') return saved;
  return /^(he|iw)(-|_|$)/i.test(phoneLanguage) ? 'he' : 'en';
}
