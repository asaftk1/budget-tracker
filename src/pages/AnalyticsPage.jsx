// src/pages/AnalyticsPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Input } from '../components/ui/input';
import dayjs from 'dayjs';
import { fromAgorot, formatMoney, sumAgorot, sumAgorotBy } from '../lib/money';

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4CAF50', '#FF9800', '#9C27B0', '#795548', '#00BCD4'];

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;
    const q = query(collection(db, 'transactions'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      return (!fromDate || tx.date >= fromDate) && (!toDate || tx.date <= toDate);
    });
  }, [transactions, fromDate, toDate]);

  // Per-category totals in integer agorot.
  const expensesByCategory = useMemo(() => {
    return sumAgorotBy(
      filtered.filter(tx => tx.type === 'הוצאה'),
      tx => tx.category || 'לא מסווג'
    );
  }, [filtered]);

  const totalExpenses = useMemo(
    () => Object.values(expensesByCategory).reduce((s, v) => s + v, 0),
    [expensesByCategory]
  );

  const pieData = useMemo(() => {
    const entries = Object.entries(expensesByCategory)
      .map(([category, value]) => ({ name: category, value }))
      .sort((a, b) => b.value - a.value);
    return entries;
  }, [expensesByCategory]);

  const chartData = useMemo(() => [{
    name: 'סיכום',
    // The bar chart takes shekels; the sums themselves are exact agorot.
    הכנסות: fromAgorot(sumAgorot(filtered.filter(tx => tx.type === 'הכנסה'))),
    הוצאות: fromAgorot(sumAgorot(filtered.filter(tx => tx.type === 'הוצאה')))
  }], [filtered]);

  // Pie values and totals are agorot; bar chart values are shekels.
  const formatBarValue = (shekels) => formatMoney(Math.round(shekels * 100));

  return (
    <div dir="rtl" className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-4">📈 ניתוח נתונים</h2>
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block mb-1 font-medium">מתאריך:</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="block mb-1 font-medium">עד תאריך:</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* פילוח הוצאות לפי קטגוריה */}
        <Card>
          <CardHeader>
            <CardTitle>🧾 פילוח הוצאות לפי קטגוריה</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex flex-col md:flex-row gap-6">
                {/* Pie */}
                <div className="md:w-1/2">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie dataKey="value" data={pieData} cx="50%" cy="50%" outerRadius={100}>
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [formatMoney(value), name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* List with percents + amounts */}
                <div className="md:w-1/2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">סה״כ הוצאות</span>
                    <span className="font-bold">{formatMoney(totalExpenses)}</span>
                  </div>
                  <ul className="divide-y border rounded-lg bg-white">
                    {pieData.map((item, idx) => {
                      const percent = totalExpenses ? (item.value / totalExpenses) * 100 : 0;
                      return (
                        <li key={item.name} className="flex items-center gap-3 p-3">
                          <span
                            className="inline-block w-3 h-3 rounded-sm"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            aria-hidden
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {percent.toFixed(1)}% • {formatMoney(item.value)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500">אין נתונים</p>
            )}
          </CardContent>
        </Card>

        {/* הוצאות מול הכנסות */}
        <Card>
          <CardHeader>
            <CardTitle>💵 הוצאות מול הכנסות</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis tick={{ textAnchor: 'start', dx: -10 }} />
                <Tooltip formatter={(value, name) => [formatBarValue(value), name]} />
                <Bar dataKey="הכנסות" fill="#22c55e" />
                <Bar dataKey="הוצאות" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
