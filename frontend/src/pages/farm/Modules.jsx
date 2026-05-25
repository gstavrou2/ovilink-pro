import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

const MODULE_INFO = {
  animals: { label: 'Ζώα & Καρτέλες', icon: 'ti-paw', description: 'Διαχείριση ζώων, καρτέλες, γενεαλογία', base: true },
  milk: { label: 'Γαλακτομετρήσεις', icon: 'ti-droplet', description: 'Ημερήσιες & ατομικές μετρήσεις, γραφήματα', base: true },
  vaccines: { label: 'Εμβολιασμοί', icon: 'ti-vaccine', description: 'Πρόγραμμα εμβολιασμών, υπενθυμίσεις', base: true },
  costs: { label: 'Κοστολόγιο', icon: 'ti-cash', description: 'Έξοδα, έσοδα, ανάλυση ανά group', base: true },
  warehouse: { label: 'Αποθήκη', icon: 'ti-building-warehouse', description: 'Διαχείριση αποθέματος, κινήσεις', base: true },
  groups: { label: 'Groups & Σιτηρέσια', icon: 'ti-folders', description: 'Ομαδοποίηση ζώων, σιτηρέσια, κόστος', base: true },
  todos: { label: 'Εργασίες', icon: 'ti-checkbox', description: 'To-do list με υπενθυμίσεις', base: true },
  carbon_footprint: { label: 'Αποτύπωμα Άνθρακα', icon: 'ti-leaf', description: 'Υπολογισμός CO2 ανά ζώο και παραγωγή', base: false },
  business_intelligence: { label: 'Business Intelligence', icon: 'ti-chart-bar', description: 'Αναλυτικά reports, KPIs, προβλέψεις', base: false },
  advanced_reports: { label: 'Αναφορές Pro', icon: 'ti-report', description: 'Εξαγωγή αναφορών σε PDF/Excel Pro', base: false },
  opekepe_integration: { label: 'ΟΠΕΚΕΠΕ Integration', icon: 'ti-plug', description: 'Σύνδεση με ΟΠΕΚΕΠΕ για επιδοτήσεις', base: false },
}

export default function Modules() {
  const { isAdmin } = useAuth()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadModules() }, [])

  async function loadModules() {
    setLoading(true)
    try {
      const data = await api.getModules()
      setModules(data || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  async function handleActivate(e) {
    e.preventDefault()
    if (!licenseKey.trim()) return
    setActivating(true); setMessage(null)
    try {
      const result = await api.activateLicense(licenseKey.trim())
      setMessage({ type: 'success', text: result.message })
      setLicenseKey('')
      loadModules()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    setActivating(false)
  }

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  const baseModules = modules.filter(m => MODULE_INFO[m.name]?.base)
  const premiumModules = modules.filter(m => !MODULE_INFO[m.name]?.base)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Modules & Άδειες</div>
          <div className="page-subtitle">Διαχείριση ενεργών modules της φάρμας</div>
        </div>
      </div>

      {/* Activate license */}
      {isAdmin && (
        <div className="card" style={{ marginBottom:'1.5rem' }}>
          <div className="card-title"><i className="ti ti-key"/>Ενεργοποίηση license key</div>
          {message && (
            <div className={`notice notice-${message.type==='success'?'success':'danger'}`} style={{ marginBottom:'1rem' }}>
              <i className={`ti ti-${message.type==='success'?'check':'alert-circle'}`}/> {message.text}
            </div>
          )}
          <form onSubmit={handleActivate} style={{ display:'flex', gap:8, maxWidth:500 }}>
            <input
              className="search-input"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder="OVL-XXXX-XXXXXXXX-XXXXXXXXXXXXXXXX"
              style={{ fontFamily:'monospace', fontSize:13 }}
            />
            <button type="submit" className="btn btn-primary" disabled={activating}>
              {activating ? <><i className="ti ti-loader"/>...</> : <><i className="ti ti-check"/>Ενεργοποίηση</>}
            </button>
          </form>
        </div>
      )}

      {/* Base modules */}
      <div className="card-title" style={{ marginBottom:'1rem' }}><i className="ti ti-package"/>Base Modules</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {baseModules.map(m => {
          const info = MODULE_INFO[m.name] || {}
          return (
            <div key={m.name} style={{ background:'var(--surface)', border:`1px solid ${m.is_active?'var(--green)':'var(--border)'}`, borderRadius:'var(--radius)', padding:'1rem', position:'relative' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:m.is_active?'var(--green-light)':'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`ti ${info.icon||'ti-puzzle'}`} style={{ fontSize:20, color:m.is_active?'var(--green)':'var(--text-muted)' }}/>
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{info.label||m.name}</div>
                  <span className={`badge badge-${m.is_active?'green':'gray'}`} style={{ fontSize:10 }}>
                    {m.is_active?'Ενεργό':'Ανενεργό'}
                  </span>
                </div>
              </div>
              <p style={{ fontSize:12, color:'var(--text-muted)' }}>{info.description}</p>
              {m.license?.expires_at && (
                <div style={{ fontSize:11, color:'var(--amber)', marginTop:6 }}>
                  <i className="ti ti-clock"/> Λήξη: {new Date(m.license.expires_at).toLocaleDateString('el-GR')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Premium modules */}
      <div className="card-title" style={{ marginBottom:'1rem' }}><i className="ti ti-star"/>Premium Modules</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem' }}>
        {premiumModules.map(m => {
          const info = MODULE_INFO[m.name] || {}
          return (
            <div key={m.name} style={{ background:'var(--surface)', border:`2px solid ${m.is_active?'var(--green)':'var(--border)'}`, borderRadius:'var(--radius)', padding:'1rem', position:'relative', opacity:m.is_active?1:0.7 }}>
              {!m.is_active && (
                <div style={{ position:'absolute', top:10, right:10 }}>
                  <i className="ti ti-lock" style={{ color:'var(--text-muted)', fontSize:18 }}/>
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:m.is_active?'var(--green-light)':'var(--gray-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`ti ${info.icon||'ti-puzzle'}`} style={{ fontSize:20, color:m.is_active?'var(--green)':'var(--gray)' }}/>
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{info.label||m.name}</div>
                  <span className={`badge badge-${m.is_active?'green':'gray'}`} style={{ fontSize:10 }}>
                    {m.is_active?'Ενεργό':'Κλειδωμένο'}
                  </span>
                </div>
              </div>
              <p style={{ fontSize:12, color:'var(--text-muted)' }}>{info.description}</p>
              {!m.is_active && isAdmin && (
                <p style={{ fontSize:11, color:'var(--blue)', marginTop:6 }}>
                  <i className="ti ti-info-circle"/> Επικοινωνήστε με τον διαχειριστή για license key
                </p>
              )}
              {m.license?.expires_at && (
                <div style={{ fontSize:11, color:'var(--amber)', marginTop:6 }}>
                  <i className="ti ti-clock"/> Λήξη: {new Date(m.license.expires_at).toLocaleDateString('el-GR')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
