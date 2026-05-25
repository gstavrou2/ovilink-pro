import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/exports'

const MODULES = [
  'animals','milk','vaccines','costs','warehouse','groups','todos',
  'carbon_footprint','business_intelligence','advanced_reports','opekepe_integration'
]

const emptyForm = { farm_id: '', module_name: MODULES[0], expires_at: '', max_users: '' }

export default function AdminLicenses() {
  const [licenses, setLicenses] = useState([])
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [newLicense, setNewLicense] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [lics, fms] = await Promise.all([api.getLicenses(), api.getFarms()])
    setLicenses(lics || [])
    setFarms(fms || [])
    setLoading(false)
  }

  async function generate() {
    if (!form.farm_id || !form.module_name) return alert('Φάρμα και module απαιτούνται')
    setSaving(true)
    try {
      const result = await api.generateLicense({
        farm_id: form.farm_id,
        module_name: form.module_name,
        expires_at: form.expires_at || null,
        max_users: parseInt(form.max_users) || null,
      })
      setNewLicense(result)
      load()
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  async function revoke(id) {
    if (!confirm('Απενεργοποίηση license;')) return
    await api.revokeLicense(id)
    load()
  }

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Διαχείριση Licenses</div>
          <div className="page-subtitle">{licenses.length} licenses</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setNewLicense(null); setShowModal(true) }}>
          <i className="ti ti-plus"/>Νέο license
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Φάρμα</th><th>Module</th><th>License Key</th><th>Λήξη</th><th>Κατάσταση</th><th>Ενεργοποίηση</th><th></th></tr>
          </thead>
          <tbody>
            {licenses.length===0
              ? <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-key"/><p>Δεν υπάρχουν licenses</p></div></td></tr>
              : licenses.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight:600 }}>{l.farms?.name||'—'}</td>
                  <td><span className="badge badge-blue">{l.module_name}</span></td>
                  <td style={{ fontFamily:'monospace', fontSize:11 }}>{l.license_key}</td>
                  <td>{l.expires_at ? formatDate(l.expires_at.split('T')[0]) : 'Χωρίς λήξη'}</td>
                  <td><span className={`badge badge-${l.is_active?'green':'red'}`}>{l.is_active?'Ενεργό':'Ανενεργό'}</span></td>
                  <td>{l.activated_at ? <span className="badge badge-green">✓ {formatDate(l.activated_at.split('T')[0])}</span> : <span className="badge badge-gray">Αναμονή</span>}</td>
                  <td>{l.is_active && <button className="btn btn-sm btn-danger" onClick={() => revoke(l.id)}><i className="ti ti-ban"/></button>}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Δημιουργία License Key</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><i className="ti ti-x"/></button>
            </div>

            {newLicense ? (
              <div>
                <div className="notice notice-success" style={{ marginBottom:'1rem' }}>
                  <i className="ti ti-check"/> License δημιουργήθηκε επιτυχώς!
                </div>
                <div style={{ background:'var(--bg)', padding:'1rem', borderRadius:8, marginBottom:'1rem' }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>License Key — Αντίγραψέ το τώρα!</div>
                  <div style={{ fontFamily:'monospace', fontSize:14, fontWeight:600, letterSpacing:1, wordBreak:'break-all' }}>{newLicense.license_key}</div>
                </div>
                <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(newLicense.license_key); alert('Αντιγράφηκε!') }}>
                  <i className="ti ti-copy"/>Αντιγραφή
                </button>
              </div>
            ) : (
              <>
                <div className="form-grid" style={{ marginBottom:'1rem' }}>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label>Φάρμα *</label>
                    <select value={form.farm_id} onChange={e => setForm({...form, farm_id:e.target.value})}>
                      <option value="">Επιλογή φάρμας...</option>
                      {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Module *</label>
                    <select value={form.module_name} onChange={e => setForm({...form, module_name:e.target.value})}>
                      {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ημ. λήξης (προαιρετικό)</label>
                    <input type="date" value={form.expires_at} onChange={e => setForm({...form, expires_at:e.target.value})}/>
                  </div>
                  <div className="form-group">
                    <label>Max χρήστες</label>
                    <input type="number" min="1" value={form.max_users} onChange={e => setForm({...form, max_users:e.target.value})} placeholder="Χωρίς όριο"/>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn" onClick={() => setShowModal(false)}>Ακύρωση</button>
                  <button className="btn btn-primary" onClick={generate} disabled={saving}>
                    {saving?'Δημιουργία...':'Δημιουργία License'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
