import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { displayMoney } from './Money';
import { CHART_COLORS } from '../constants';

// Income and expense bars side by side, shared by the Dashboard and Analytics.
//   data:       rows with the x label and two values in shekels (chart libraries take shekels)
//   xKey, incomeKey, expenseKey: field names in each row
//   incomeName, expenseName:     legend and tooltip labels
//   ariaLabel:  what the picture shows, for screen readers
// Values are shown through formatMoney (shekel sign, thousands separators, whole shekels on the
// axis). The chart is drawn left to right; the x and value axes are mirrored so it reads from
// the right, like the page.
const toText = (shekels, options) => displayMoney(Math.round(shekels * 100), options);

export default function IncomeExpenseBars({
  data, xKey, incomeKey, expenseKey, incomeName, expenseName, ariaLabel, height = 280, maxBarSize = 28,
}) {
  return (
    <div dir="ltr" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barGap={4} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey={xKey}
            reversed
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
          />
          <YAxis
            orientation="right"
            width={88}
            domain={[0, 'auto']}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            tickFormatter={(v) => toText(v, { fractionDigits: 0 })}
          />
          <Tooltip
            formatter={(v) => toText(v)}
            cursor={{ fill: 'rgba(20, 32, 26, 0.04)' }}
            contentStyle={{ direction: 'rtl', borderRadius: 12, borderColor: CHART_COLORS.grid }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ direction: 'rtl', paddingBottom: 8 }}
          />
          <Bar dataKey={incomeKey} fill={CHART_COLORS.income} name={incomeName} radius={[6, 6, 0, 0]} maxBarSize={maxBarSize} />
          <Bar dataKey={expenseKey} fill={CHART_COLORS.expense} name={expenseName} radius={[6, 6, 0, 0]} maxBarSize={maxBarSize} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
