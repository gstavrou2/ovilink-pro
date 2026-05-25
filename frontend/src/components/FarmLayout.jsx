import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
const navItems = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Πίνακας Ελέγχου', exact: true },
  { to: '/animals', icon: 'ti-paw', label: 'Ζώα' },
  { to: '/groups', icon: 'ti-folders', label: 'Groups & Σιτηρέσια' },
  { to: '/milk', icon: 'ti-droplet', label: 'Γαλακτομετρήσεις' },
  { to: '/vaccines', icon: 'ti-vaccine', label: 'Εμβολιασμοί' },
  { to: '/costs', icon: 'ti-cash', label: 'Κοστολόγιο' },
  { to: '/warehouse', icon: 'ti-building-warehouse', label: 'Αποθήκη' },
  { to: '/todos', icon: 'ti-checkbox', label: 'Εργασίες' },
]

export default function FarmLayout() {
  const { user, profile, signOut, isAdmin, farmId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { setMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // Load unread notifications count
  useEffect(() => {
    if (!farmId) return
    loadUnread()
    // Poll every 60 seconds
    const interval = setInterval(loadUnread, 60000)
    return () => clearInterval(interval)
  }, [farmId])

  async function loadUnread() {
    const { count } = await supabase.from('notifications').select('*', { count:'exact', head:true }).eq('farm_id', farmId).eq('is_read', false)
    setUnreadCount(count || 0)
  }

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const roleBadgeClass = { admin:'badge-red', manager:'badge-blue', viewer:'badge-gray' }

  return (
    <div className="app-layout">
      <div className={`mobile-overlay${menuOpen?' open':''}`} onClick={() => setMenuOpen(false)}/>

      <aside className={`sidebar${menuOpen?' open':''}`}>
        <div className="sidebar-logo"><img src="/logo.jpg" alt="OVIlink"/></div>

        {profile?.farms?.name && (
          <div style={{ padding:'8px 12px', background:'var(--green-light)', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Φάρμα</div>
            <div style={{ fontWeight:600, fontSize:13, color:'var(--green-dark)' }}>{profile.farms.name}</div>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact} className={({ isActive }) => `nav-item${isActive?' active':''}`}>
              <i className={`ti ${item.icon}`}/>{item.label}
              {/* Notification badge on dashboard */}
              {item.to==='/' && unreadCount>0 && (
                <span style={{ marginLeft:'auto', background:'var(--red)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:10 }}>{unreadCount}</span>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" className="nav-item" style={{ marginTop:'0.5rem', borderTop:'1px solid var(--border)', paddingTop:'0.75rem' }}>
              <i className="ti ti-shield"/>Admin Panel
            </NavLink>
          )}
        </nav>

        <div className="sidebar-user">
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            <span className={`badge ${roleBadgeClass[profile?.role]||'badge-gray'}`} style={{ fontSize:10 }}>{profile?.role||'viewer'}</span>
            <span style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <NavLink to="/account" className="btn btn-sm" style={{ flex:1, justifyContent:'center' }}>
              <i className="ti ti-user-cog"/>Λογαριασμός
            </NavLink>
            <button className="btn btn-sm" onClick={handleSignOut} title="Αποσύνδεση"><i className="ti ti-logout"/></button>
          </div>
        </div>

        <div className="sidebar-credit">
          Developed &amp; designed by<br/>
          <strong style={{ color:'var(--text)' }}>George Stavrou</strong>
        </div>
      </aside>

      <div className="main-content">
        <div className="mobile-topbar">
          <button className="btn btn-sm" onClick={() => setMenuOpen(p => !p)} style={{ flexShrink:0 }}>
            <i className={`ti ${menuOpen?'ti-x':'ti-menu-2'}`}/>
          </button>
          <img src="/logo.jpg" alt="OVIlink" style={{ height:30, borderRadius:4 }}/>
          <span style={{ fontWeight:700, fontSize:15 }}>OVIlink</span>
          {unreadCount>0 && (
            <span style={{ marginLeft:'auto', background:'var(--red)', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>
              {unreadCount} 🔔
            </span>
          )}
        </div>
        <div className="page-container"><Outlet /></div>
        <div className="app-footer">
          <strong>OVIlink</strong> — Διαχείριση Κτηνοτροφικής Μονάδας
          &nbsp;·&nbsp; Developed &amp; designed by <strong>George Stavrou</strong>
        </div>
      </div>
    </div>
  )
}
