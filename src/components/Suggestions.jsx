// src/components/Suggestions.jsx
import { useState } from "react";
import { Lightbulb } from "lucide-react";
import useSuggestions from "../insights/useSuggestions";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

// How many suggestions show before "show more".
const COLLAPSED_COUNT = 5;

export default function Suggestions({ transactions, onAskAi }) {
  const suggestions = useSuggestions(transactions);
  const [expanded, setExpanded] = useState(false);

  if (!transactions?.length) {
    return <p className="text-muted-foreground">אין נתונים להצגה.</p>;
  }

  const visible = expanded ? suggestions : suggestions.slice(0, COLLAPSED_COUNT);
  const hiddenCount = suggestions.length - COLLAPSED_COUNT;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb size={20} className="text-muted-foreground" aria-hidden="true" />
          הצעות לחיסכון
        </CardTitle>
        {onAskAi && (
          <Button size="sm" onClick={onAskAi}>
            שפר בעזרת AI
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-muted-foreground">אין ממצאים מיוחדים כרגע</p>
        ) : (
          <>
            <ul id="suggestions-list" className="space-y-3">
              {visible.map((sug, i) => (
                <li key={i} className="rounded-control border bg-background p-3">
                  <div className="font-medium text-foreground">{sug.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{sug.detail}</div>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full"
                aria-expanded={expanded}
                aria-controls="suggestions-list"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "הצג פחות" : `הצג עוד (${hiddenCount})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
