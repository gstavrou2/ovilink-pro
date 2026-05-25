import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { formatDate, exportMultiSheetExcel, exportToPDF } from '../../lib/exports'

const EXPENSE_CATS = ['Ζωοτροφές','Κτηνιατρικά','Εμβόλια','Εργασία','Ενέργεια','Ανταλλακτικά/Υλικά','Μεταφορές','Άλλο έξοδο']
const INCOME_CATS = ['Πώληση γάλακτος','Πώληση ζώων','Τυροκομείο/Γαλακτ.','Επιδοτήσεις','Άλλο έσοδο']
const COLORS = ['#1D9E75','#185FA5','#BA7517','#A32D2D','#5F5E5A','#993C1D','#534AB7','#0F6E56']

const emptyForm = {
  type: 'expense',
  category: EXPENSE_CATS[0],
  group_id: '',
  date: new Date().toISOString().split('T')[0],
  amount: '',
  description: '',
  notes: '',
}

export default function Costs() {
  const { farmId } = useAuth()
  const [records, setRecords] = useState([])
  const [groups, setGroups] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0,7))
  const [groupFilter, setGroupFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [costRes, grpRes, memRes] = await Promise.all([
      supabase.from('costs').select('*').eq('farm_id', farmId).order('date', { ascending: false }),
      supabase.from('animal_groups').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('animal_group_members').select('group_id').eq('farm_id', farmId).select('group_id,animal_id'),
    ])
    setRecords(costRes.data || [])
    setGroups(grpRes.data || [])
    setGroupMembers(memRes.data || [])
    setLoading(false)
  }

  // ── Filtered records ───────────────────────────────────
  const monthRecords = records.filter(r => {
    if (!r.date.startsWith(monthFilter)) return false
    if (groupFilter !== 'all') {
      if (groupFilter === 'none' && r.group_id) return false
      if (groupFilter !== 'none' && r.group_id !== groupFilter) return false
    }
    return true
  })

  const expenses = monthRecords.filter(r => r.type === 'expense')
  const incomes = monthRecords.filter(r => r.type === 'income')
  const totalExp = expenses.reduce((s,r) => s+r.amount, 0)
  const totalInc = incomes.reduce((s,r) => s+r.amount, 0)
  const net = totalInc - totalExp

  // ── Group count helpers ────────────────────────────────
  function groupAnimalCount(groupId) {
    return groupMembers.filter(m => m.group_id === groupId).length
  }

  // ── Per-group cost breakdown (current month) ───────────
  const groupCostData = groups.map(g => {
    const gExp = records.filter(r => r.date.startsWith(monthFilter) && r.type==='expense' && r.group_id===g.id).reduce((s,r) => s+r.amount, 0)
    const gInc = records.filter(r => r.date.startsWith(monthFilter) && r.type==='income' && r.group_id===g.id).reduce((s,r) => s+r.amount, 0)
    const count = groupAnimalCount(g.id)
    return {
      name: g.name,
      color: g.color,
      expenses: parseFloat(gExp.toFixed(2)),
      income: parseFloat(gInc.toFixed(2)),
      net: parseFloat((gInc - gExp).toFixed(2)),
      perAnimal: count > 0 ? parseFloat((gExp / count).toFixed(2)) : 0,
      count,
    }
  }).filter(g => g.expenses > 0 || g.income > 0)

  // Unassigned costs
  const unassignedExp = records.filter(r => r.date.startsWith(monthFilter) && r.type==='expense' && !r.group_id).reduce((s,r) => s+r.amount, 0)
  const unassignedInc = records.filter(r => r.date.startsWith(monthFilter) && r.type==='income' && !r.group_id).reduce((s,r) => s+r.amount, 0)

  // Category pie chart data
  const catData = EXPENSE_CATS.map(cat => ({
    name: cat,
    value: parseFloat(expenses.filter(r => r.category===cat).reduce((s,r) => s+r.amount, 0).toFixed(2))
  })).filter(d => d.value > 0)

  // Available months
  const months = [...new Set(records.map(r => r.date.slice(0,7)))].sort().reverse()

  async function save() {
    if (!form.amount || !form.date) return alert('Ποσό και ημερομηνία είναι υποχρεωτικά')
    setSaving(true)
    await supabase.from('costs').insert({...{
      ...form,
      amount: parseFloat(form.amount),
      group_id: form.group_id || null,
    }, farm_id: farmId})
    setSaving(false); setShowModal(false); setForm(emptyForm); load()
  }

  async function deleteRecord(id) {
    if (!confirm('Διαγραφή εγγραφής;')) return
    await supabase.from('costs').delete().eq('id', id)
    load()
  }

  function handleExportExcel() {
    exportMultiSheetExcel([
      {
        name: 'Egrafes',
        rows: monthRecords.map(r => ({
          'Hmerominia': formatDate(r.date),
          'Tipos': r.type==='income'?'Esodo':'Exodo',
          'Kategoria': r.category,
          'Group': groups.find(g=>g.id===r.group_id)?.name || '—',
          'Poso (EU)': r.amount,
          'Perigrafи': r.description || '',
        }))
      },
      {
        name: 'Ana Group',
        rows: groupCostData.map(g => ({
          'Group': g.name,
          'Zoa': g.count,
          'Exoda (EU)': g.expenses,
          'Esoda (EU)': g.income,
          'Apotelesmа (EU)': g.net,
          'Kostos/zoo (EU)': g.perAnimal,
        }))
      }
    ], 'Kostologio')
  }

  function handleExportPDF() {
    exportToPDF({
      title: 'Kostologio - ' + monthFilter,
      headers: ['Hmerominia','Tipos','Kategoria','Group','Poso'],
      rows: monthRecords.map(r => [
        formatDate(r.date),
        r.type==='income'?'Esodo':'Exodo',
        r.category,
        groups.find(g=>g.id===r.group_id)?.name || '—',
        `${r.type==='income'?'+':'-'}${r.amount.toFixed(2)} EU`,
      ]),
      filename: 'Kostologio',
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Κοστολόγιο</div>
          <div className="page-subtitle">Οικονομική διαχείριση μονάδας</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" onClick={handleExportExcel}><i className="ti ti-file-spreadsheet"/>Excel</button>
          <button className="btn" onClick={handleExportPDF}><i className="ti ti-file-type-pdf"/>PDF</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><i className="ti ti-plus"/>Νέα εγγραφή</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <label style={{ fontSize:13, color:'var(--text-muted)', fontWeight:500 }}>Μήνας:</label>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, background:'var(--surface)' }}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
            {!months.includes(monthFilter) && <option value={monthFilter}>{monthFilter}</option>}
          </select>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button className={`filter-chip${groupFilter==='all'?' active':''}`} onClick={() => setGroupFilter('all')}>Όλα</button>
          <button className={`filter-chip${groupFilter==='none'?' active':''}`} onClick={() => setGroupFilter('none')}>Χωρίς group</button>
          {groups.map(g => (
            <button key={g.id}
              className={`filter-chip${groupFilter===g.id?' active':''}`}
              onClick={() => setGroupFilter(g.id)}
              style={{ borderColor: groupFilter===g.id ? g.color : undefined, color: groupFilter===g.id ? g.color : undefined, background: groupFilter===g.id ? g.color+'22' : undefined }}>
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Έξοδα μήνα</div><div className="stat-value red">{totalExp.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Έσοδα μήνα</div><div className="stat-value green">{totalInc.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Αποτέλεσμα</div><div className="stat-value" style={{ color:net>=0?'var(--green)':'var(--red)' }}>{net>=0?'+':''}{net.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Εγγραφές</div><div className="stat-value blue">{monthRecords.length}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab==='overview'?' active':''}`} onClick={() => setTab('overview')}>Σύνοψη</button>
        <button className={`tab-btn${tab==='bygroup'?' active':''}`} onClick={() => setTab('bygroup')}>Ανά Group</button>
        <button className={`tab-btn${tab==='entries'?' active':''}`} onClick={() => setTab('entries')}>Εγγραφές</button>
      </div>

      {/* Overview tab */}
      {tab==='overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          <div className="card">
            <div className="card-title"><i className="ti ti-chart-pie"/>Κατανομή εξόδων</div>
            {catData.length===0
              ? <div className="empty-state" style={{ padding:'2rem' }}><i className="ti ti-cash"/><p>Δεν υπάρχουν έξοδα</p></div>
              : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {catData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v => `${v.toFixed(2)} €`}/>
                  <Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
                </PieChart>
              </ResponsiveContainer>
            }
          </div>
          <div className="card">
            <div className="card-title"><i className="ti ti-list"/>Ανάλυση ανά κατηγορία</div>
            {EXPENSE_CATS.map(cat => {
              const total = expenses.filter(r => r.category===cat).reduce((s,r) => s+r.amount, 0)
              if (total===0) return null
              const pct = totalExp>0?(total/totalExp*100):0
              return (
                <div key={cat} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                    <span>{cat}</span><span style={{ fontWeight:600 }}>{total.toFixed(2)} €</span>
                  </div>
                  <div style={{ height:5, background:'var(--bg)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--green)', borderRadius:3 }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By group tab */}
      {tab==='bygroup' && (
        <>
          {groupCostData.length===0
            ? <div className="empty-state"><i className="ti ti-folders"/><p>Δεν υπάρχουν έξοδα συνδεδεμένα με groups για αυτό τον μήνα</p></div>
            : (
              <>
                <div className="card">
                  <div className="card-title"><i className="ti ti-chart-bar"/>Έξοδα ανά Group</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={groupCostData} barSize={30}>
                      <XAxis dataKey="name" tick={{ fontSize:11 }}/>
                      <YAxis tick={{ fontSize:11 }}/>
                      <Tooltip formatter={v => `${v} €`}/>
                      <Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
                      <Bar dataKey="expenses" name="Έξοδα" fill="#A32D2D" radius={[4,4,0,0]}/>
                      <Bar dataKey="income" name="Έσοδα" fill="#1D9E75" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Group</th><th>Ζώα</th><th>Έξοδα (€)</th><th>Έσοδα (€)</th><th>Αποτέλεσμα (€)</th><th>Κόστος/ζώο (€)</th></tr>
                    </thead>
                    <tbody>
                      {groupCostData.map((g,i) => (
                        <tr key={i}>
                          <td>
                            <span className="badge" style={{ background:g.color+'22', color:g.color }}>{g.name}</span>
                          </td>
                          <td>{g.count}</td>
                          <td style={{ color:'var(--red)', fontWeight:600 }}>{g.expenses.toFixed(2)}</td>
                          <td style={{ color:'var(--green)', fontWeight:600 }}>{g.income.toFixed(2)}</td>
                          <td style={{ fontWeight:700, color:g.net>=0?'var(--green)':'var(--red)' }}>{g.net>=0?'+':''}{g.net.toFixed(2)}</td>
                          <td style={{ color:'var(--blue)', fontWeight:600 }}>{g.perAnimal.toFixed(2)}</td>
                        </tr>
                      ))}
                      {(unassignedExp > 0 || unassignedInc > 0) && (
                        <tr style={{ background:'var(--bg)' }}>
                          <td><span className="badge badge-gray">Χωρίς group</span></td>
                          <td>—</td>
                          <td style={{ color:'var(--red)', fontWeight:600 }}>{unassignedExp.toFixed(2)}</td>
                          <td style={{ color:'var(--green)', fontWeight:600 }}>{unassignedInc.toFixed(2)}</td>
                          <td style={{ fontWeight:700, color:(unassignedInc-unassignedExp)>=0?'var(--green)':'var(--red)' }}>
                            {(unassignedInc-unassignedExp)>=0?'+':''}{(unassignedInc-unassignedExp).toFixed(2)}
                          </td>
                          <td>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )
          }
        </>
      )}

      {/* Entries tab */}
      {tab==='entries' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ημερομηνία</th><th>Τύπος</th><th>Κατηγορία</th><th>Group</th><th>Περιγραφή</th><th style={{ textAlign:'right' }}>Ποσό</th><th></th></tr></thead>
            <tbody>
              {monthRecords.length===0
                ? <tr><td colSpan={7}><div className="empty-state"><i className="ti ti-cash"/><p>Δεν υπάρχουν εγγραφές</p></div></td></tr>
                : monthRecords.map(r => {
                  const g = groups.find(x => x.id===r.group_id)
                  return (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td><span className={`badge badge-${r.type==='income'?'green':'red'}`}>{r.type==='income'?'Έσοδο':'Έξοδο'}</span></td>
                      <td>{r.category}</td>
                      <td>
                        {g
                          ? <span className="badge" style={{ background:g.color+'22', color:g.color }}>{g.name}</span>
                          : <span className="badge badge-gray">—</span>
                        }
                      </td>
                      <td style={{ color:'var(--text-muted)' }}>{r.description||'—'}</td>
                      <td style={{ textAlign:'right', fontWeight:600, color:r.type==='income'?'var(--green)':'var(--red)' }}>
                        {r.type==='income'?'+':'−'}{r.amount.toFixed(2)} €
                      </td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteRecord(r.id)}><i className="ti ti-trash"/></button></td>
                    </tr>
                  )
                })
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
              <div className="modal-title">Νέα οικονομική εγγραφή</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><i className="ti ti-x"/></button>
            </div>
            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group">
                <label>Τύπος</label>
                <select value={form.type} onChange={e => setForm({...form, type:e.target.value, category:e.target.value==='expense'?EXPENSE_CATS[0]:INCOME_CATS[0]})}>
                  <option value="expense">Έξοδο</option>
                  <option value="income">Έσοδο</option>
                </select>
              </div>
              <div className="form-group">
                <label>Κατηγορία</label>
                <select value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
                  {(form.type==='expense'?EXPENSE_CATS:INCOME_CATS).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Group (προαιρετικό)</label>
                <select value={form.group_id} onChange={e => setForm({...form, group_id:e.target.value})}>
                  <option value="">Χωρίς group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ημερομηνία *</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})}/>
              </div>
              <div className="form-group">
                <label>Ποσό (€) *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} placeholder="0.00"/>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Περιγραφή</label>
                <input value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Σύντομη περιγραφή"/>
              </div>
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
