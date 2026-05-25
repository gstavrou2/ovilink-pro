import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/exports'

const ROLES = ['admin', 'manager', 'viewer']

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [form, setForm] = useState({ role: 'manager', farm_id: '' })
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'manager', farm_id: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviteError, setInviteError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [usersRes, farmsRes] = await Promise.all([
      supabase.from('user_profiles').select('*, farms(name)').order('created_at', { ascending: false }),
      supabase.from('farms').select('id,name').order('name'),
    ])
    setUsers(usersRes.data || [])
    setFarms(farmsRes.data || [])
    setLoading(false)
  }

  function openEdit(u) {
    setForm({ role: u.role, farm_id: u.farm_id || '' })
    setEditId(u.id)
    setShowModal(true)
  }

  async function saveUser() {
    setSaving(true)
    await supabase.from('user_profiles').update({
      role: form.role,
      farm_id: form.farm_id || null,
    }).eq('id', editId)
    setSaving(false); setShowModal(false); load()
  }

  async function inviteUser() {
    if (!inviteForm.email) return alert('Email είναι υποχρεωτικό')
    setSaving(true); setInviteStatus(''); setInviteError('')

    try {
      const res = await fetch('/.netlify/functions/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          role: inviteForm.role,
          farm_id: inviteForm.farm_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error || 'Σφάλμα κατά τη δημιουργία χρήστη')
      } else {
        setInviteStatus(`✅ Ο χρήστης ${inviteForm.email} δημιουργήθηκε! Στείλτου το link επαναφοράς κωδικού από το Supabase.`)
        load()
      }
    } catch (e) {
      setInviteError('Σφάλμα σύνδεσης: ' + e.message)
    }
    setSaving(false)
  }

  async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) alert('Σφάλμα: ' + error.message)
    else alert(`Email επαναφοράς κωδικού στάλθηκε στο ${email}`)
  }

  async function deleteUser(id) {
    if (!confirm('Διαγραφή χρήστη;')) return
    await supabase.from('user_profiles').delete().eq('id', id)
    load()
  }

  function roleBadge(role) {
    if (role === 'admin') return <span className="badge badge-red">Admin</span>
    if (role === 'manager') return <span className="badge badge-blue">Manager</span>
    return <span className="badge badge-gray">Viewer</span>
  }

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Διαχείριση Χρηστών</div>
          <div className="page-subtitle">{users.length} καταχωρημένοι χρήστες</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setInviteForm({ email:'', role:'manager', farm_id:'' }); setInviteStatus(''); setInviteError(''); setShowInviteModal(true) }}>
          <i className="ti ti-user-plus"/>Νέος χρήστης
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Email</th><th>Role</th><th>Φάρμα</th><th>Εγγραφή</th><th></th></tr>
          </thead>
          <tbody>
            {users.length === 0
              ? <tr><td colSpan={5}><div className="empty-state"><i className="ti ti-users"/><p>Δεν υπάρχουν χρήστες</p></div></td></tr>
              : users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight:500 }}>{u.email || '—'}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>{u.farms?.name || <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                  <td>{formatDate(u.created_at?.split('T')[0])}</td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(u)} title="Επεξεργασία role/φάρμας"><i className="ti ti-edit"/></button>
                      <button className="btn btn-sm" onClick={() => sendPasswordReset(u.email)} title="Αποστολή reset κωδικού"><i className="ti ti-mail"/></button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)}><i className="ti ti-trash"/></button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Επεξεργασία χρήστη</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><i className="ti ti-x"/></button>
            </div>
            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Φάρμα</label>
                <select value={form.farm_id} onChange={e => setForm({...form, farm_id:e.target.value})}>
                  <option value="">Χωρίς φάρμα</option>
                  {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={saving}>{saving?'Αποθήκευση...':'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowInviteModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Νέος χρήστης</div>
              <button className="btn btn-sm" onClick={() => setShowInviteModal(false)}><i className="ti ti-x"/></button>
            </div>

            {inviteError && (
              <div className="notice notice-danger" style={{ marginBottom:'1rem' }}>
                <i className="ti ti-alert-circle"/> {inviteError}
              </div>
            )}
            {inviteStatus && (
              <div className="notice notice-success" style={{ marginBottom:'1rem' }}>
                {inviteStatus}
              </div>
            )}

            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Email *</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email:e.target.value})} placeholder="user@example.com"/>
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role:e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Φάρμα</label>
                <select value={inviteForm.farm_id} onChange={e => setInviteForm({...inviteForm, farm_id:e.target.value})}>
                  <option value="">Επιλογή φάρμας...</option>
                  {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            <div className="notice notice-warning">
              <i className="ti ti-info-circle"/> Μετά τη δημιουργία, πάτα το <strong>✉️</strong> για να στείλεις email επαναφοράς κωδικού στον χρήστη.
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowInviteModal(false)}>Κλείσιμο</button>
              <button className="btn btn-primary" onClick={inviteUser} disabled={saving}>
                {saving ? 'Δημιουργία...' : <><i className="ti ti-user-plus"/>Δημιουργία χρήστη</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
