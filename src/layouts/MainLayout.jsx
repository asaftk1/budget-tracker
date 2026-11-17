// src/layouts/MainLayout.jsx
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Table, Folder, Menu, X, BarChart3, Wallet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'מסך בית', Icon: LayoutDashboard },
  { to: '/transactions', label: 'פעולות', Icon: Table },
  { to: '/categories', label: 'קטגוריות', Icon: Folder },
  { to: '/analytics', label: 'ניתוח נתונים', Icon: BarChart3 },
];

const navLinkClass = ({ isActive }) =>
  cn(
    'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? 'bg-primary-soft text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  );

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-control bg-primary text-white" aria-hidden="true">
        <Wallet size={18} />
      </span>
      <span className="text-lg font-bold text-foreground">מעקב תקציב</span>
    </div>
  );
}

export default function MainLayout({ children }) {
  const { user, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOutUser();
    navigate('/login'); 
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas">

      {/* Top bar with the menu button (mobile only) */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="תפריט"
          aria-expanded={sidebarOpen}
          className="rounded-control p-2 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar: the first flex child, so it sits on the start (right) side in RTL.
          On desktop it stays in view while the page scrolls. */}
      <aside
        className={cn(
          'w-full flex-col justify-between border-b bg-card p-4 md:border-b-0 md:border-e md:p-5',
          'md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:self-start md:flex',
          sidebarOpen ? 'flex' : 'hidden'
        )}
      >
        <div>
          <div className="mb-8 hidden px-1 md:block">
            <Brand />
          </div>
          <nav className="space-y-1" aria-label="ניווט ראשי">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={navLinkClass}>
                <Icon size={20} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Account */}
        <div className="mt-6 border-t pt-4">
          <p className="mb-3 truncate px-1 text-xs text-muted-foreground" title={user?.email}>
            <bdi>{user?.email}</bdi>
          </p>
          <Button variant="outlineDanger" className="w-full" onClick={handleLogout}>
            <LogOut size={16} className="rtl:-scale-x-100" aria-hidden="true" />
            התנתקות
          </Button>
        </div>
      </aside>

      {/* Main content: scrolls with the page, centred and capped on wide screens */}
      <main className="min-w-0 flex-1 bg-canvas p-4 md:p-6">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
