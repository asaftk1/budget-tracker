import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart3, Clock, PieChart as PieChartIcon, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Suggestions from '../components/Suggestions';
import Money, { displayMoney } from '../components/Money';
import ExpenseBreakdown from '../components/ExpenseBreakdown';
import { formatDisplayDate } from '../lib/formatDate';
import dayjs from 'dayjs';
import { useData } from '../contexts/DataContext';
import PageState from '../components/PageState';
import { getAgorot, fromAgorot } from '../lib/money';
import { summarizeTransactions, monthKeyOf } from '../lib/summaries';
import { TYPE, CHART_COLORS } from '../constants';

export default function Dashboard() {
    const { transactions, loading, error } = useData();

    // One pass over the transactions for everything the page shows. Money stays in integer
    // agorot until it is displayed or handed to a chart.
    const currentMonth = dayjs().format('YYYY-MM');
    const { totalIncome, totalExpense, expensesByCategory, chartData } = useMemo(() => {
        // The last six months, oldest first.
        const months = Array.from({ length: 6 }, (_, i) => {
            const date = dayjs().startOf('month').subtract(5 - i, 'month').toDate();
            return { key: monthKeyOf(date), label: date.toLocaleString('he-IL', { month: 'short' }) };
        });

        const summary = summarizeTransactions(transactions, months.map(m => m.key));

        // Charts take shekels; the sums themselves are exact agorot.
        return {
            ...summary,
            chartData: months.map(({ key, label }) => ({
                month: label,
                income: fromAgorot(summary.monthly[key].income),
                expense: fromAgorot(summary.monthly[key].expense),
            })),
        };
        // currentMonth makes the six-month window roll over when the month changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transactions, currentMonth]);

    const balance = totalIncome - totalExpense;

    const pieData = useMemo(
        () => Object.entries(expensesByCategory).map(([category, value]) => ({ name: category, value })),
        [expensesByCategory]
    );
    // The five most recent transactions.
    const recentTransactions = useMemo(
        () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
        [transactions]
    );

    // Chart values are shekels; the tooltip and the axis show them through formatMoney.
    const shekelsToText = (shekels, options) => displayMoney(Math.round(shekels * 100), options);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">מעקב הוצאות והכנסות</h1>

            <PageState
                loading={loading}
                error={error}
                hasData={transactions.length > 0}
                isEmpty={transactions.length === 0}
                emptyMessage="אין עדיין פעולות. הוסף/י פעולה או ייבא/י קובץ אשראי בעמוד הפעולות."
            >

            {/* Balance cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary" aria-hidden="true">
                            <Wallet size={20} />
                        </span>
                        <p className="text-sm font-medium text-muted-foreground">יתרה נוכחית</p>
                    </div>
                    <p className={`mt-3 text-3xl font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
                        <Money agorot={balance} />
                    </p>
                </Card>
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-income/10 text-income" aria-hidden="true">
                            <TrendingUp size={20} />
                        </span>
                        <p className="text-sm font-medium text-muted-foreground">סה״כ הכנסות</p>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-income"><Money agorot={totalIncome} /></p>
                </Card>
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-expense/10 text-expense" aria-hidden="true">
                            <TrendingDown size={20} />
                        </span>
                        <p className="text-sm font-medium text-muted-foreground">סה״כ הוצאות</p>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-expense"><Money agorot={totalExpense} /></p>
                </Card>
            </div>

            {/* Chart and recent transactions */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* Income vs Expense Chart */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 size={20} className="text-muted-foreground" aria-hidden="true" />
                            הכנסות מול הוצאות (6 חודשים אחרונים)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* The chart is drawn left to right; the time axis and the value axis are
                            mirrored below so it reads from the right, like the page. */}
                        <div dir="ltr" role="img" aria-label="גרף עמודות של הכנסות והוצאות בששת החודשים האחרונים">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={chartData} barGap={4} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                                    <XAxis
                                        dataKey="month"
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
                                        tickFormatter={(v) => shekelsToText(v, { fractionDigits: 0 })}
                                    />
                                    <Tooltip
                                        formatter={(v) => shekelsToText(v)}
                                        cursor={{ fill: 'rgba(20, 32, 26, 0.04)' }}
                                        contentStyle={{ direction: 'rtl', borderRadius: 12, borderColor: CHART_COLORS.grid }}
                                    />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        iconType="circle"
                                        wrapperStyle={{ direction: 'rtl', paddingBottom: 8 }}
                                    />
                                    <Bar dataKey="income" fill={CHART_COLORS.income} name="הכנסה" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="expense" fill={CHART_COLORS.expense} name="הוצאה" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock size={20} className="text-muted-foreground" aria-hidden="true" />
                            פעולות אחרונות
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="divide-y">
                            {recentTransactions.map((tx) => (
                                <li key={tx.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-foreground">{tx.category || '—'}</p>
                                        <p className="text-sm text-muted-foreground">{formatDisplayDate(tx.date)}</p>
                                    </div>
                                    <Money
                                        agorot={getAgorot(tx)}
                                        prefix={tx.type === TYPE.INCOME ? '+' : '-'}
                                        className={`shrink-0 font-semibold ${tx.type === TYPE.INCOME ? 'text-income' : 'text-expense'}`}
                                    />
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>

            {/* Expense breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieChartIcon size={20} className="text-muted-foreground" aria-hidden="true" />
                        פילוח הוצאות לפי קטגוריה
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {pieData.length > 0 ? (
                        <ExpenseBreakdown data={pieData} total={totalExpense} />
                    ) : (
                        <p className="text-center text-muted-foreground">אין עדיין הוצאות להצגה</p>
                    )}
                </CardContent>
            </Card>

            {/* Saving suggestions, computed locally */}
            <Suggestions transactions={transactions} />
            </PageState>
        </div>
    );
}
