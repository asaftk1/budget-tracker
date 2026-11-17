// src/insights/useSuggestions.js
import { useMemo } from "react";
import dayjs from "dayjs";
import { getAgorot, fromAgorot, formatMoney } from "../lib/money";
import { TYPE } from "../constants";

// Thresholds in agorot (amounts below are integer agorot until displayed or scored).
const SPIKE_MIN_AGOROT = 200 * 100;
const BIG_ONE_MIN_AGOROT = 500 * 100;

const wholeShekels = (agorot) => formatMoney(agorot, { fractionDigits: 0 });

// Month key YYYY-MM ("unknown" for an invalid date).
function byMonth(dateStr) {
  const d = dayjs(dateStr);
  return d.isValid() ? d.format("YYYY-MM") : "unknown";
}

function normalize(str = "") {
  return String(str).trim().toLowerCase();
}

// A charge counts as recurring only if it shows up in this many different months...
const SUBSCRIPTION_MIN_MONTHS = 3;
// ...with monthly totals within 10% of the typical (median) month, but never tighter than 5 ILS,
// so small subscriptions that change price slightly still count.
const SIMILAR_AMOUNT_RATIO = 0.1;
const SIMILAR_AMOUNT_MIN_AGOROT = 5 * 100;

const median = (sortedNumbers) => {
  const mid = Math.floor(sortedNumbers.length / 2);
  return sortedNumbers.length % 2 ? sortedNumbers[mid] : (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2;
};

// Find merchants billed in a similar amount in several different months.
// Transactions are grouped by merchant; those without a merchant (manual entries) fall back to
// their category. Returns [{ label, avgAgorot, months }] for each recurring charge.
export function findRecurringCharges(expenses) {
  const groups = new Map(); // key -> { label, monthTotals: { "YYYY-MM": agorot } }

  for (const t of expenses) {
    const month = byMonth(t.date);
    if (month === "unknown") continue;

    const key = normalize(t.merchant) || normalize(t.category);
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, { label: String(t.merchant || t.category).trim(), monthTotals: {} });
    }
    const totals = groups.get(key).monthTotals;
    totals[month] = (totals[month] || 0) + getAgorot(t);
  }

  const result = [];
  for (const { label, monthTotals } of groups.values()) {
    const amounts = Object.values(monthTotals).filter((v) => v > 0);
    if (amounts.length < SUBSCRIPTION_MIN_MONTHS) continue;

    const typical = median([...amounts].sort((x, y) => x - y));
    const tolerance = Math.max(typical * SIMILAR_AMOUNT_RATIO, SIMILAR_AMOUNT_MIN_AGOROT);
    const similar = amounts.filter((v) => Math.abs(v - typical) <= tolerance);
    if (similar.length < SUBSCRIPTION_MIN_MONTHS) continue;

    result.push({
      label,
      avgAgorot: similar.reduce((sum, v) => sum + v, 0) / similar.length,
      months: similar.length,
    });
  }
  return result;
}

// Pure computation behind the hook, exported for tests.
export function buildSuggestions(transactions = []) {
    if (!transactions.length) return [];

    // רק הוצאות
    const expenses = transactions.filter(t => t.type === TYPE.EXPENSE);

    // 1) Recurring charges (subscriptions): the same merchant billed a similar amount in
    //    at least SUBSCRIPTION_MIN_MONTHS different months.
    const recurring = findRecurringCharges(expenses).map(({ label, avgAgorot }) => {
      const avg = fromAgorot(avgAgorot);
      return {
        kind: "subscription",
        score: Math.min(100, Math.round(avg)), // rough ranking by monthly size
        title: `נראה שיש חיוב קבוע ב"${label}"`,
        detail: `ממוצע חודשי ~ ${wholeShekels(avgAgorot)}. שווה לבדוק אם אפשר לבטל/להוזיל.`,
        meta: { merchant: label, avgMonthly: avg }
      };
    });

    // 2) עליה חריגה בקטגוריה חודשית (MoM)
    const byCatMonth = {};
    for (const t of expenses) {
      const cat = normalize(t.category);
      const m = byMonth(t.date);
      const key = `${cat}__${m}`;
      byCatMonth[key] = (byCatMonth[key] || 0) + getAgorot(t);
    }
    // בונים סכומים פר חודש לכל קטגוריה
    const catMonths = {};
    Object.entries(byCatMonth).forEach(([key, sum]) => {
      const [cat, mm] = key.split("__");
      if (!catMonths[cat]) catMonths[cat] = {};
      catMonths[cat][mm] = sum;
    });
    const mom = [];
    Object.entries(catMonths).forEach(([cat, monthsObj]) => {
      const months = Object.keys(monthsObj).sort(); // YYYY-MM
      for (let i = 1; i < months.length; i++) {
        const prev = months[i-1];
        const curr = months[i];
        const prevVal = monthsObj[prev] || 0;
        const currVal = monthsObj[curr] || 0;
        if (prevVal > 0) {
          const delta = currVal - prevVal;
          const pct = (delta / prevVal) * 100;
          if (pct >= 40 && currVal >= SPIKE_MIN_AGOROT) { // טריגר: עלייה >=40% וסכום משמעותי
            mom.push({
              kind: "mom_spike",
              score: Math.min(100, Math.round(fromAgorot(currVal) / 10)),
              title: `עלייה חדה ב"${cat}"`,
              detail: `חודש ${curr} עלה ב־${pct.toFixed(0)}% (${wholeShekels(currVal)} לעומת ${wholeShekels(prevVal)}).`,
              meta: { cat, curr, currVal: fromAgorot(currVal), prevVal: fromAgorot(prevVal), pct }
            });
          }
        }
      }
    });

    // 3) הוצאות חד־פעמיות גדולות (Outliers)
    const amounts = expenses.map(getAgorot).sort((a,b)=>a-b);
    const p90 = amounts[Math.floor(0.9 * amounts.length)] || 0;
    const bigOnes = expenses
      .filter(e => getAgorot(e) >= p90 && getAgorot(e) >= BIG_ONE_MIN_AGOROT)
      .sort((a, b) => getAgorot(b) - getAgorot(a))
      .map(e => ({
        kind: "big_one",
        score: Math.min(100, Math.round(fromAgorot(getAgorot(e)) / 20)),
        title: `עסקה גדולה: ${e.category}`,
        detail: `${wholeShekels(getAgorot(e))} ב־${dayjs(e.date).format("DD/MM/YYYY")}. אפשר לפרוס/להוזיל/להשוות מחירים.`,
        meta: { category: e.category, amount: fromAgorot(getAgorot(e)), date: e.date }
      }))
      .slice(0, 3);

    // 4) “עמלות/ריבית/משיכת מזומן” – דגלים
    const flags = expenses
      .filter(e => /עמלה|ריבית|משיכה|fee|interest/i.test(e.category))
      .map(e => ({
        kind: "fees",
        score: 60,
        title: `תשלום מסווג כעמלה/ריבית: ${e.category}`,
        detail: `${wholeShekels(getAgorot(e))} – בדוק אפשרויות לביטול עמלות/החלפת מסלול.`,
        meta: { category: e.category, amount: fromAgorot(getAgorot(e)), date: e.date }
      }));

    // מאחדים ומדרגים
    const suggestions = [...recurring, ...mom, ...bigOnes, ...flags]
      .sort((a,b)=>b.score - a.score)
      .slice(0, 10);

    return suggestions;
}

export default function useSuggestions(transactions = []) {
  return useMemo(() => buildSuggestions(transactions), [transactions]);
}
