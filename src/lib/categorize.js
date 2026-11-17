// Merchant -> category inference for credit-card imports.
// Category names and keywords below are user-facing Hebrew data.

export const normalizeMerchantName = (name) => (name || '').trim().toLowerCase();

// Built-in keyword rules, checked in order; first match wins.
// Keywords of SHORT_KEYWORD_MAX characters or fewer must match as whole words ("ten" must not
// match "attention"); longer keywords match anywhere in the name. More specific rules come
// before more general ones: digital subscriptions before electronics ("Apple TV" vs "Apple"),
// pharmacies before health, and electronics before household bills ("מחסני חשמל" vs "חשמל").
const SHORT_KEYWORD_MAX = 4;

const RULES = [
  { keywords: ['שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'קרפור', 'מחסני השוק', 'אושר עד', 'טיב טעם', 'סיטי מרקט', 'מגה', 'יש בשכונה'], category: 'מזון וצריכה' },
  { keywords: ['סופר פארם', 'סופר-פארם', 'גוד פארם', 'pharm', 'בית מרקחת', 'רוקח'], category: 'פארם וטיפוח' },
  { keywords: ['פז', 'דור אלון', 'סונול', 'דלק', 'yellow', 'ten', 'טן', 'אקסון', 'חניון', 'קנגורו'], category: 'דלק ורכב' },
  { keywords: ['ארומה', 'מקדונלד', 'מקדונלס', 'בורגר', 'קפה', 'מסעד', 'רולדין', 'greg', 'גרג', 'פיצה', 'סושי', 'שווארמה', 'פלאפל', 'מאפייה', 'בית קפה', 'שוק', 'אוכל', 'wolt', 'וולט', 'טעים', 'ברבהר', 'נונה'], category: 'מסעדות ובתי קפה' },
  { keywords: ['fox', 'zara', 'hm', 'h&m', 'castro', 'terminal x', 'טרמינל', 'מנגו', 'pull', 'bear', 'להב', 'bbw', 'victorias'], category: 'ביגוד והנעלה' },
  { keywords: ['netflix', 'spotify', 'disney', 'apple tv', 'youtube', 'openai', 'chatgpt', 'google', 'amazon', 'prime', 'patreon'], category: 'מנויים דיגיטליים' },
  { keywords: ['אייבורי', 'ksp', 'מחסני חשמל', 'באג', 'bug', 'ivory', 'apple', 'samsung', 'אפל'], category: 'חשמל ואלקטרוניקה' },
  { keywords: ['אגד', 'רכבת', 'דן', 'gett', 'yango', 'פנגו', 'cellopark', 'מונית', 'אוטובוס'], category: 'תחבורה' },
  { keywords: ['בזק', 'סלקום', 'פרטנר', 'הוט', 'yes', '012', 'רשת'], category: 'תקשורת' },
  { keywords: ['חשמל', 'מים', 'ארנונה', 'גז', 'ועד בית'], category: 'חשבונות' },
  { keywords: ['ביטוח', 'מגדל', 'הראל', 'כלל', 'מנורה', 'איי.די.איי', 'ישיר'], category: 'ביטוח' },
  { keywords: ['בנק', 'העברה', 'bit', 'ביט', 'paybox', 'פייבוקס'], category: 'העברות כספים' },
  { keywords: ['מכבי', 'כללית', 'קופת חולים', 'רופא', 'מרפאה', 'שיניים', 'אופטיקה'], category: 'בריאות' },
];

const isWordChar = (ch) => /[\p{L}\p{N}]/u.test(ch);
const startsWithHebrew = (token) => /^[\u0590-\u05FF]/.test(token);

// Hebrew attaches one-letter prefixes to words: the (ה), in (ב), to (ל), as (כ), from (מ),
// that (ש), and (ו). "החשמל" must still match the keyword "חשמל".
const HEBREW_PREFIXES = 'הבלכמשו';

// True when token occurs in text as a whole word: no letter or digit directly after it, and
// none directly before it (except one Hebrew prefix letter at the start of a Hebrew word).
// (\b does not work for Hebrew, and lookbehind is not available in older Safari.)
function includesWholeToken(text, token) {
  const allowPrefix = startsWithHebrew(token);
  let from = 0;
  for (;;) {
    const index = text.indexOf(token, from);
    if (index === -1) return false;

    const before = index === 0 ? '' : text[index - 1];
    const after = text[index + token.length] || '';
    const startsWord =
      !before ||
      !isWordChar(before) ||
      (allowPrefix && HEBREW_PREFIXES.includes(before) && (index === 1 || !isWordChar(text[index - 2])));

    if (startsWord && !(after && isWordChar(after))) return true;
    from = index + 1;
  }
}

// Rules compiled once at module load: each keyword becomes a predicate on the normalised name.
const COMPILED_RULES = RULES.map(({ keywords, category }) => ({
  category,
  matchers: keywords.map((keyword) => {
    const token = keyword.trim().toLowerCase();
    return Array.from(token).length <= SHORT_KEYWORD_MAX
      ? (text) => includesWholeToken(text, token)
      : (text) => text.includes(token);
  }),
}));

// Returns a category for the merchant, or '' when nothing matches.
// Order: the user's saved choice for this merchant first, then the built-in rules.
// merchantCategoryMap: Map<normalizedMerchant, category> (may be null/undefined).
export function categorizeMerchant(merchant, merchantCategoryMap) {
  const normalized = normalizeMerchantName(merchant);
  if (!normalized) return '';

  const saved = merchantCategoryMap?.get(normalized);
  if (saved) return saved;

  for (const rule of COMPILED_RULES) {
    if (rule.matchers.some((matches) => matches(normalized))) return rule.category;
  }

  return '';
}
