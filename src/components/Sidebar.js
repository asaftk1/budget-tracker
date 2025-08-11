import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, Table, Folder } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { BarChart3 } from "lucide-react";

const Sidebar = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        signOut();
        navigate("/");
    };

    return (
        <div className="w-64 h-screen bg-white shadow-lg flex flex-col justify-between px-4 py-6 border-l text-right">
            {/* תפריט */}
            <div className="space-y-4">
                <h1 className="text-2xl font-bold text-green-600 mb-4">Balance</h1>
                <nav className="space-y-3">
                    <Link to="/dashboard" className="flex items-center gap-2 text-gray-700 hover:text-green-600">
                        <LayoutDashboard size={20} />
                        דאשבורד
                    </Link>
                    <Link to="/transactions" className="flex items-center gap-2 text-gray-700 hover:text-green-600">
                        <Table size={20} />
                        פעולות
                    </Link>
                    <Link to="/categories" className="flex items-center gap-2 text-gray-700 hover:text-green-600">
                        <Folder size={20} />
                        קטגוריות
                    </Link>
                    <Link to="/analytics" className="flex items-center gap-2 text-gray-700 hover:text-green-600">
                        <BarChart3 size={20} />
                        ניתוח נתונים
                    </Link>
                </nav>
            </div>

            {/* כפתור התנתקות */}
            <div>

                <Button
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
                    onClick={handleLogout}
                >
                    <LogOut size={16} />
                    יציאה
                </Button>
            </div>
        </div>
    );
};

export default Sidebar;
