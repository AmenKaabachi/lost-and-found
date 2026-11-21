// 1. Constants
const ACCENT_VARIANTS = {
  a: '[aA\u00e0\u00c0\u00e1\u00c1\u00e2\u00c2\u00e3\u00c3\u00e4\u00c4\u00e5\u00c5]',
  c: '[cC\u00e7\u00c7]',
  e: '[eE\u00e8\u00c8\u00e9\u00c9\u00ea\u00ca\u00eb\u00cb]',
  i: '[iI\u00ec\u00cc\u00ed\u00cd\u00ee\u00ce\u00ef\u00cf]',
  n: '[nN\u00f1\u00d1]',
  o: '[oO\u00f2\u00d2\u00f3\u00d3\u00f4\u00d4\u00f5\u00d5\u00f6\u00d6]',
  u: '[uU\u00f9\u00d9\u00fa\u00da\u00fb\u00db\u00fc\u00dc]',
  y: '[yY\u00fd\u00dd\u00ff]'
};

// 2. Text Normalization
export const normalizeText = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

export const lowercaseText = (text) => String(text ?? '').toLowerCase();

export const removeAccents = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

// 3. Text Whitespace
export const normalizeWhitespace = (text) => String(text ?? '')
  .replace(/\s+/g, ' ')
  .trim();

// 4. Query Tokenization
export const tokenizeQuery = (query) => {
  const normalized = normalizeText(query);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
};

// 5. Regex Helpers
export const escapeRegex = (text) => String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildKeywordRegex = (text) => {
  const normalized = normalizeText(text);
  const pattern = [...normalized]
    .map((character) => ACCENT_VARIANTS[character] || escapeRegex(character))
    .join('');

  return new RegExp(pattern, 'i');
};

export const buildPartialMatchRegex = (text) => buildKeywordRegex(text);

// 6. Search Matching
export const textMatchesKeywords = (text, query) => {
  const normalizedText = normalizeText(text);
  return tokenizeQuery(query).every((token) =>
    buildKeywordRegex(token).test(normalizedText)
  );
};
