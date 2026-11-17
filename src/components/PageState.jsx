import { AlertTriangle, Inbox, Loader2, RotateCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

// A short message with an icon, for empty and error states. "compact" drops the dashed frame, for
// use inside a card.
export function StateMessage({ icon: Icon, tone = 'neutral', compact = false, children }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 text-center',
        compact ? 'py-6' : 'rounded-card border border-dashed bg-card px-4 py-10'
      )}
    >
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        <Icon size={24} />
      </span>
      {children}
    </div>
  );
}

const reloadPage = () => window.location.reload();

// Loading, error and empty states shared by the pages that read from DataContext.
//   loading   show a status line with placeholder blocks instead of the content
//   error     Hebrew message from the provider. With no data it replaces the content; when data had
//             already loaded it shows above the content, which stays visible.
//   hasData   whether any data is available to show
//   isEmpty   the loaded data is empty: show emptyMessage instead of the content
//   onRetry   what the "try again" button does; by default it reloads the page, which starts the
//             data listeners again. No data logic lives here.
export default function PageState({ loading, error, hasData, isEmpty, emptyMessage, onRetry = reloadPage, children }) {
  if (loading) {
    return (
      <div aria-busy="true">
        <div role="status" className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          טוען נתונים…
        </div>
        {/* Placeholder blocks only hint at the layout; the status line above is the message. */}
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }
  if (error && !hasData) {
    return (
      <StateMessage icon={AlertTriangle} tone="danger">
        <p role="alert" className="font-medium text-foreground">{error}</p>
        <Button variant="outline" onClick={onRetry}>
          <RotateCw size={16} aria-hidden="true" />נסה שוב
        </Button>
      </StateMessage>
    );
  }
  if (!error && isEmpty) {
    return (
      <StateMessage icon={Inbox}>
        <p role="status" className="text-muted-foreground">{emptyMessage}</p>
      </StateMessage>
    );
  }
  return (
    <>
      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-control border border-danger/30 bg-danger/5 px-3 py-2 text-sm">
          <AlertTriangle size={16} className="shrink-0 text-danger" aria-hidden="true" />
          <p role="alert" className="text-danger">{error}</p>
          <Button size="sm" variant="outlineDanger" onClick={onRetry}>
            <RotateCw size={14} aria-hidden="true" />נסה שוב
          </Button>
        </div>
      )}
      {children}
    </>
  );
}
