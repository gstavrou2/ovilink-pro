import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

import FarmLayout from './components/FarmLayout'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/auth/LoginPage'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

import SuperAdminDashboard from './pages/admin/SuperAdminDashboard'
import AdminFarms from './pages/admin/AdminFarms'
import AdminUsers from './pages/admin/AdminUsers'
import AdminLicenses from './pages/admin/AdminLicenses'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'

import Dashboard from './pages/farm/Dashboard'
import Animals from './pages/farm/Animals'
import Groups from './pages/farm/Groups'
import MilkRecords from './pages/farm/MilkRecords'
import Vaccines from './pages/farm/Vaccines'
import Costs from './pages/farm/Costs'
import Warehouse from './pages/farm/Warehouse'
import Todos from './pages/farm/Todos'
import Account from './pages/farm/Account'
import Modules from './pages/farm/Modules'

function PrivateRoute({ children, superAdminOnly = false, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading"><i className="ti ti-loader" /> Φόρτωση...</div>
  if (!user) return <Navigate to="/login" replace />
  if (superAdminOnly && user.role !== 'super_admin') return <Navigate to="/" replace />
  if (adminOnly && !['super_admin','admin'].includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading"><i className="ti ti-loader" /> Φόρτωση...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Super Admin routes */}
      <Route path="/admin" element={<PrivateRoute superAdminOnly><AdminLayout /></PrivateRoute>}>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="farms" element={<AdminFarms />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="licenses" element={<AdminLicenses />} />
        <Route path="audit" element={<AdminAuditLogs />} />
      </Route>

      {/* Farm routes */}
      <Route path="/" element={<PrivateRoute><FarmLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="animals" element={<Animals />} />
        <Route path="groups" element={<Groups />} />
        <Route path="milk" element={<MilkRecords />} />
        <Route path="vaccines" element={<Vaccines />} />
        <Route path="costs" element={<Costs />} />
        <Route path="warehouse" element={<Warehouse />} />
        <Route path="todos" element={<Todos />} />
        <Route path="modules" element={<Modules />} />
        <Route path="account" element={<Account />} />
      </Route>
    </Routes>
  )
}
