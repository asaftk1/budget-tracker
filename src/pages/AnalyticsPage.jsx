// src/pages/AnalyticsPage.jsx
import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import PageState from '../components/PageState';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import ExpenseBreakdown from '../components/ExpenseBreakdown';
import IncomeExpenseBars from '../components/IncomeExpenseBars';
import { fromAgorot } from '../lib/money';
import { summarizeTransactions } from '../lib/summaries';

export default function AnalyticsPage() {
  const { transactions, loading, error } = useData();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      return (!fromDate || tx.date >= fromDate) && (!toDate || tx.date <= toDate);
    });
  }, [transactions, fromDate, toDate]);

  // One pass over the filtered transactions: per-category expenses and the income/expense totals,
  // all in integer agorot.
  const { expensesByCategory, totalIncome, totalExpense } = useMemo(
    () => summarizeTransactions(filtered),
    [filtered]
  );
  const totalExpenses = totalExpense;

  const pieData = useMemo(() => {
    const entries = Object.entries(expensesByCategory)
      .map(([category, value]) => ({ name: category, value }))
      .sort((a, b) => b.value - a.value);
    return entries;
  }, [expensesByCategory]);

  // The bar chart takes shekels; the sums themselves are exact agorot.
  const chartData = useMemo(() => [{
    name: 'סיכום',
    הכנסות: fromAgorot(totalIncome),
    הוצאות: fromAgorot(totalExpense)
  }], [totalIncome, totalExpense]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">ניתוח נתונים</h1>
      <PageState
        loading={loading}
        error={error}
        hasData={transactions.length > 0}
        isEmpty={transactions.length === 0}
        emptyMessage="אין נתונים להצגה עדיין. הוסף/י פעולות כדי לראות ניתוח."
      >
      <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="analytics-from">מתאריך:</Label>
          <Input id="analytics-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="analytics-to">עד תאריך:</Label>
          <Input id="analytics-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Expense breakdown by category */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon size={20} className="text-muted-foreground" aria-hidden="true" />
              פילוח הוצאות לפי קטגוריה
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ExpenseBreakdown data={pieData} total={totalExpenses} />
            ) : (
              <p className="text-center text-muted-foreground">אין נתונים</p>
            )}
          </CardContent>
        </Card>

        {/* Expenses against income */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} className="text-muted-foreground" aria-hidden="true" />
              הוצאות מול הכנסות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseBars
              data={chartData}
              xKey="name"
              incomeKey="הכנסות"
              expenseKey="הוצאות"
              incomeName="הכנסות"
              expenseName="הוצאות"
              ariaLabel="גרף עמודות של סך ההכנסות מול סך ההוצאות בטווח שנבחר"
              height={300}
              maxBarSize={64}
            />
          </CardContent>
        </Card>
      </div>
      </PageState>
    </div>
  );
}
