// Presentation helper for the expense donut: biggest categories first, and everything past
// maxSlices is merged into one "other" slice so the chart stays readable. Values are integer
// agorot and are only added together, so the slices always sum to exactly the input total.
//
//   entries:    [{ name, value }]
//   maxSlices:  how many categories keep their own slice
//   otherLabel: name of the merged slice
// A lone leftover category is kept as it is; "other" never hides just one item.
export function groupSlices(entries, maxSlices = 8, otherLabel = 'other') {
  const sorted = [...(entries || [])].sort((a, b) => b.value - a.value);
  if (sorted.length <= maxSlices + 1) return sorted.map((e) => ({ ...e, isOther: false }));

  const head = sorted.slice(0, maxSlices).map((e) => ({ ...e, isOther: false }));
  const tail = sorted.slice(maxSlices);
  const value = tail.reduce((sum, e) => sum + e.value, 0);
  return [...head, { name: otherLabel, value, isOther: true, count: tail.length }];
}
