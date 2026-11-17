// src/insights/useSuggestions.js
import { useMemo } from "react";
import dayjs from "dayjs";
import { getAgorot, fromAgorot, formatMoney } from "../lib/money";
import { TYPE } from "../constants";

// Thresholds in agorot (amounts below are integer agorot until displayed or scored).
const SPIKE_MIN_AGOROT = 200 * 100;
const BIG_ONE_MIN_AGOROT = 500 * 100;

const wholeShekels = (agorot) => formatMoney(agorot, { fractionDigits: 0 });

// עזר: קיבוץ לפי חודש YYYY-MM
function byMonth(dateStr) {
  const d = dayjs(dateStr);
  return d.isValid() ? d.format("YYYY-MM") : "unknown";
}

function normalize(str = "") {
  return String(str).trim().toLowerCase();
}

// Pure computation behind the hook, exported for tests.
export function buildSuggestions(transactions = []) {
    if (!transactions.length) return [];

    // רק הוצאות
    const expenses = transactions.filter(t => t.type === TYPE.EXPENSE);

    // 1) זיהוי חיובים חוזרים (מנויים/סבסקריפשנים)
    const byMerchant = {};
    for (const t of expenses) {
      const key = normalize(t.category); // אם יש לך merchant ממש – החלף לכאן
      if (!byMerchant[key]) byMerchant[key] = [];
      byMerchant[key].push(t);
    }
    const recurring = Object.entries(byMerchant)
      .filter(([_, arr]) => {
        // הופיע לפחות 3 חודשים שונים
        const months = new Set(arr.map(a => byMonth(a.date)));
        return months.size >= 3;
      })
      .map(([merchant, arr]) => {
        const perMonth = {};
        for (const a of arr) {
          const m = byMonth(a.date);
          perMonth[m] = (perMonth[m] || 0) + getAgorot(a);
        }
        const avgAgorot = Object.values(perMonth).reduce((s, v) => s + v, 0) / Object.keys(perMonth).length;
        const avg = fromAgorot(avgAgorot);
        return {
          kind: "subscription",
          score: Math.min(100, Math.round(avg)), // דירוג גס לפי גודל חודשי
          title: `נראה שיש חיוב קבוע ב"${merchant}"`,
          detail: `ממוצע חודשי ~ ${wholeShekels(avgAgorot)}. שווה לבדוק אם אפשר לבטל/להוזיל.`,
          meta: { merchant, avgMonthly: avg }
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
