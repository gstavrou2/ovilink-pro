import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/admin', icon: 'ti-layout-dashboard', label: 'Admin Dashboard', exact: true },
  { to: '/admin/farms', icon: 'ti-building', label: 'Φάρμες' },
  { to: '/admin/users', icon: 'ti-users', label: 'Χρήστες' },
]

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <div className="app-layout">
      <div className={`mobile-overlay${menuOpen?' open':''}`} onClick={() => setMenuOpen(false)}/>

      <aside className={`sidebar${menuOpen?' open':''}`}>
        <div className="sidebar-logo">
          <img src="/logo.jpg" alt="OVIlink"/>
        </div>
        <div style={{ padding:'8px 12px', background:'#FEF2F2', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontWeight:600, fontSize:13, color:'var(--red)', display:'flex', alignItems:'center', gap:6 }}>
            <i className="ti ti-shield"/> Admin Panel
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact} className={({ isActive }) => `nav-item${isActive?' active':''}`}>
              <i className={`ti ${item.icon}`}/>{item.label}
            </NavLink>
          ))}
          <NavLink to="/" className="nav-item" style={{ marginTop:'1rem', borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
            <i className="ti ti-arrow-left"/>Πίσω στη φάρμα
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            <i className="ti ti-user" style={{ marginRight:4 }}/>{user?.email}
          </div>
          <button className="btn btn-sm" onClick={handleSignOut} style={{ width:'100%', justifyContent:'center' }}>
            <i className="ti ti-logout"/> Αποσύνδεση
          </button>
        </div>
        <div className="sidebar-credit">
          Developed &amp; designed by<br/>
          <strong style={{ color:'var(--text)' }}>George Stavrou</strong>
        </div>
      </aside>

      <div className="main-content">
        <div className="mobile-topbar">
          <button className="btn btn-sm" onClick={() => setMenuOpen(p => !p)}>
            <i className={`ti ${menuOpen?'ti-x':'ti-menu-2'}`}/>
          </button>
          <span style={{ fontWeight:700, fontSize:15, color:'var(--red)' }}>
            <i className="ti ti-shield"/> OVIlink Admin
          </span>
        </div>
        <div className="page-container"><Outlet /></div>
      </div>
    </div>
  )
}
