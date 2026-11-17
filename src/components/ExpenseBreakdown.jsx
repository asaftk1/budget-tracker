import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import Money, { displayMoney } from './Money';
import { groupSlices } from './groupSlices';
import { CHART_COLORS } from '../constants';

// Expense breakdown: a donut with the total in the middle and an always-visible list with the
// amount, share and a bar for every slice, so colour is never the only way to read it.
//   data:  [{ name, value }] with value in integer agorot
//   total: the expense total in agorot, shown in the middle and used for the shares
// Only the biggest categories get their own slice; the rest are merged into "other" here, for
// display. The numbers themselves are not changed.
export default function ExpenseBreakdown({ data, total, maxSlices = 8 }) {
  const slices = useMemo(() => groupSlices(data, maxSlices, 'אחר'), [data, maxSlices]);
  const colorOf = (slice, index) => (slice.isOther ? CHART_COLORS.other : CHART_COLORS.palette[index % CHART_COLORS.palette.length]);
  const share = (value) => (value / (total || 1)) * 100;

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-center">
      {/* The list next to it carries the same information, so the picture is hidden from
          screen readers. */}
      <div className="relative mx-auto h-64 w-full max-w-xs shrink-0 md:mx-0 md:w-64" dir="ltr" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {slices.map((slice, index) => (
                <Cell key={slice.name} fill={colorOf(slice, index)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => [displayMoney(value), props.payload.name]}
              contentStyle={{ direction: 'rtl', borderRadius: 12, borderColor: CHART_COLORS.grid }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">סה״כ הוצאות</span>
          <Money agorot={total} className="text-lg font-bold text-foreground" />
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-3">
        {slices.map((slice, index) => {
          const percent = share(slice.value);
          const color = colorOf(slice, index);
          return (
            <li key={slice.name} className="flex items-start gap-3">
              <span className="mt-1.5 size-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {slice.name}
                    {slice.isOther && ` (${slice.count} קטגוריות)`}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    <Money agorot={slice.value} />
                    {' · '}
                    <span dir="ltr" className="inline-block tabular-nums">{percent.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
