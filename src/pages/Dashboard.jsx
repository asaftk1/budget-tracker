import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { getAuth } from 'firebase/auth';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import Suggestions from '../components/Suggestions';
import dayjs from 'dayjs';
import { getAgorot, fromAgorot, formatMoney } from '../lib/money';
import { summarizeTransactions, monthKeyOf } from '../lib/summaries';
import { TYPE, CHART_COLORS } from '../constants';

export default function Dashboard() {
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, 'transactions'), where('uid', '==', user.uid));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(data);
        });

        return () => unsub();
    }, []);

    // One pass over the transactions for everything the page shows. Money stays in integer
    // agorot until it is displayed or handed to a chart.
    const currentMonth = dayjs().format('YYYY-MM');
    const { totalIncome, totalExpense, expensesByCategory, chartData } = useMemo(() => {
        // The last six months, oldest first.
        const months = Array.from({ length: 6 }, (_, i) => {
            const date = dayjs().startOf('month').subtract(5 - i, 'month').toDate();
            return { key: monthKeyOf(date), label: date.toLocaleString('default', { month: 'short' }) };
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

    const COLORS = CHART_COLORS.palette;
    const pieData = useMemo(
        () => Object.entries(expensesByCategory).map(([category, value]) => ({ name: category, value })),
        [expensesByCategory]
    );
    const totalExpenses = totalExpense;

    // The five most recent transactions.
    const recentTransactions = useMemo(
        () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
        [transactions]
    );

    return (
        <div dir="rtl" className="min-h-screen bg-gray-50 p-6">
            <h1 className="text-2xl font-bold mb-6">מעקב הוצאות והכנסות</h1>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>יתרה נוכחית</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(balance)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>סה״כ הכנסות</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-500">{formatMoney(totalIncome)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>סה״כ הוצאות</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-500">{formatMoney(totalExpense)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Recent Transactions */}
                <Card>
                    <CardHeader>
                        <CardTitle>📋 פעולות אחרונות</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {recentTransactions
                                .map((tx) => (
                                    <li key={tx.id} className="flex justify-between">
                                        <div>
                                            <p className="font-semibold">{tx.category}</p>
                                            <p className="text-sm text-gray-500">{tx.date}</p>
                                        </div>
                                        <span className={`font-bold ${tx.type === TYPE.INCOME ? 'text-green-600' : 'text-red-500'}`}>
                                            {tx.type === TYPE.INCOME ? '+' : '-'}{formatMoney(getAgorot(tx))}
                                        </span>
                                    </li>
                                ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Income vs Expense Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>📊 הכנסות מול הוצאות (6 חודשים אחרונים)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={chartData}>
                                <XAxis dataKey="month" />
                                <YAxis domain={[0, 'dataMax + 2000']} tick={{ textAnchor: 'start', dx: -10 }} />
                                <Tooltip />
                                <Bar dataKey="income" fill={CHART_COLORS.income} name="הכנסה" />
                                <Bar dataKey="expense" fill={CHART_COLORS.expense} name="הוצאה" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>



            {/* Pie + list */}
            <div className="grid grid-cols-1">
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>🧾 פילוח הוצאות לפי קטגוריה</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pieData.length > 0 ? (
                            <div className="flex flex-col md:flex-row items-start justify-center gap-8">
                                <ResponsiveContainer width={300} height={300}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {pieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value, name, props) => [formatMoney(value), props.payload.name]} />
                                    </PieChart>
                                </ResponsiveContainer>

                                <ul className="text-sm text-right max-h-[300px] overflow-y-auto pr-4">
                                    {pieData.map((entry, index) => (
                                        <li key={index} className="mb-1">
                                            <span
                                                className="inline-block w-3 h-3 rounded-full ml-2 align-middle"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                            ></span>
                                            <strong>{entry.name}</strong>: {((entry.value / (totalExpenses || 1)) * 100).toFixed(1)}%
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500">אין עדיין הוצאות להצגה</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ✅ הצעות לחיסכון – לוקאלי */}
            <div className="mb-6">
                <Suggestions transactions={transactions} />
            </div>
        </div>
    );
}
