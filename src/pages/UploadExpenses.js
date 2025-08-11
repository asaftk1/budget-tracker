import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

const UploadExpenses = ({ onFinishUpload }) => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [existingTransactions, setExistingTransactions] = useState([]);

  useEffect(() => {
    const fetchExisting = async () => {
      const snapshot = await getDocs(collection(db, "transactions"));
      const data = snapshot.docs.map(doc => doc.data());
      setExistingTransactions(data);
    };
    fetchExisting();
  }, []);

  const isDuplicate = (row) => {
    return existingTransactions.some((t) => {
      const tDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
      return (
        t.amount === row.amount &&
        t.category === row.category &&
        tDate.toDateString() === row.date?.toDateString()
      );
    });
  };

  const parseDate = (value) => {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === "number") {
      const jsDate = new Date((value - 25569) * 86400 * 1000);
      return isNaN(jsDate.getTime()) ? null : jsDate;
    }

    if (typeof value === "string") {
      if (value.includes("סך הכל") || value.trim() === "") return null;

      let parts;
      if (value.includes("-")) {
        parts = value.split("-");
      } else if (value.includes("/")) {
        parts = value.split("/");
      }

      if (parts && parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        const jsDate = new Date(year, month - 1, day);
        return isNaN(jsDate.getTime()) ? null : jsDate;
      }
    }

    const fallback = new Date(value);
    return isNaN(fallback.getTime()) ? null : fallback;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus("🔄 טוען קובץ...");
    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const headerIndex = 3;
      const headers = raw[headerIndex];
      const dataRows = raw.slice(headerIndex + 1);

      const parsed = dataRows.map((row) => {
        const obj = {};
        headers.forEach((key, i) => {
          obj[key] = row[i];
        });

        const dateStr = obj["תאריך עסקה"];
        const description = obj["שם בית העסק"];
        const category = obj["קטגוריה"];
        const amount = parseFloat(obj["סכום חיוב"]);
        const jsDate = parseDate(dateStr);
        const type = description?.includes("זיכוי") ? "income" : "expense";

        return {
          date: jsDate,
          amount,
          category,
          description,
          type,
        };
      }).filter(row => row.date || row.amount || row.category);

      const withDuplicates = parsed.map((row) => ({
        ...row,
        isDuplicate: isDuplicate(row),
      }));

      setRows(withDuplicates);
      setStatus(`📝 נמצאו ${withDuplicates.length} שורות`);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setStatus("⬆️ מעלה נתונים...");

    let count = 0;

    for (const row of rows) {
      if (!row.date || !row.amount || !row.category || row.isDuplicate) continue;

      const transaction = {
        type: row.type,
        amount: row.amount,
        category: row.category,
        timestamp: Timestamp.fromDate(row.date),
        userId: auth.currentUser.uid, // ✅ תוספת
      };

      try {
        await addDoc(collection(db, "transactions"), transaction);
        count++;
      } catch (err) {
        console.error("שגיאה בשמירה:", err);
      }
    }

    setStatus(`✅ נוספו ${count} עסקאות חדשות`);
    setRows([]);
    if (onFinishUpload) onFinishUpload();
  };

  return (
    <div style={{ margin: "20px 0" }}>
      <h3>📤 ייבוא הוצאות מקובץ אשראי</h3>
      <input type="file" accept=".xlsx" onChange={handleFileUpload} />
      <p>{status}</p>

      {rows.length > 0 && (
        <>
          <table className="transaction-table" style={{ marginTop: "10px" }}>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>סוג</th>
                <th>קטגוריה</th>
                <th>סכום</th>
                <th>תיאור</th>
                <th>כפול?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isInvalid = !r.date || !r.amount || !r.category;
                return (
                  <tr key={i} style={r.isDuplicate || isInvalid ? { backgroundColor: "#ffe5e5" } : {}}>
                    <td>{r.date ? r.date.toLocaleDateString() : "❌ תאריך לא תקין"}</td>
                    <td>{r.type === "income" ? "הכנסה" : "הוצאה"}</td>
                    <td>{r.category || "❌"}</td>
                    <td>{r.amount ? `₪${r.amount}` : "❌"}</td>
                    <td>{r.description}</td>
                    <td>{r.isDuplicate ? "✅" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            onClick={handleImport}
            style={{
              marginTop: "10px",
              padding: "10px 20px",
              backgroundColor: "green",
              color: "white",
              fontWeight: "bold",
            }}
          >
            הוסף עסקאות חדשות ✅
          </button>
        </>
      )}
    </div>
  );
};

export default UploadExpenses;
