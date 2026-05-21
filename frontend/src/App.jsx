import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import JobsPage from "./pages/JobsPage.jsx";
import NewJobPage from "./pages/NewJobPage.jsx";
import CustomerNewJobPage from "./pages/CustomerNewJobPage.jsx";
import JobDetailPage from "./pages/JobDetailPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import ActivityPage from "./pages/ActivityPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-[100dvh] flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <span className="tech-led-dot" aria-hidden />
        <p className="text-slate-600 dark:text-cyan-200/90 text-sm font-medium tracking-wide animate-pulse">Loading…</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

function ReceptionOrAdmin({ children }) {
  const { user } = useAuth();
  if (user?.role === "TECHNICIAN") return <Navigate to="/jobs" replace />;
  return children;
}

export default function App() {
  return (
    <div className="tech-app-root min-h-[100dvh]">
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route
          path="jobs/new"
          element={
            <ReceptionOrAdmin>
              <NewJobPage />
            </ReceptionOrAdmin>
          }
        />
        <Route
          path="reports"
          element={
            <ReceptionOrAdmin>
              <ReportsPage />
            </ReceptionOrAdmin>
          }
        />
        <Route
          path="activity"
          element={
            <AdminRoute>
              <ActivityPage />
            </AdminRoute>
          }
        />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route
          path="customers/:customerId/new-job"
          element={
            <ReceptionOrAdmin>
              <CustomerNewJobPage />
            </ReceptionOrAdmin>
          }
        />
        <Route path="account" element={<AccountPage />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
