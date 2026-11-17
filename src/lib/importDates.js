// Date helpers for credit-card statement imports.

const pad2 = (n) => String(n).padStart(2, '0');

// Format a Date as "YYYY-MM-DD" using its LOCAL parts. Do not use toISOString():
// it converts to UTC and shifts local-midnight dates back one day east of UTC.
export function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Last day of the month before the month of dateStr ("YYYY-MM-DD").
export function getLastDayOfPreviousMonth(dateStr) {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(String(dateStr ?? ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  // Day 0 of this month is the last day of the previous month.
  return formatLocalDate(new Date(year, month - 1, 0));
}

// Charge date ("YYYY-MM-DD") for an Isracard statement.
// billingStr is "DD.MM" from the statement header (or null); the fallback is the 10th
// of the header month.
export function computeIsracardChargeDate({ headerYear, headerMonth, billingStr }) {
  let chargeDate = null;
  if (billingStr) {
    const [ddStr, mmStr] = billingStr.split('.');
    const dd = parseInt(ddStr, 10);
    const mm = parseInt(mmStr, 10);

    if (!Number.isNaN(dd) && !Number.isNaN(mm)) {
      chargeDate = new Date(headerYear, mm - 1, dd);
    }
  }

  if (!chargeDate) {
    chargeDate = new Date(headerYear, headerMonth - 1, 10);
  }

  return formatLocalDate(chargeDate);
}
