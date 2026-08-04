import { Routes, Route, Navigate } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";

import { useHostContext } from "./hooks/useHostContext";

import MainLayout from "./layouts/MainLayout";

import AuthLayout from "./layouts/AuthLayout";

import Login from "./pages/auth/Login";

import ForgotPassword from "./pages/auth/ForgotPassword";

import Register from "./pages/auth/Register";

import Dashboard from "./pages/dashboard/Dashboard";

import InventoryValue from "./pages/dashboard/InventoryValue";

import ItemList from "./pages/items/ItemList";

import ItemForm from "./pages/items/ItemForm";

import ItemDetail from "./pages/items/ItemDetail";

import StockList from "./pages/stock/StockList";

import StockForm from "./pages/stock/StockForm";

import KarigarList from "./pages/karigar/KarigarList";

import KarigarForm from "./pages/karigar/KarigarForm";

import KarigarDetail from "./pages/karigar/KarigarDetail";

import KarigarPendingJobs from "./pages/karigar/KarigarPendingJobs";

import CustomOrderList from "./pages/customOrders/CustomOrderList";

import CustomOrderForm from "./pages/customOrders/CustomOrderForm";

import CustomOrderDetail from "./pages/customOrders/CustomOrderDetail";

import CustomOrderBill from "./pages/customOrders/CustomOrderBill";

import PawnList from "./pages/pawn/PawnList";

import PawnForm from "./pages/pawn/PawnForm";

import PawnDetail from "./pages/pawn/PawnDetail";

import POS from "./pages/pos/POS";

import SaleList from "./pages/pos/SaleList";

import SaleDetail from "./pages/pos/SaleDetail";
import PrintInvoice from "./pages/pos/PrintInvoice";

import CustomerList from "./pages/customers/CustomerList";

import CustomerForm from "./pages/customers/CustomerForm";

import CustomerDetail from "./pages/customers/CustomerDetail";

import RateList from "./pages/rates/RateList";

import RateForm from "./pages/rates/RateForm";

import TodaysRate from "./pages/rates/TodaysRate";

import Reports from "./pages/reports/Reports";

import ReportView from "./pages/reports/ReportView";

import PawnReport from "./pages/reports/PawnReport";

import CustomerLedgerReport from "./pages/reports/CustomerLedgerReport";

import ProfitSummaryReport from "./pages/reports/ProfitSummaryReport";

import AuditLog from "./pages/audit/AuditLog";

import InventoryLog from "./pages/audit/InventoryLog";

import StockReconciliation from "./pages/audit/StockReconciliation";

import DeletedRecords from "./pages/audit/DeletedRecords";

import Settings from "./pages/settings/Settings";

import AdminDashboard from "./pages/admin/AdminDashboard";

import TenantList from "./pages/admin/TenantList";

import TenantDetail from "./pages/admin/TenantDetail";

import TenantForm from "./pages/admin/TenantForm";


import BroadcastNotification from "./pages/admin/BroadcastNotification";

import RateHistory from "./pages/admin/RateHistory";

import AdminRequests from "./pages/admin/AdminRequests";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function HomeRoute() {
  const { user } = useAuth();
  const { allowsSuperadmin } = useHostContext();
  if (user?.role === 'superadmin' && allowsSuperadmin) return <Navigate to="/admin" replace />;
  return <Dashboard />;
}

// Superadmin screens exist only on the main portal. The backend rejects these
// calls on a shop subdomain anyway; this keeps the UI from offering them.
function SuperadminRoute({ children }) {
  const { user } = useAuth();
  const { allowsSuperadmin } = useHostContext();
  if (!allowsSuperadmin || user?.role !== 'superadmin') return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route index element={<Login />} />
      </Route>
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route index element={<ForgotPassword />} />
      </Route>
      <Route
        path="/register"
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route index element={<Register />} />
      </Route>
      <Route path="/todays-rate" element={<TodaysRate />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomeRoute />} />
        <Route path="/inventory-value" element={<InventoryValue />} />
        <Route path="/items" element={<ItemList />} />
        <Route path="/items/new" element={<ItemForm />} />
        <Route path="/items/:id" element={<ItemDetail />} />
        <Route path="/items/:id/edit" element={<ItemForm />} />
        <Route path="/stock" element={<StockList />} />
        <Route path="/karigar" element={<KarigarList />} />
        <Route path="/karigar/pending-jobs" element={<KarigarPendingJobs />} />
        <Route path="/karigar/new" element={<KarigarForm />} />
        <Route path="/karigar/:id" element={<KarigarDetail />} />
        <Route path="/custom-orders" element={<CustomOrderList />} />
        <Route path="/custom-orders/new" element={<CustomOrderForm />} />
        <Route path="/custom-orders/:id" element={<CustomOrderDetail />} />
        <Route path="/custom-orders/bill/:id" element={<CustomOrderBill />} />
        <Route path="/pawn" element={<PawnList />} />
        <Route path="/pawn/new" element={<PawnForm />} />
        <Route path="/pawn/:id" element={<PawnDetail />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/pos/sales" element={<SaleList />} />
        <Route path="/pos/sales/:id" element={<SaleDetail />} />
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/customers/new" element={<CustomerForm />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/rates" element={<RateList />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/pawn" element={<PawnReport />} />
        <Route path="/reports/customer-ledger" element={<CustomerLedgerReport />} />
        <Route path="/reports/profit-summary" element={<ProfitSummaryReport />} />
        <Route path="/reports/:type" element={<ReportView />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/audit/inventory" element={<InventoryLog />} />
        <Route path="/audit/reconciliation" element={<StockReconciliation />} />
        <Route path="/audit/deleted" element={<DeletedRecords />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="/admin" element={<SuperadminRoute><AdminDashboard /></SuperadminRoute>} />
        <Route path="/admin/tenants" element={<SuperadminRoute><TenantList /></SuperadminRoute>} />
        <Route path="/admin/tenants/new" element={<SuperadminRoute><TenantForm /></SuperadminRoute>} />
        <Route path="/admin/tenants/:id" element={<SuperadminRoute><TenantDetail /></SuperadminRoute>} />

        <Route path="/admin/requests" element={<SuperadminRoute><AdminRequests /></SuperadminRoute>} />
        <Route path="/admin/broadcast" element={<SuperadminRoute><BroadcastNotification /></SuperadminRoute>} />
        <Route path="/admin/rates" element={<SuperadminRoute><RateHistory /></SuperadminRoute>} />
      </Route>
      <Route path="/pos/print-invoice/:id" element={<ProtectedRoute><PrintInvoice /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
