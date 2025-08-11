import { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

const TransactionForm = ({ onAdd }) => {
  const [type, setType] = useState("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !category || !date) return;

    const [year, month, day] = date.split("-").map(Number);
    const jsDate = new Date(year, month - 1, day);

    const newTransaction = {
      type,
      amount: parseFloat(amount),
      category,
      timestamp: Timestamp.fromDate(jsDate),
      userId: auth.currentUser.uid, // ✅ מזהה המשתמש
    };

    const docRef = await addDoc(collection(db, "transactions"), newTransaction);
    onAdd({ id: docRef.id, ...newTransaction });

    setAmount("");
    setCategory("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <form onSubmit={handleSubmit}>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="income">הכנסה</option>
        <option value="expense">הוצאה</option>
      </select>

      <input
        type="number"
        placeholder="סכום"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <input
        type="text"
        placeholder="קטגוריה"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <button type="submit">הוסף</button>
    </form>
  );
};

export default TransactionForm;
