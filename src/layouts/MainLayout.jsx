// src/layouts/MainLayout.jsx
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Table, Folder, Menu } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate, NavLink } from 'react-router-dom';
import { useState } from 'react';

export default function MainLayout({ children }) {
  const { user, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOutUser();
    navigate('/login'); 
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row-reverse">

      {/* כפתור תפריט במובייל */}
      <div className="md:hidden flex justify-between items-center p-4 bg-white border-b">
        <h2 className="text-xl font-bold text-green-600">Balance</h2>
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`w-full md:w-64 bg-white border-l p-4 flex flex-col justify-between 
        ${sidebarOpen ? 'block' : 'hidden'} md:flex h-full md:h-screen`}>
        <div>
          <h2 className="text-2xl font-bold text-green-600 mb-6 hidden md:block">Balance</h2>
          <nav className="space-y-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? 'font-bold text-green-600 flex items-center gap-2'
                  : 'text-gray-700 flex items-center gap-2'
              }
            >
              <LayoutDashboard />
              מסך בית
            </NavLink>
            <NavLink
              to="/transactions"
              className={({ isActive }) =>
                isActive
                  ? 'font-bold text-green-600 flex items-center gap-2'
                  : 'text-gray-700 flex items-center gap-2'
              }
            >
              <Table />
              פעולות
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) =>
                isActive
                  ? 'font-bold text-green-600 flex items-center gap-2'
                  : 'text-gray-700 flex items-center gap-2'
              }
            >
              <Folder />
              קטגוריות
            </NavLink>

            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                isActive
                  ? 'font-bold text-green-600 flex items-center gap-2'
                  : 'text-gray-700 flex items-center gap-2'
              }
            >
              <Folder />
              ניתוח נתונים
            </NavLink>

          </nav>
        </div>

        {/* Logout */}
        <div className="pt-6 border-t mt-6">
          <p className="text-sm text-gray-600 mb-2 truncate">{user?.email}</p>
          <Button
            style={{
              width: '100%',
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '10px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            התנתקות
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  );
}
