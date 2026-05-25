import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

import { formatDate } from '../../lib/exports'

const emptyForm = { name: '', address: '', phone: '', email: '', notes: '' }

export default function AdminFarms() {
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [farmStats, setFarmStats] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: farms } = await supabase.from('farms').select('*').order('name')
    setFarms(farms || [])

    // Load animal counts per farm
    const { data: animals } = await supabase.from('animals').select('farm_id')
    const counts = {}
    ;(animals || []).forEach(a => { counts[a.farm_id] = (counts[a.farm_id] || 0) + 1 })
    setFarmStats(counts)
    setLoading(false)
  }

  function openNew() { setForm(emptyForm); setEditId(null); setShowModal(true) }
  function openEdit(f) { setForm({ name:f.name, address:f.address||'', phone:f.phone||'', email:f.email||'', notes:f.notes||'' }); setEditId(f.id); setShowModal(true) }

  async function save() {
    if (!form.name) return alert('Το όνομα είναι υποχρεωτικό')
    setSaving(true)
    if (editId) {
      await supabase.from('farms').update(form).eq('id', editId)
    } else {
      await supabase.from('farms').insert(form)
    }
    setSaving(false); setShowModal(false); load()
  }

  async function deleteFarm(id) {
    if (!confirm('Διαγραφή φάρμας; Θα διαγραφούν ΟΛΑ τα δεδομένα της (ζώα, μετρήσεις κλπ). Η ενέργεια δεν αναιρείται!')) return
    await supabase.from('farms').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Διαχείριση Φαρμών</div>
          <div className="page-subtitle">{farms.length} καταχωρημένες φάρμες</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}><i className="ti ti-plus"/>Νέα φάρμα</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Όνομα</th><th>Email</th><th>Τηλέφωνο</th><th>Ζώα</th><th>Δημιουργία</th><th></th></tr>
          </thead>
          <tbody>
            {farms.length === 0
              ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-building"/><p>Δεν υπάρχουν φάρμες</p></div></td></tr>
              : farms.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight:600 }}>{f.name}</td>
                  <td>{f.email || '—'}</td>
                  <td>{f.phone || '—'}</td>
                  <td><span className="badge badge-blue">{farmStats[f.id] || 0} ζώα</span></td>
                  <td>{formatDate(f.created_at?.split('T')[0])}</td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(f)}><i className="ti ti-edit"/></button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteFarm(f.id)}><i className="ti ti-trash"/></button>
                    </div>
                  </td>
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
              <div className="modal-title">{editId ? 'Επεξεργασία φάρμας' : 'Νέα φάρμα'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><i className="ti ti-x"/></button>
            </div>
            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Όνομα φάρμας *</label>
                <input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="πχ. Κτηνοτροφική Μονάδα Παπαδόπουλου"/>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="farm@example.com"/>
              </div>
              <div className="form-group">
                <label>Τηλέφωνο</label>
                <input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="69xxxxxxxx"/>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Διεύθυνση</label>
                <input value={form.address} onChange={e => setForm({...form, address:e.target.value})} placeholder="Οδός, Πόλη"/>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:'1rem' }}>
              <label>Σημειώσεις</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})}/>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Αποθήκευση...':'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
