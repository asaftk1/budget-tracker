import { groupSlices } from './groupSlices';

const make = (n) => Array.from({ length: n }, (_, i) => ({ name: `c${i}`, value: (i + 1) * 105 }));
const sum = (items) => items.reduce((s, e) => s + e.value, 0);

describe('groupSlices', () => {
  test('sorts biggest first and leaves a short list alone', () => {
    const out = groupSlices([{ name: 'a', value: 5 }, { name: 'b', value: 9 }], 8);
    expect(out.map((e) => e.name)).toEqual(['b', 'a']);
    expect(out.every((e) => e.isOther === false)).toBe(true);
  });

  test('merges the tail into one other slice and the total stays identical', () => {
    const input = make(25);
    const out = groupSlices(input, 8, 'other');
    expect(out).toHaveLength(9);
    expect(out[8]).toMatchObject({ name: 'other', isOther: true, count: 17 });
    expect(sum(out)).toBe(sum(input));
    expect(out.slice(0, 8).map((e) => e.name)).toEqual(['c24', 'c23', 'c22', 'c21', 'c20', 'c19', 'c18', 'c17']);
  });

  test('keeps a single leftover category instead of hiding it in other', () => {
    const out = groupSlices(make(9), 8);
    expect(out).toHaveLength(9);
    expect(out.some((e) => e.isOther)).toBe(false);
    expect(groupSlices(make(10), 8).some((e) => e.isOther)).toBe(true);
  });

  test('does not change its input and handles empty input', () => {
    const input = make(12);
    const copy = JSON.parse(JSON.stringify(input));
    groupSlices(input, 8);
    expect(input).toEqual(copy);
    expect(groupSlices(undefined)).toEqual([]);
  });

  test('exact agorot: sums of random data are preserved', () => {
    for (let k = 0; k < 50; k += 1) {
      const input = Array.from({ length: 30 }, (_, i) => ({ name: `n${i}`, value: Math.floor(Math.random() * 1e7) }));
      expect(sum(groupSlices(input, 8))).toBe(sum(input));
    }
  });
});
