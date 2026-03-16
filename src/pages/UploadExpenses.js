import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { deriveCategory, NOTE_NEEDS_REVIEW } from "../lib/categoryAssistant";

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

  const normalizeValue = (value) => String(value ?? "").trim().toLowerCase();

  const isDuplicate = (row) => {
    const rowCategory = normalizeValue(row.category || row.merchant);
    const rowAmount = Number(row.amount);
    const rowDate = row.date instanceof Date && !isNaN(row.date.getTime()) ? row.date.toDateString() : null;

    return existingTransactions.some((t) => {
      const tDateObj = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
      const tDate = tDateObj instanceof Date && !isNaN(tDateObj.getTime()) ? tDateObj.toDateString() : null;
      const tCategory = normalizeValue(t.category || t.merchant);
      const tAmount = Number(t.amount);

      return (
        rowDate && tDate && rowDate === tDate &&
        !Number.isNaN(rowAmount) && !Number.isNaN(tAmount) && rowAmount === tAmount &&
        rowCategory === tCategory
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
          merchant: description ? String(description).trim() : "",
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
  const handleImport = async () => {
    setStatus("????? ??????...");
    const user = auth.currentUser;
    if (!user) {
      setStatus("?????? ????? ??????? ??? ?????.");
      return;
    }

    let count = 0;

    for (const row of rows) {
      if (!row.date || row.isDuplicate) continue;

      const merchant = String(row.merchant || row.description || row.category || "").trim();
      const amountValue = Math.abs(Number(row.amount));
      if (!merchant || !amountValue || Number.isNaN(amountValue)) continue;

      let categorized;
      try {
        categorized = await deriveCategory({
          statementCategory: row.category,
          merchant,
          amount: amountValue,
          uid: user.uid,
        });
      } catch (err) {
        console.warn("ML service failed during manual upload", err);
        categorized = { category: merchant, autoCategory: null, source: "unknown", notes: NOTE_NEEDS_REVIEW };
      }

      const transaction = {
        date: row.date.toISOString().split("T")[0],
        timestamp: Timestamp.fromDate(row.date),
        merchant,
        originalCategory: row.category || null,
        category: categorized.category || merchant,
        autoCategory: categorized.autoCategory ?? null,
        categorizationSource: categorized.source || "manual",
        notes: categorized.notes ?? null,
        amount: amountValue,
        type: row.type === "income" ? "?????" : "?????",
        uid: user.uid,
      };

      if (categorized.confidence !== undefined && categorized.confidence !== null) {
        transaction.inferenceConfidence = categorized.confidence;
      }

      try {
        await addDoc(collection(db, "transactions"), transaction);
        count += 1;
      } catch (err) {
        console.error("????? ?????? ????", err, transaction);
      }
    }

    setStatus(`?????? ??????: ????? ${count} ??????`);
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





