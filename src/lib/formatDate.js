// "2026-10-31" -> "31/10/2026" for display. Works on the string, not on a Date, so the time zone
// cannot shift the day. Anything that is not YYYY-MM-DD (optionally followed by a time) comes
// back unchanged; a missing value gives an empty string.
export function formatDisplayDate(isoDate) {
  if (isoDate === null || isoDate === undefined) return '';
  const text = String(isoDate);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}
