import Login from "./pages/Login"; // ודא שהקובץ קיים
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MainLayout from "./layouts/MainLayout";
import TransactionsPage from './pages/TransactionsPage';
import CategoriesPage from "./pages/CategoriesPage";
import AnalyticsPage from './pages/AnalyticsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route
          path="/dashboard"
          element={
            <MainLayout>
              <Dashboard />
            </MainLayout>
          }
        />
        <Route
          path="/transactions"
          element={
            <MainLayout>
              <TransactionsPage />
            </MainLayout>
          }
        />
        <Route
          path="/categories"
          element={
            <MainLayout>
              <CategoriesPage />
            </MainLayout>
          }
        />
        

        <Route
          path="/analytics"
          element={
            <MainLayout>
              <AnalyticsPage />
            </MainLayout>
          }
        />

        {/* עמודים נוספים... */}
      </Routes>
    </Router>
  );
}
export default App;
