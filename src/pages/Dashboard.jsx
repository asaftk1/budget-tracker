import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { getAuth } from 'firebase/auth';
import { query, where } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import Suggestions from '../components/Suggestions';

export default function Dashboard() {
    const [transactions, setTransactions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [type, setType] = useState('');
    const [formData, setFormData] = useState({ date: '', category: '', amount: '' });

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

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // ✅ "הקשחה": אם תשתמש בזה בעתיד – הפעולה תופיע בשאילתה כי נשמר uid
    const handleSave = async () => {
        if (!formData.date || !formData.category || !formData.amount || !type) return;

        const user = getAuth().currentUser;
        if (!user) return;

        await addDoc(collection(db, 'transactions'), {
            ...formData,
            amount: parseFloat(formData.amount),
            type,
            uid: user.uid, // ✅ חשוב לשאילתת where('uid'...
        });

        setFormData({ date: '', category: '', amount: '' });
        setType('');
        setStep(0);
        setIsOpen(false);
    };

    const totalIncome = transactions
        .filter(tx => tx.type === 'הכנסה')
        .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);

    const totalExpense = transactions
        .filter(tx => tx.type === 'הוצאה')
        .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);

    const balance = totalIncome - totalExpense;

    const expensesByCategory = transactions
        .filter(tx => tx.type === 'הוצאה')
        .reduce((acc, tx) => {
            const cat = tx.category || 'לא מסווג';
            acc[cat] = (acc[cat] || 0) + Number(tx.amount || 0);
            return acc;
        }, {});

    const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4CAF50', '#FF9800', '#9C27B0', '#03A9F4'];
    const pieData = Object.entries(expensesByCategory).map(([category, value]) => ({
        name: category,
        value
    }));
    const totalExpenses = pieData.reduce((sum, item) => sum + item.value, 0);

    const chartData = Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('default', { month: 'short' });

        const income = transactions
            .filter(tx => tx.type === 'הכנסה' && new Date(tx.date).getMonth() === date.getMonth() && new Date(tx.date).getFullYear() === date.getFullYear())
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const expense = transactions
            .filter(tx => tx.type === 'הוצאה' && new Date(tx.date).getMonth() === date.getMonth() && new Date(tx.date).getFullYear() === date.getFullYear())
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        return { month, income, expense };
    }).reverse();

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
                            ₪{balance.toFixed(2)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>סה״כ הכנסות</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-500">₪{totalIncome.toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>סה״כ הוצאות</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-500">₪{totalExpense.toFixed(2)}</p>
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
                            {[...transactions]
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .slice(0, 5)
                                .map((tx) => (
                                    <li key={tx.id} className="flex justify-between">
                                        <div>
                                            <p className="font-semibold">{tx.category}</p>
                                            <p className="text-sm text-gray-500">{tx.date}</p>
                                        </div>
                                        <span className={`font-bold ${tx.type === 'הכנסה' ? 'text-green-600' : 'text-red-500'}`}>
                                            {tx.type === 'הכנסה' ? '+' : '-'}₪{Number(tx.amount || 0).toFixed(2)}
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
                                <Bar dataKey="income" fill="#22c55e" name="הכנסה" />
                                <Bar dataKey="expense" fill="#ef4444" name="הוצאה" />
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
                                        <Tooltip formatter={(value, name, props) => [`₪${Number(value).toFixed(2)}`, props.payload.name]} />
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
