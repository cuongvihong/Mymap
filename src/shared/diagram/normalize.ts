/**
 * Accent-insensitive text normalisation, used for unique names and for search.
 * Same behaviour as studyapp: lower case, no diacritics, single spaces.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Folder friendly name: ascii letters and digits separated by single hyphens, at most 40 chars. */
export function slugify(text: string, maxLength = 40): string {
  const slug = normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
  return slug || 'du-an'
}
