// src/components/Suggestions.jsx
import useSuggestions from "../insights/useSuggestions";

export default function Suggestions({ transactions, onAskAi }) {
  const suggestions = useSuggestions(transactions);

  if (!transactions?.length) {
    return <div className="text-gray-500">אין נתונים להצגה.</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">💡 הצעות לחיסכון</h3>
        {onAskAi && (
          <button
            onClick={onAskAi}
            className="text-sm px-3 py-1 rounded bg-black text-white hover:opacity-90"
          >
            שפר בעזרת AI
          </button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <p className="text-gray-500">אין ממצאים מיוחדים כרגע ✨</p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((sug, i) => (
            <li key={i} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{sug.title}</div>
                <span className="text-xs bg-gray-100 rounded px-2 py-0.5">
                  ציון {sug.score}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">{sug.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
