import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pos from './pages/Pos';
import JoBoard from './pages/JobOrders/Board';
import JoCreate from './pages/JobOrders/Create';
import JoDetail from './pages/JobOrders/Detail';
import Items from './pages/Inventory/Items';
import ItemDetail from './pages/Inventory/ItemDetail';
import StockMovements from './pages/Inventory/StockMovements';
import ReceiveStock from './pages/Inventory/ReceiveStock';
import Customers from './pages/Customers/List';
import CustomerDetail from './pages/Customers/Detail';
import Vehicles from './pages/Vehicles';
import Suppliers from './pages/Suppliers';
import DailySales from './pages/Reports/DailySales';
import StockOnHand from './pages/Reports/StockOnHand';
import MechanicCommission from './pages/Reports/MechanicCommission';
import BirExport from './pages/Reports/BirExport';
import Users from './pages/Users';
import SettingsPage from './pages/Settings';

import { useAuth, setCachedUser } from './hooks/useAuth';
import { can } from './permissions';
import { ToastHost } from './components/Toast';

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">🛵 InvApp — Motor-Shop POS</div>
        <div className="who">
          {user.full_name} <span className="badge muted">{user.role}</span>{' '}
          <button className="btn" onClick={async () => { await window.api.auth.logout(); setCachedUser(null); window.location.hash = '#/login'; }}>Sign out</button>
        </div>
      </div>
      <div className="sidebar">
        <nav>
          <NavLink to="/" label="Dashboard" />
          <NavLink to="/pos" label="POS" action="pos.checkout" />
          <NavLink to="/job-orders" label="Job Orders" action="jo.read" />
          <NavLink to="/inventory" label="Inventory" action="item.read" />
          <NavLink to="/inventory/receive" label="Receive Stock" action="stock.receive" />
          <NavLink to="/customers" label="Customers" action="customer.read" />
          <NavLink to="/vehicles" label="Vehicles" action="vehicle.read" />
          <NavLink to="/suppliers" label="Suppliers" action="supplier.read" />
          <NavLink to="/reports/daily-sales" label="Daily Sales" action="report.daily_sales" />
          <NavLink to="/reports/stock" label="Stock on Hand" action="report.stock" />
          <NavLink to="/reports/commission" label="Mechanic Commission" action="report.commission" />
          <NavLink to="/reports/bir-export" label="BIR Export" action="report.bir_export" />
          <NavLink to="/users" label="Users" action="user.read" />
          <NavLink to="/settings" label="Settings" action="settings.read" />
        </nav>
      </div>
      <div className="main">{children}</div>
    </div>
  );
}

function NavLink({ to, label, action }: { to: string; label: string; action?: any }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (action && user && !can(user.role, action)) return null;
  const isActive = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
  return <a href={`#${to}`} className={isActive ? 'active' : ''}>{label}</a>;
}

function RequireAuth({ children, action }: { children: React.ReactNode; action?: any }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (action && !can(user.role, action)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    fetchUser();
  }, []);
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Shell><RequireAuth><Dashboard /></RequireAuth></Shell>} />
        <Route path="/pos" element={<Shell><RequireAuth action="pos.checkout"><Pos /></RequireAuth></Shell>} />
        <Route path="/job-orders" element={<Shell><RequireAuth action="jo.read"><JoBoard /></RequireAuth></Shell>} />
        <Route path="/job-orders/new" element={<Shell><RequireAuth action="jo.create"><JoCreate /></RequireAuth></Shell>} />
        <Route path="/job-orders/:id" element={<Shell><RequireAuth action="jo.read"><JoDetail /></RequireAuth></Shell>} />
        <Route path="/inventory" element={<Shell><RequireAuth action="item.read"><Items /></RequireAuth></Shell>} />
        <Route path="/inventory/:id" element={<Shell><RequireAuth action="item.read"><ItemDetail /></RequireAuth></Shell>} />
        <Route path="/inventory/:id/movements" element={<Shell><RequireAuth action="stock.read"><StockMovements /></RequireAuth></Shell>} />
        <Route path="/inventory/receive" element={<Shell><RequireAuth action="stock.receive"><ReceiveStock /></RequireAuth></Shell>} />
        <Route path="/customers" element={<Shell><RequireAuth action="customer.read"><Customers /></RequireAuth></Shell>} />
        <Route path="/customers/:id" element={<Shell><RequireAuth action="customer.read"><CustomerDetail /></RequireAuth></Shell>} />
        <Route path="/vehicles" element={<Shell><RequireAuth action="vehicle.read"><Vehicles /></RequireAuth></Shell>} />
        <Route path="/suppliers" element={<Shell><RequireAuth action="supplier.read"><Suppliers /></RequireAuth></Shell>} />
        <Route path="/reports/daily-sales" element={<Shell><RequireAuth action="report.daily_sales"><DailySales /></RequireAuth></Shell>} />
        <Route path="/reports/stock" element={<Shell><RequireAuth action="report.stock"><StockOnHand /></RequireAuth></Shell>} />
        <Route path="/reports/commission" element={<Shell><RequireAuth action="report.commission"><MechanicCommission /></RequireAuth></Shell>} />
        <Route path="/reports/bir-export" element={<Shell><RequireAuth action="report.bir_export"><BirExport /></RequireAuth></Shell>} />
        <Route path="/users" element={<Shell><RequireAuth action="user.read"><Users /></RequireAuth></Shell>} />
        <Route path="/settings" element={<Shell><RequireAuth action="settings.read"><SettingsPage /></RequireAuth></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  );
}

async function fetchUser() {
  const u = await window.api.auth.currentUser();
  setCachedUser(u);
}
