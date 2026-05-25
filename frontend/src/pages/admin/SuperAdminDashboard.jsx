import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/exports'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ farms:0, users:0, animals:0, activeLicenses:0 })
  const [recentFarms, setRecentFarms] = useState([])
  const [recentLicenses, setRecentLicenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [s, farms, licenses] = await Promise.all([
      api.getAdminStats(),
      api.getFarms(),
      api.getLicenses(),
    ])
    setStats(s || {})
    setRecentFarms((farms||[]).slice(0,5))
    setRecentLicenses((licenses||[]).slice(0,5))
    setLoading(false)
  }

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Super Admin Dashboard</div>
          <div className="page-subtitle">Συνολική εποπτεία πλατφόρμας OVIlink Pro</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Φάρμες</div><div className="stat-value blue">{stats.farms}</div></div>
        <div className="stat-card"><div className="stat-label">Χρήστες</div><div className="stat-value green">{stats.users}</div></div>
        <div className="stat-card"><div className="stat-label">Ζώα</div><div className="stat-value amber">{stats.animals}</div></div>
        <div className="stat-card"><div className="stat-label">Ενεργά Licenses</div><div className="stat-value green">{stats.activeLicenses}</div></div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div className="card">
          <div className="card-title">
            <i className="ti ti-building"/>Πρόσφατες φάρμες
            <Link to="/admin/farms" className="btn btn-sm" style={{ marginLeft:'auto' }}>Όλες <i className="ti ti-arrow-right"/></Link>
          </div>
          {recentFarms.map(f => (
            <div key={f.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <span style={{ fontWeight:600 }}>{f.name}</span>
              <span style={{ color:'var(--text-muted)' }}>{formatDate(f.created_at?.split('T')[0])}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">
            <i className="ti ti-key"/>Πρόσφατα Licenses
            <Link to="/admin/licenses" className="btn btn-sm" style={{ marginLeft:'auto' }}>Όλα <i className="ti ti-arrow-right"/></Link>
          </div>
          {recentLicenses.map(l => (
            <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <div>
                <span style={{ fontWeight:600 }}>{l.farms?.name||'—'}</span>
                <span className="badge badge-blue" style={{ marginLeft:8, fontSize:10 }}>{l.module_name}</span>
              </div>
              <span className={`badge badge-${l.is_active?'green':'red'}`}>{l.is_active?'Ενεργό':'Ανενεργό'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
