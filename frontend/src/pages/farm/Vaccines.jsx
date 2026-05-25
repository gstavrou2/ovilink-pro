import { useEffect, useState } from 'react'
import { supabase } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { differenceInDays, parseISO } from 'date-fns'
import { formatDate, exportTableToExcel, exportToPDF } from '../../lib/exports'

const VACCINES = ['Brucella', 'Pasteurella', 'Enterotoxaemia', 'Foot & Mouth', 'PPR', 'Orf', 'Άλλο']
const emptyForm = {
  mode: 'individual', // 'individual' or 'group'
  animal_id: '',
  group_id: '',
  vaccine_name: '',
  date: new Date().toISOString().split('T')[0],
  next_date: '',
  vet_name: '',
  dose_ml: '',
  batch_no: '',
  notes: '',
}

export default function Vaccines() {
  const { farmId } = useAuth()
  const [records, setRecords] = useState([])
  const [animals, setAnimals] = useState([])
  const [groups, setGroups] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [recsRes, animRes, grpRes, memRes] = await Promise.all([
      supabase.from('vaccines').select('*,animals(code,type),animal_groups(name,color)').eq('farm_id', farmId).order('date', { ascending: false }),
      supabase.from('animals').select('id,code,type').eq('status', 'active').order('code'),
      supabase.from('animal_groups').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('animal_group_members').select('*,animals(id,code,type)').eq('farm_id', farmId).order('joined_date'),
    ])
    setRecords(recsRes.data || [])
    setAnimals(animRes.data || [])
    setGroups(grpRes.data || [])
    setGroupMembers(memRes.data || [])
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]

  const filteredRecords = records.filter(r => {
    if (filterGroup === 'all') return true
    if (filterGroup === 'individual') return !r.group_id
    return r.group_id === filterGroup
  })

  const upcoming = filteredRecords.filter(r => r.next_date && r.next_date >= today).sort((a, b) => a.next_date.localeCompare(b.next_date))
  const overdue = filteredRecords.filter(r => r.next_date && r.next_date < today).sort((a, b) => b.next_date.localeCompare(a.next_date))
  const history = [...filteredRecords].sort((a, b) => b.date.localeCompare(a.date))

  async function save() {
    if (!form.vaccine_name || !form.date) return alert('Εμβόλιο και ημερομηνία είναι υποχρεωτικά')

    setSaving(true)

    if (form.mode === 'group') {
      // Vaccinate all animals in group
      if (!form.group_id) { alert('Επέλεξε group'); setSaving(false); return }
      const members = groupMembers.filter(m => m.group_id === form.group_id)
      if (members.length === 0) { alert('Το group δεν έχει ζώα'); setSaving(false); return }

      const inserts = members.map(m => ({
        animal_id: m.animal_id,
        group_id: form.group_id,
        vaccine_name: form.vaccine_name,
        date: form.date,
        next_date: form.next_date || null,
        vet_name: form.vet_name,
        dose_ml: parseFloat(form.dose_ml) || null,
        batch_no: form.batch_no,
        notes: form.notes,
      }))
      await supabase.from('vaccines').insert(inserts)
    } else {
      if (!form.animal_id) { alert('Επέλεξε ζώο'); setSaving(false); return }
      await supabase.from('vaccines').insert({...{
        animal_id: form.animal_id,
        group_id: null,
        vaccine_name: form.vaccine_name,
        date: form.date,
        next_date: form.next_date || null,
        vet_name: form.vet_name,
        dose_ml: parseFloat(form.dose_ml) || null,
        batch_no: form.batch_no,
        notes: form.notes,
      }, farm_id: farmId})
    }

    setSaving(false); setShowModal(false); setForm(emptyForm); loadAll()
  }

  async function deleteRecord(id) {
    if (!confirm('Διαγραφή εμβολιασμού;')) return
    await supabase.from('vaccines').delete().eq('id', id)
    loadAll()
  }

  async function deleteGroupVaccination(groupId, vaccineName, date) {
    if (!confirm(`Διαγραφή εμβολιασμού "${vaccineName}" για όλο το group;`)) return
    await supabase.from('vaccines').delete().eq('group_id', groupId).eq('vaccine_name', vaccineName).eq('date', date)
    loadAll()
  }

  function daysLabel(dateStr) {
    const d = differenceInDays(parseISO(dateStr), new Date())
    if (d === 0) return 'Σήμερα'
    if (d < 0) return `${Math.abs(d)}μ εκπρόθεσμο`
    return `σε ${d}μ`
  }

  function daysBadge(dateStr) {
    const d = differenceInDays(parseISO(dateStr), new Date())
    if (d < 0) return 'red'
    if (d <= 7) return 'red'
    if (d <= 21) return 'amber'
    return 'green'
  }

  // Group history — deduplicate by group+vaccine+date
  function getGroupHistory() {
    const grouped = {}
    records.filter(r => r.group_id).forEach(r => {
      const key = `${r.group_id}__${r.vaccine_name}__${r.date}`
      if (!grouped[key]) {
        grouped[key] = { ...r, count: 1 }
      } else {
        grouped[key].count++
      }
    })
    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date))
  }

  function handleExportExcel() {
    exportTableToExcel(
      history.map(r => ({
        'Zoo': r.animals?.code || '',
        'Group': r.animal_groups?.name || '—',
        'Emvolio': r.vaccine_name,
        'Hmerominia': formatDate(r.date),
        'Epomeni dosi': formatDate(r.next_date),
        'Dosi (ml)': r.dose_ml || '',
        'Partiida': r.batch_no || '',
        'Ktiniatros': r.vet_name || '',
      })),
      'Emvoliasмoi'
    )
  }

  function handleExportPDF() {
    exportToPDF({
      title: 'Istoriko Emvoliasmон',
      headers: ['Zoo', 'Group', 'Emvolio', 'Hmerominia', 'Epomeni dosi', 'Ktiniatros'],
      rows: history.map(r => [
        r.animals?.code || '',
        r.animal_groups?.name || '—',
        r.vaccine_name,
        formatDate(r.date),
        formatDate(r.next_date),
        r.vet_name || '—',
      ]),
      filename: 'Emvoliasмoi',
    })
  }

  const groupHistory = getGroupHistory()

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Εμβολιασμοί</div>
          <div className="page-subtitle">{records.length} καταχωρημένοι εμβολιασμοί</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleExportExcel}><i className="ti ti-file-spreadsheet" />Excel</button>
          <button className="btn" onClick={handleExportPDF}><i className="ti ti-file-type-pdf" />PDF</button>
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true) }}>
            <i className="ti ti-plus" />Νέος εμβολιασμός
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Σύνολο</div><div className="stat-value blue">{records.length}</div></div>
        <div className="stat-card"><div className="stat-label">Επερχόμενοι (30μ)</div><div className="stat-value amber">{upcoming.length}</div></div>
        <div className="stat-card"><div className="stat-label">Εκπρόθεσμοι</div><div className="stat-value red">{overdue.length}</div></div>
        <div className="stat-card"><div className="stat-label">Ομαδικοί</div><div className="stat-value green">{groupHistory.length}</div></div>
      </div>

      {/* Filter by group */}
      <div className="search-bar">
        <button className={`filter-chip${filterGroup==='all'?' active':''}`} onClick={() => setFilterGroup('all')}>Όλα</button>
        <button className={`filter-chip${filterGroup==='individual'?' active':''}`} onClick={() => setFilterGroup('individual')}>Ατομικοί</button>
        {groups.map(g => (
          <button key={g.id} className={`filter-chip${filterGroup===g.id?' active':''}`} onClick={() => setFilterGroup(g.id)}
            style={{ borderColor: filterGroup===g.id ? g.color : undefined, color: filterGroup===g.id ? g.color : undefined, background: filterGroup===g.id ? g.color+'22' : undefined }}>
            {g.name}
          </button>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab==='upcoming'?' active':''}`} onClick={() => setTab('upcoming')}>
          Πρόγραμμα {overdue.length > 0 && <span className="badge badge-red" style={{ marginLeft: 4 }}>{overdue.length}</span>}
        </button>
        <button className={`tab-btn${tab==='group_history'?' active':''}`} onClick={() => setTab('group_history')}>Ομαδικοί εμβολιασμοί</button>
        <button className={`tab-btn${tab==='history'?' active':''}`} onClick={() => setTab('history')}>Πλήρες ιστορικό</button>
      </div>

      {tab === 'upcoming' && (
        <>
          {overdue.length > 0 && (
            <div className="notice notice-danger"><i className="ti ti-alert-triangle" />{overdue.length} εμβολιασμοί είναι εκπρόθεσμοι!</div>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ζώο</th><th>Group</th><th>Εμβόλιο</th><th>Επόμενη δόση</th><th>Κατάσταση</th><th>Κτηνίατρος</th><th></th></tr></thead>
              <tbody>
                {[...overdue, ...upcoming].length === 0
                  ? <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-calendar-check"/><p>Δεν υπάρχουν προγραμματισμένοι</p></div></td></tr>
                  : [...overdue, ...upcoming].map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.animals?.code || '—'}</td>
                      <td>
                        {r.animal_groups
                          ? <span className="badge" style={{ background: r.animal_groups.color+'22', color: r.animal_groups.color }}>{r.animal_groups.name}</span>
                          : <span className="badge badge-gray">Ατομικό</span>
                        }
                      </td>
                      <td>{r.vaccine_name}</td>
                      <td>{formatDate(r.next_date)}</td>
                      <td>{r.next_date && <span className={`badge badge-${daysBadge(r.next_date)}`}>{daysLabel(r.next_date)}</span>}</td>
                      <td>{r.vet_name || '—'}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteRecord(r.id)}><i className="ti ti-trash"/></button></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'group_history' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Group</th><th>Εμβόλιο</th><th>Ημ. Εμβολιασμού</th><th>Επόμενη δόση</th><th>Αρ. ζώων</th><th>Κτηνίατρος</th><th></th></tr></thead>
            <tbody>
              {groupHistory.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-vaccine"/><p>Δεν υπάρχουν ομαδικοί εμβολιασμοί</p></div></td></tr>
                : groupHistory.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span className="badge" style={{ background: r.animal_groups?.color+'22', color: r.animal_groups?.color }}>
                        {r.animal_groups?.name || '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.vaccine_name}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{formatDate(r.next_date)}</td>
                    <td><span className="badge badge-blue">{r.count} ζώα</span></td>
                    <td>{r.vet_name || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteGroupVaccination(r.group_id, r.vaccine_name, r.date)}>
                        <i className="ti ti-trash"/>
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ζώο</th><th>Group</th><th>Εμβόλιο</th><th>Ημ.</th><th>Επόμενη</th><th>Δόση</th><th>Παρτίδα</th><th>Κτηνίατρος</th><th></th></tr></thead>
            <tbody>
              {history.length === 0
                ? <tr><td colSpan={9}><div className="empty-state"><i className="ti ti-vaccine"/><p>Κανένας εμβολιασμός</p></div></td></tr>
                : history.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.animals?.code || '—'}</td>
                    <td>
                      {r.animal_groups
                        ? <span className="badge" style={{ background: r.animal_groups.color+'22', color: r.animal_groups.color }}>{r.animal_groups.name}</span>
                        : <span className="badge badge-gray">Ατομικό</span>
                      }
                    </td>
                    <td>{r.vaccine_name}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{formatDate(r.next_date)}</td>
                    <td>{r.dose_ml ? `${r.dose_ml} ml` : '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.batch_no || '—'}</td>
                    <td>{r.vet_name || '—'}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => deleteRecord(r.id)}><i className="ti ti-trash"/></button></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Νέος εμβολιασμός</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><i className="ti ti-x"/></button>
            </div>

            {/* Mode selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
              <button
                className={`btn${form.mode==='individual'?' btn-primary':''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setForm({...form, mode: 'individual', group_id: ''})}
              >
                <i className="ti ti-paw"/> Ατομικός
              </button>
              <button
                className={`btn${form.mode==='group'?' btn-primary':''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setForm({...form, mode: 'group', animal_id: ''})}
              >
                <i className="ti ti-folders"/> Ομαδικός (Group)
              </button>
            </div>

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              {form.mode === 'individual' ? (
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Ζώο *</label>
                  <select value={form.animal_id} onChange={e => setForm({...form, animal_id: e.target.value})}>
                    <option value="">Επιλογή ζώου...</option>
                    {animals.map(a => <option key={a.id} value={a.id}>{a.code} ({a.type==='sheep'?'Πρ.':'Αίγα'})</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Group *</label>
                  <select value={form.group_id} onChange={e => setForm({...form, group_id: e.target.value})}>
                    <option value="">Επιλογή group...</option>
                    {groups.map(g => {
                      const count = groupMembers.filter(m => m.group_id === g.id).length
                      return <option key={g.id} value={g.id}>{g.name} ({count} ζώα)</option>
                    })}
                  </select>
                  {form.group_id && (
                    <div style={{ fontSize: 12, color: 'var(--green-dark)', marginTop: 4 }}>
                      <i className="ti ti-info-circle"/> Ο εμβολιασμός θα καταχωρηθεί για όλα τα ζώα του group
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Εμβόλιο *</label>
                <select value={form.vaccine_name} onChange={e => setForm({...form, vaccine_name: e.target.value})}>
                  <option value="">Επιλογή...</option>
                  {VACCINES.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Ημ. Εμβολιασμού *</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              <div className="form-group"><label>Επόμενη δόση</label><input type="date" value={form.next_date} onChange={e => setForm({...form, next_date: e.target.value})} /></div>
              <div className="form-group"><label>Κτηνίατρος</label><input value={form.vet_name} onChange={e => setForm({...form, vet_name: e.target.value})} placeholder="Ονοματεπώνυμο" /></div>
              <div className="form-group"><label>Δόση (ml)</label><input type="number" step="0.5" min="0" value={form.dose_ml} onChange={e => setForm({...form, dose_ml: e.target.value})} /></div>
              <div className="form-group"><label>Αρ. Παρτίδας</label><input value={form.batch_no} onChange={e => setForm({...form, batch_no: e.target.value})} /></div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Σημειώσεις</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
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
