import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { exportTableToExcel, exportToPDF } from '../../lib/exports'

const CATEGORIES_UNIT = ['Κτηνίατρος', 'Τροφοδοσία', 'Εμβολιασμός', 'Συντήρηση', 'Αγορές', 'Διοικητικό', 'Άλλο (μονάδα)']
const CATEGORIES_PERSONAL = ['Προσωπικό', 'Οικογένεια', 'Υγεία', 'Οικονομικά', 'Άλλο (προσωπικό)']
const PRIORITIES = { high: 'Υψηλή', medium: 'Μέτρια', low: 'Χαμηλή' }

const emptyForm = {
  title: '', description: '', category: CATEGORIES_UNIT[0],
  category_type: 'unit', priority: 'medium',
  due_date: '', due_time: '', completed: false,
}

export default function Todos() {
  const { farmId } = useAuth()
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('todos').select('*').eq('farm_id', farmId).order('due_date', { ascending: true }).order('due_time', { ascending: true })
    setTodos(data || [])
    setLoading(false)
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const filtered = todos.filter(t => {
    if (filter === 'pending' && t.completed) return false
    if (filter === 'completed' && !t.completed) return false
    if (filter === 'overdue' && (t.completed || !t.due_date || t.due_date >= today)) return false
    if (filter === 'today' && t.due_date !== today) return false
    if (catFilter === 'unit' && t.category_type !== 'unit') return false
    if (catFilter === 'personal' && t.category_type !== 'personal') return false
    return true
  })

  const pending = todos.filter(t => !t.completed).length
  const overdue = todos.filter(t => !t.completed && t.due_date && t.due_date < today).length
  const todayCount = todos.filter(t => !t.completed && t.due_date === today).length

  function openNew() {
    setForm({ ...emptyForm, due_date: today })
    setEditId(null)
    setShowModal(true)
  }

  function openEdit(t) {
    setForm({ ...t })
    setEditId(t.id)
    setShowModal(true)
  }

  async function save() {
    if (!form.title) return alert('Ο τίτλος είναι υποχρεωτικός')
    setSaving(true)
    if (editId) {
      await supabase.from('todos').update(form).eq('id', editId)
    } else {
      await supabase.from('todos').insert(form)
    }
    setSaving(false); setShowModal(false); load()
  }

  async function toggleComplete(t) {
    await supabase.from('todos').update({ completed: !t.completed }).eq('id', t.id)
    load()
  }

  async function deleteTodo(id) {
    if (!confirm('Διαγραφή εργασίας;')) return
    await supabase.from('todos').delete().eq('id', id)
    load()
  }

  function priorityBadge(p) {
    if (p === 'high') return <span className="badge badge-red">Υψηλή</span>
    if (p === 'medium') return <span className="badge badge-amber">Μέτρια</span>
    return <span className="badge badge-green">Χαμηλή</span>
  }

  function isOverdue(t) {
    if (!t.due_date || t.completed) return false
    if (t.due_date < today) return true
    if (t.due_date === today && t.due_time) {
      return t.due_time < now.toTimeString().slice(0, 5)
    }
    return false
  }

  function handleExportExcel() {
    exportTableToExcel(filtered.map(t => ({
      'Τίτλος': t.title,
      'Κατηγορία': t.category,
      'Τύπος': t.category_type === 'unit' ? 'Μονάδα' : 'Προσωπικό',
      'Προτεραιότητα': PRIORITIES[t.priority],
      'Ημερομηνία': t.due_date || '',
      'Ώρα': t.due_time || '',
      'Κατάσταση': t.completed ? 'Ολοκληρώθηκε' : 'Εκκρεμεί',
      'Περιγραφή': t.description || '',
    })), 'Εργασίες')
  }

  function handleExportPDF() {
    exportToPDF({
      title: 'Λίστα Εργασιών',
      headers: ['Τίτλος', 'Κατηγορία', 'Προτεραιότητα', 'Προθεσμία', 'Κατάσταση'],
      rows: filtered.map(t => [
        t.title,
        t.category,
        PRIORITIES[t.priority],
        t.due_date ? `${t.due_date}${t.due_time ? ' ' + t.due_time : ''}` : '—',
        t.completed ? '✓ Ολοκληρώθηκε' : 'Εκκρεμεί',
      ]),
      filename: 'Εργασίες',
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Εργασίες & Υπενθυμίσεις</div>
          <div className="page-subtitle">{pending} εκκρεμείς · {todos.length} συνολικά</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleExportExcel}><i className="ti ti-file-spreadsheet" />Excel</button>
          <button className="btn" onClick={handleExportPDF}><i className="ti ti-file-type-pdf" />PDF</button>
          <button className="btn btn-primary" onClick={openNew}><i className="ti ti-plus" />Νέα εργασία</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Εκκρεμείς</div><div className="stat-value blue">{pending}</div></div>
        <div className="stat-card"><div className="stat-label">Σήμερα</div><div className="stat-value amber">{todayCount}</div></div>
        <div className="stat-card"><div className="stat-label">Εκπρόθεσμες</div><div className="stat-value red">{overdue}</div></div>
        <div className="stat-card"><div className="stat-label">Ολοκληρώθηκαν</div><div className="stat-value green">{todos.filter(t => t.completed).length}</div></div>
      </div>

      {overdue > 0 && (
        <div className="notice notice-danger">
          <i className="ti ti-alert-triangle" /> {overdue} εκπρόθεσμες εργασίες χρειάζονται προσοχή!
        </div>
      )}

      {/* Filters */}
      <div className="search-bar">
        {[
          { key: 'all', label: 'Όλες' },
          { key: 'pending', label: 'Εκκρεμείς' },
          { key: 'today', label: 'Σήμερα' },
          { key: 'overdue', label: `Εκπρόθεσμες${overdue > 0 ? ` (${overdue})` : ''}` },
          { key: 'completed', label: 'Ολοκληρώθηκαν' },
        ].map(f => (
          <button key={f.key} className={`filter-chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[
            { key: 'all', label: 'Όλες' },
            { key: 'unit', label: '🏭 Μονάδα' },
            { key: 'personal', label: '👤 Προσωπικές' },
          ].map(f => (
            <button key={f.key} className={`filter-chip${catFilter === f.key ? ' active' : ''}`} onClick={() => setCatFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Todo list */}
      {loading ? <div className="loading"><i className="ti ti-loader" /> Φόρτωση...</div> : (
        <div className="card" style={{ padding: '0.5rem 1.25rem' }}>
          {filtered.length === 0 ? (
            <div className="empty-state"><i className="ti ti-checkbox" /><p>Δεν υπάρχουν εργασίες</p></div>
          ) : (
            filtered.map(t => (
              <div key={t.id} className={`todo-item${t.completed ? ' completed' : ''}`}>
                <input
                  type="checkbox"
                  className="todo-checkbox"
                  checked={t.completed}
                  onChange={() => toggleComplete(t)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="todo-title" style={{ color: isOverdue(t) ? 'var(--red)' : undefined }}>
                      {t.title}
                    </span>
                    {priorityBadge(t.priority)}
                    <span className={`badge badge-${t.category_type === 'unit' ? 'blue' : 'gray'}`}>
                      {t.category_type === 'unit' ? '🏭' : '👤'} {t.category}
                    </span>
                    {isOverdue(t) && <span className="badge badge-red">Εκπρόθεσμη</span>}
                  </div>
                  {t.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{t.description}</div>
                  )}
                  <div className="todo-meta">
                    {t.due_date && (
                      <span style={{ color: isOverdue(t) ? 'var(--red)' : undefined }}>
                        <i className="ti ti-calendar" style={{ fontSize: 12 }} /> {t.due_date}
                        {t.due_time && <> <i className="ti ti-clock" style={{ fontSize: 12 }} /> {t.due_time}</>}
                      </span>
                    )}
                    {t.completed && <span style={{ color: 'var(--green)' }}><i className="ti ti-check" style={{ fontSize: 12 }} /> Ολοκληρώθηκε</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-sm" onClick={() => openEdit(t)}><i className="ti ti-edit" /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteTodo(t.id)}><i className="ti ti-trash" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Επεξεργασία εργασίας' : 'Νέα εργασία'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Τίτλος *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Περιγραφή εργασίας..." />
            </div>

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Τύπος</label>
                <select value={form.category_type} onChange={e => setForm({ ...form, category_type: e.target.value, category: e.target.value === 'unit' ? CATEGORIES_UNIT[0] : CATEGORIES_PERSONAL[0] })}>
                  <option value="unit">🏭 Μονάδα</option>
                  <option value="personal">👤 Προσωπική</option>
                </select>
              </div>
              <div className="form-group">
                <label>Κατηγορία</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {(form.category_type === 'unit' ? CATEGORIES_UNIT : CATEGORIES_PERSONAL).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ημερομηνία εκτέλεσης</label>
                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Ώρα εκτέλεσης</label>
                <input type="time" value={form.due_time} onChange={e => setForm({ ...form, due_time: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Προτεραιότητα</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="high">🔴 Υψηλή</option>
                  <option value="medium">🟡 Μέτρια</option>
                  <option value="low">🟢 Χαμηλή</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Περιγραφή / Σημειώσεις</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Προαιρετικές λεπτομέρειες..." />
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
