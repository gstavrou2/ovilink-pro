import { useEffect, useState } from 'react'
import { supabase } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_LABELS = { active: 'Ενεργή', dry: 'Ξηρή', pregnant: 'Έγκυος', sold: 'Πωλήθηκε', dead: 'Νεκρή' }
const STATUS_BADGES = { active: 'green', dry: 'gray', pregnant: 'blue', sold: 'amber', dead: 'red' }
const BREEDS_SHEEP = ['Χίος', 'Φριζάρτα', 'Λακαούν', 'Κυπρίνα', 'Καραγκούνικη', 'Άλλη']
const BREEDS_GOAT = ['Αλπική', 'Σάανεν', 'Αίγα Μακεδονίας', 'Τοπική', 'Άλλη']

const emptyForm = { code: '', type: 'sheep', breed: '', dob: '', ear_tag: '', status: 'active', mother_code: '', father_code: '', notes: '' }

export default function Animals() {
  const { farmId } = useAuth()
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showView, setShowView] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('animals').select('*').eq('farm_id', farmId).order('code')
    setAnimals(data || [])
    setLoading(false)
  }

  const filtered = animals.filter(a => {
    if (filter !== 'all' && a.type !== filter) return false
    if (search && !a.code.toLowerCase().includes(search.toLowerCase()) && !(a.breed || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openNew() { setForm(emptyForm); setEditId(null); setShowModal(true) }
  function openEdit(a) { setForm({ ...a }); setEditId(a.id); setShowModal(true) }

  async function save() {
    if (!form.code) return alert('Ο κωδικός είναι υποχρεωτικός')
    setSaving(true)
    if (editId) {
      await supabase.from('animals').update(form).eq('id', editId)
    } else {
      const exists = animals.find(a => a.code === form.code)
      if (exists) { alert('Ο κωδικός υπάρχει ήδη'); setSaving(false); return }
      await supabase.from('animals').insert({ ...form, farm_id: farmId })
    }
    setSaving(false); setShowModal(false); load()
  }

  async function deleteAnimal(id) {
    if (!confirm('Διαγραφή ζώου; Η ενέργεια δεν αναιρείται.')) return
    await supabase.from('animals').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Ζώα</div>
          <div className="page-subtitle">{animals.length} καταχωρημένα ζώα</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}><i className="ti ti-plus" />Προσθήκη ζώου</button>
      </div>

      <div className="search-bar">
        <input className="search-input" placeholder="Αναζήτηση κωδικού, φυλής..." value={search} onChange={e => setSearch(e.target.value)} />
        {['all', 'sheep', 'goat'].map(f => (
          <button key={f} className={`filter-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Όλα' : f === 'sheep' ? 'Προβατίνες' : 'Αίγες'}
          </button>
        ))}
      </div>

      {loading ? <div className="loading"><i className="ti ti-loader" /> Φόρτωση...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Κωδικός</th><th>Είδος</th><th>Φυλή</th><th>Ημ. Γέννησης</th>
                <th>Ενώτιο</th><th>Κατάσταση</th><th>Μητέρα</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-paw" /><p>Δεν βρέθηκαν ζώα</p></div></td></tr>
              ) : filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.code}</td>
                  <td>{a.type === 'sheep' ? 'Προβατίνα' : 'Αίγα'}</td>
                  <td>{a.breed || '—'}</td>
                  <td>{a.dob || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.ear_tag || '—'}</td>
                  <td><span className={`badge badge-${STATUS_BADGES[a.status] || 'gray'}`}>{STATUS_LABELS[a.status] || a.status}</span></td>
                  <td>{a.mother_code || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm" onClick={() => setShowView(a)} title="Καρτέλα"><i className="ti ti-eye" /></button>
                      <button className="btn btn-sm" onClick={() => openEdit(a)} title="Επεξεργασία"><i className="ti ti-edit" /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteAnimal(a.id)} title="Διαγραφή"><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Επεξεργασία ζώου' : 'Νέα καρτέλα ζώου'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group"><label>Κωδικός *</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="πχ. ΠΡ-001" /></div>
              <div className="form-group"><label>Είδος *</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, breed: '' })}>
                  <option value="sheep">Προβατίνα</option>
                  <option value="goat">Αίγα</option>
                </select>
              </div>
              <div className="form-group"><label>Φυλή</label>
                <select value={form.breed} onChange={e => setForm({ ...form, breed: e.target.value })}>
                  <option value="">Επιλογή...</option>
                  {(form.type === 'sheep' ? BREEDS_SHEEP : BREEDS_GOAT).map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Ημ. Γέννησης</label><input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></div>
              <div className="form-group"><label>Αρ. Ενωτίου</label><input value={form.ear_tag} onChange={e => setForm({ ...form, ear_tag: e.target.value })} placeholder="GR..." /></div>
              <div className="form-group"><label>Κατάσταση</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Μητέρα (κωδικός)</label><input value={form.mother_code} onChange={e => setForm({ ...form, mother_code: e.target.value })} placeholder="Προαιρετικό" list="animal-codes" /></div>
              <div className="form-group"><label>Πατέρας (κωδικός)</label><input value={form.father_code} onChange={e => setForm({ ...form, father_code: e.target.value })} placeholder="Προαιρετικό" /></div>
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}><label>Σημειώσεις</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Animal Card */}
      {showView && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowView(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Καρτέλα: {showView.code}</div>
              <button className="btn btn-sm" onClick={() => setShowView(null)}><i className="ti ti-x" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: 13 }}>
              {[
                ['Κωδικός', showView.code], ['Είδος', showView.type === 'sheep' ? 'Προβατίνα' : 'Αίγα'],
                ['Φυλή', showView.breed || '—'], ['Ημ. Γέννησης', showView.dob || '—'],
                ['Αρ. Ενωτίου', showView.ear_tag || '—'], ['Κατάσταση', STATUS_LABELS[showView.status]],
                ['Μητέρα', showView.mother_code || '—'], ['Πατέρας', showView.father_code || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{k}</div>
                  <div style={{ fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            {showView.notes && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 13 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Σημειώσεις</div>
                {showView.notes}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn" onClick={() => { setShowView(null); openEdit(showView) }}><i className="ti ti-edit" />Επεξεργασία</button>
              <button className="btn" onClick={() => setShowView(null)}>Κλείσιμο</button>
            </div>
          </div>
        </div>
      )}
      <datalist id="animal-codes">{animals.map(a => <option key={a.id} value={a.code} />)}</datalist>
    </div>
  )
}
