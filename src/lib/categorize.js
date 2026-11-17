// Merchant -> category inference for credit-card imports.
// Category names and keywords below are user-facing Hebrew data.

export const normalizeMerchantName = (name) => (name || '').trim().toLowerCase();

// Built-in keyword rules, checked in order; first match wins.
const RULES = [
  { keywords: ['שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'קרפור', 'מחסני השוק', 'אושר עד', 'טיב טעם', 'סיטי מרקט', 'מגה', 'יש בשכונה'], category: 'מזון וצריכה' },
  { keywords: ['סופר פארם', 'סופר-פארם', 'superpharm', 'גוד פארם', 'pharm', 'בית מרקחת', 'רוקח'], category: 'פארם וטיפוח' },
  { keywords: ['פז', 'דור אלון', 'סונול', 'דלק', 'yellow', 'ten', 'טן', 'אקסון', 'חניון', 'קנגורו'], category: 'דלק ורכב' },
  { keywords: ['ארומה', 'מקדונלד', 'מקדונלס', 'בורגר', 'קפה', 'מסעד', 'רולדין', 'greg', 'גרג', 'פיצה', 'סושי', 'שווארמה', 'פלאפל', 'מאפייה', 'בית קפה', 'שוק', 'אוכל', 'wolt', 'וולט', 'טעים', 'ברבהר', 'נונה'], category: 'מסעדות ובתי קפה' },
  { keywords: ['fox', 'zara', 'hm', 'h&m', 'castro', 'terminal x', 'טרמינל', 'מנגו', 'pull', 'bear', 'להב', 'bbw', 'victorias'], category: 'ביגוד והנעלה' },
  { keywords: ['אייבורי', 'ksp', 'מחסני חשמל', 'באג', 'bug', 'ivory', 'apple', 'samsung', 'אפל'], category: 'חשמל ואלקטרוניקה' },
  { keywords: ['אגד', 'רכבת', 'דן', 'gett', 'yango', 'פנגו', 'cellopark', 'מונית', 'אוטובוס'], category: 'תחבורה' },
  { keywords: ['בזק', 'סלקום', 'פרטנר', 'הוט', 'yes', ' 012', 'רשת'], category: 'תקשורת' },
  { keywords: ['חשמל', 'מים', 'ארנונה', 'גז', 'ועד בית'], category: 'חשבונות' },
  { keywords: ['ביטוח', 'מגדל', 'הראל', 'כלל', 'מנורה', 'איי.די.איי', 'ישיר'], category: 'ביטוח' },
  { keywords: ['בנק', 'העברה', 'bit', 'ביט', 'paybox', 'פייבוקס'], category: 'העברות כספים' },
  { keywords: ['netflix', 'spotify', 'disney', 'apple tv', 'youtube', 'openai', 'chatgpt', 'google', 'amazon', 'prime', 'patreon'], category: 'מנויים דיגיטליים' },
  { keywords: ['סופר פארם', 'מכבי', 'קופת חולים', 'רופא', 'מרפאה', 'שיניים', 'אופטיקה'], category: 'בריאות' },
];

// Returns a category for the merchant, or '' when nothing matches.
// Order: the user's saved choice for this merchant first, then the built-in rules.
// merchantCategoryMap: Map<normalizedMerchant, category> (may be null/undefined).
export function categorizeMerchant(merchant, merchantCategoryMap) {
  const normalized = normalizeMerchantName(merchant);
  if (!normalized) return '';

  const saved = merchantCategoryMap?.get(normalized);
  if (saved) return saved;

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      return rule.category;
    }
  }

  return '';
}
