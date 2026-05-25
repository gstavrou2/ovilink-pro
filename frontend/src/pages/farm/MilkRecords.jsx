import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { exportMultiSheetExcel, exportToPDF, formatDate } from '../../lib/exports'

const emptyForm = { animal_id: '', date: new Date().toISOString().split('T')[0], morning: '', evening: '', notes: '' }
const emptyDailyForm = { date: new Date().toISOString().split('T')[0], sheep_morning: '', sheep_evening: '', goat_morning: '', goat_evening: '', notes: '' }

function buildChartData(dailyTotals, period) {
  const data = []
  const now = new Date()
  if (period === '14d') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const dt = dailyTotals.find(x => x.date === ds)
      data.push({ label: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`, 'Πρόβατα': dt?parseFloat(((dt.sheep_morning||0)+(dt.sheep_evening||0)).toFixed(2)):0, 'Αίγες': dt?parseFloat(((dt.goat_morning||0)+(dt.goat_evening||0)).toFixed(2)):0 })
    }
  } else if (period === 'month') {
    const year = now.getFullYear(); const month = now.getMonth()
    const days = new Date(year,month+1,0).getDate()
    for (let d = 1; d <= days; d++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dt = dailyTotals.find(x => x.date === ds)
      data.push({ label: String(d), 'Πρόβατα': dt?parseFloat(((dt.sheep_morning||0)+(dt.sheep_evening||0)).toFixed(2)):0, 'Αίγες': dt?parseFloat(((dt.goat_morning||0)+(dt.goat_evening||0)).toFixed(2)):0 })
    }
  } else if (period === 'year') {
    const year = now.getFullYear()
    const monthNames = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']
    for (let m = 0; m < 12; m++) {
      const prefix = `${year}-${String(m+1).padStart(2,'0')}`
      const monthRecs = dailyTotals.filter(x => x.date.startsWith(prefix))
      data.push({ label: monthNames[m], 'Πρόβατα': parseFloat(monthRecs.reduce((s,r)=>s+(r.sheep_morning||0)+(r.sheep_evening||0),0).toFixed(2)), 'Αίγες': parseFloat(monthRecs.reduce((s,r)=>s+(r.goat_morning||0)+(r.goat_evening||0),0).toFixed(2)) })
    }
  }
  return data
}

export default function MilkRecords() {
  const { farmId } = useAuth()
  const [records, setRecords] = useState([])
  const [dailyTotals, setDailyTotals] = useState([])
  const [animals, setAnimals] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('daily')
  const [chartPeriod, setChartPeriod] = useState('14d')
  const [showIndModal, setShowIndModal] = useState(false)
  const [showDailyModal, setShowDailyModal] = useState(false)
  const [indForm, setIndForm] = useState(emptyForm)
  const [dailyForm, setDailyForm] = useState(emptyDailyForm)
  const [saving, setSaving] = useState(false)
  const [filterAnimal, setFilterAnimal] = useState('')
  const [thresholdAlert, setThresholdAlert] = useState(null)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const [recsRes, animRes, dailyRes, grpRes] = await Promise.all([
      supabase.from('milk_records').select('*,animals(code,type)').eq('farm_id', farmId).order('date', { ascending:false }).limit(500),
      supabase.from('animals').select('id,code,type').eq('farm_id', farmId).in('status',['active','dry']).order('code'),
      supabase.from('milk_daily_totals').select('*').eq('farm_id', farmId).order('date', { ascending:false }).limit(400),
      supabase.from('animal_groups').select('*').eq('farm_id', farmId),
    ])
    setRecords(recsRes.data || [])
    setAnimals(animRes.data || [])
    setDailyTotals(dailyRes.data || [])
    setGroups(grpRes.data || [])
    setLoading(false)
  }

  // Check milk threshold for all groups
  async function checkThresholds(date) {
    const groupsWithThreshold = groups.filter(g => g.milk_threshold_kg)
    if (groupsWithThreshold.length === 0) return

    const { data: members } = await supabase.from('animal_group_members').select('animal_id,group_id').eq('farm_id', farmId)
    const { data: dayRecords } = await supabase.from('milk_records').select('animal_id,morning,evening').eq('farm_id', farmId).eq('date', date)

    for (const group of groupsWithThreshold) {
      const groupAnimalIds = (members||[]).filter(m => m.group_id === group.id).map(m => m.animal_id)
      const groupDayTotal = (dayRecords||[])
        .filter(r => groupAnimalIds.includes(r.animal_id))
        .reduce((s,r) => s + (r.morning||0) + (r.evening||0), 0)

      if (groupDayTotal < group.milk_threshold_kg && groupDayTotal > 0) {
        const title = `Χαμηλή παραγωγή — ${group.name}`
        const message = `Η παραγωγή του group "${group.name}" για ${formatDate(date)} ήταν ${groupDayTotal.toFixed(2)} kg, κάτω από το κατώφλι των ${group.milk_threshold_kg} kg. Εξετάστε τροποποίηση σιτηρεσίου.`

        // Save in-app notification
        await supabase.from('notifications').insert({ farm_id: farmId, group_id: group.id, type: 'milk_threshold', title, message })

        setThresholdAlert({ group: group.name, total: groupDayTotal.toFixed(2), threshold: group.milk_threshold_kg })

        // Send email if configured
        if (group.notify_email) {
          await fetch(`https://${import.meta.env.VITE_SUPABASE_URL.split('//')[1]}/functions/v1/send-milk-alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ email: group.notify_email, group: group.name, total: groupDayTotal.toFixed(2), threshold: group.milk_threshold_kg, date: formatDate(date) })
          }).catch(() => {}) // Fail silently if edge function not deployed
        }
      }
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const todayDaily = dailyTotals.find(d => d.date === today)
  const todaySheep = todayDaily?(todayDaily.sheep_morning||0)+(todayDaily.sheep_evening||0):0
  const todayGoat = todayDaily?(todayDaily.goat_morning||0)+(todayDaily.goat_evening||0):0
  const chartData = buildChartData(dailyTotals, chartPeriod)

  async function saveInd() {
    if (!indForm.animal_id || !indForm.date) return alert('Ζώο και ημερομηνία είναι υποχρεωτικά')
    setSaving(true)
    await supabase.from('milk_records').insert({ animal_id:indForm.animal_id, date:indForm.date, morning:parseFloat(indForm.morning)||0, evening:parseFloat(indForm.evening)||0, notes:indForm.notes, farm_id:farmId })
    await checkThresholds(indForm.date)
    setSaving(false); setShowIndModal(false); setIndForm(emptyForm); loadAll()
  }

  async function saveDaily() {
    if (!dailyForm.date) return alert('Ημερομηνία είναι υποχρεωτική')
    setSaving(true)
    const existing = dailyTotals.find(d => d.date === dailyForm.date)
    const payload = { date:dailyForm.date, sheep_morning:parseFloat(dailyForm.sheep_morning)||0, sheep_evening:parseFloat(dailyForm.sheep_evening)||0, goat_morning:parseFloat(dailyForm.goat_morning)||0, goat_evening:parseFloat(dailyForm.goat_evening)||0, notes:dailyForm.notes, farm_id:farmId }
    if (existing) await supabase.from('milk_daily_totals').update(payload).eq('id', existing.id)
    else await supabase.from('milk_daily_totals').insert(payload)
    setSaving(false); setShowDailyModal(false); setDailyForm(emptyDailyForm); loadAll()
  }

  async function deleteRecord(id) { if (!confirm('Διαγραφή;')) return; await supabase.from('milk_records').delete().eq('id', id); loadAll() }
  async function deleteDailyTotal(id) { if (!confirm('Διαγραφή;')) return; await supabase.from('milk_daily_totals').delete().eq('id', id); loadAll() }

  function handleExportExcel() {
    exportMultiSheetExcel([
      { name:'Hmerisies', rows: dailyTotals.map(d => ({ 'Hmerominia':formatDate(d.date), 'Provata Proi':d.sheep_morning||0, 'Provata Vrady':d.sheep_evening||0, 'Syn.Provata':((d.sheep_morning||0)+(d.sheep_evening||0)).toFixed(2), 'Aiges Proi':d.goat_morning||0, 'Aiges Vrady':d.goat_evening||0, 'Syn.Aiges':((d.goat_morning||0)+(d.goat_evening||0)).toFixed(2), 'Gen.Synolo':((d.sheep_morning||0)+(d.sheep_evening||0)+(d.goat_morning||0)+(d.goat_evening||0)).toFixed(2) })) },
      { name:'Atomikes', rows: records.map(r => ({ 'Zoo':r.animals?.code||'', 'Eidos':r.animals?.type==='sheep'?'Provatiná':'Aiga', 'Hmerominia':formatDate(r.date), 'Proi':r.morning||0, 'Vrady':r.evening||0, 'Synolo':((r.morning||0)+(r.evening||0)).toFixed(2) })) }
    ], 'Galaktometriseis')
  }

  function handleExportPDF() {
    exportToPDF({ title:'Galaktometriseis - Hmerisia Synopsi', headers:['Hmerominia','Pr.Proi','Pr.Vrady','S.Provata','Aig.Proi','Aig.Vrady','S.Aiges','Gen.Synolo'],
      rows:dailyTotals.map(d=>[formatDate(d.date),`${d.sheep_morning||0}kg`,`${d.sheep_evening||0}kg`,`${((d.sheep_morning||0)+(d.sheep_evening||0)).toFixed(2)}kg`,`${d.goat_morning||0}kg`,`${d.goat_evening||0}kg`,`${((d.goat_morning||0)+(d.goat_evening||0)).toFixed(2)}kg`,`${((d.sheep_morning||0)+(d.sheep_evening||0)+(d.goat_morning||0)+(d.goat_evening||0)).toFixed(2)}kg`]), filename:'Galaktometriseis' })
  }

  const filteredInd = records.filter(r => !filterAnimal || r.animal_id === filterAnimal)
  const animalSummary = animals.map(a => { const recs=records.filter(r=>r.animal_id===a.id); const total=recs.reduce((s,r)=>s+(r.morning||0)+(r.evening||0),0); return {...a,count:recs.length,total} }).sort((a,b)=>b.total-a.total)
  const dfSheep=(parseFloat(dailyForm.sheep_morning)||0)+(parseFloat(dailyForm.sheep_evening)||0)
  const dfGoat=(parseFloat(dailyForm.goat_morning)||0)+(parseFloat(dailyForm.goat_evening)||0)
  const periodLabel={'14d':'14ήμερο','month':'Μήνας','year':'Έτος'}

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Γαλακτομετρήσεις</div><div className="page-subtitle">{dailyTotals.length} ημερήσιες · {records.length} ατομικές</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" onClick={handleExportExcel}><i className="ti ti-file-spreadsheet"/>Excel</button>
          <button className="btn" onClick={handleExportPDF}><i className="ti ti-file-type-pdf"/>PDF</button>
          <button className="btn" onClick={() => setShowDailyModal(true)}><i className="ti ti-calendar-plus"/>Ημερήσια</button>
          <button className="btn btn-primary" onClick={() => setShowIndModal(true)}><i className="ti ti-plus"/>Ατομική</button>
        </div>
      </div>

      {/* Threshold alert */}
      {thresholdAlert && (
        <div className="notice notice-danger" style={{ marginBottom:'1rem' }}>
          <i className="ti ti-alert-triangle"/>
          <div>
            <strong>⚠️ Χαμηλή παραγωγή — {thresholdAlert.group}!</strong><br/>
            <span style={{ fontSize:12 }}>Παραγωγή: {thresholdAlert.total} kg (κατώφλι: {thresholdAlert.threshold} kg). Εξετάστε τροποποίηση σιτηρεσίου.</span>
          </div>
          <button className="btn btn-sm" onClick={() => setThresholdAlert(null)} style={{ marginLeft:'auto' }}><i className="ti ti-x"/></button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Πρόβατα σήμερα</div><div className="stat-value green">{todaySheep.toFixed(2)} kg</div></div>
        <div className="stat-card"><div className="stat-label">Αίγες σήμερα</div><div className="stat-value amber">{todayGoat.toFixed(2)} kg</div></div>
        <div className="stat-card"><div className="stat-label">Σύνολο σήμερα</div><div className="stat-value blue">{(todaySheep+todayGoat).toFixed(2)} kg</div></div>
        <div className="stat-card"><div className="stat-label">Ατομικές μετρήσεις</div><div className="stat-value">{records.length}</div></div>
      </div>

      <div className="card">
        <div className="card-title">
          <i className="ti ti-chart-bar"/>Παραγωγή — {periodLabel[chartPeriod]}
          <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
            {['14d','month','year'].map(p => (
              <button key={p} className={`filter-chip${chartPeriod===p?' active':''}`} style={{ padding:'4px 10px', fontSize:12 }} onClick={() => setChartPeriod(p)}>{periodLabel[p]}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={chartPeriod==='year'?20:chartPeriod==='month'?8:12}>
            <XAxis dataKey="label" tick={{ fontSize:10 }}/><YAxis tick={{ fontSize:10 }} unit=" kg"/>
            <Tooltip formatter={(v,n) => [`${v} kg`,n]}/><Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
            <Bar dataKey="Πρόβατα" fill="#1D9E75" radius={[3,3,0,0]}/><Bar dataKey="Αίγες" fill="#BA7517" radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab==='daily'?' active':''}`} onClick={() => setTab('daily')}>Ημερήσιες συνολικές</button>
        <button className={`tab-btn${tab==='individual'?' active':''}`} onClick={() => setTab('individual')}>Ατομικές</button>
        <button className={`tab-btn${tab==='summary'?' active':''}`} onClick={() => setTab('summary')}>Σύνοψη ανά ζώο</button>
      </div>

      {tab==='daily' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Ημερομηνία</th><th colSpan={3} style={{ background:'#f0faf6', textAlign:'center', color:'var(--green-dark)' }}>🐑 Πρόβατα (kg)</th><th colSpan={3} style={{ background:'#fff8ee', textAlign:'center', color:'var(--amber)' }}>🐐 Αίγες (kg)</th><th>Γεν. Σύνολο</th><th>Σημ.</th><th></th></tr>
              <tr><th></th><th style={{ background:'#f8fdf9', fontSize:11 }}>Πρωί</th><th style={{ background:'#f8fdf9', fontSize:11 }}>Βράδυ</th><th style={{ background:'#f8fdf9', fontSize:11 }}>Σύνολο</th><th style={{ background:'#fffcf5', fontSize:11 }}>Πρωί</th><th style={{ background:'#fffcf5', fontSize:11 }}>Βράδυ</th><th style={{ background:'#fffcf5', fontSize:11 }}>Σύνολο</th><th></th><th></th><th></th></tr>
            </thead>
            <tbody>
              {dailyTotals.length===0
                ? <tr><td colSpan={10}><div className="empty-state"><i className="ti ti-droplet"/><p>Δεν υπάρχουν ημερήσιες μετρήσεις</p></div></td></tr>
                : dailyTotals.map(d => {
                  const st=(d.sheep_morning||0)+(d.sheep_evening||0); const gt=(d.goat_morning||0)+(d.goat_evening||0)
                  return <tr key={d.id}>
                    <td style={{ fontWeight:600 }}>{formatDate(d.date)}</td>
                    <td style={{ background:'#f8fdf9' }}>{d.sheep_morning||0}</td><td style={{ background:'#f8fdf9' }}>{d.sheep_evening||0}</td>
                    <td style={{ background:'#f8fdf9', fontWeight:700, color:'var(--green)' }}>{st.toFixed(2)} kg</td>
                    <td style={{ background:'#fffcf5' }}>{d.goat_morning||0}</td><td style={{ background:'#fffcf5' }}>{d.goat_evening||0}</td>
                    <td style={{ background:'#fffcf5', fontWeight:700, color:'var(--amber)' }}>{gt.toFixed(2)} kg</td>
                    <td style={{ fontWeight:700, color:'var(--blue)', fontSize:14 }}>{(st+gt).toFixed(2)} kg</td>
                    <td style={{ color:'var(--text-muted)', fontSize:12 }}>{d.notes||'—'}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => deleteDailyTotal(d.id)}><i className="ti ti-trash"/></button></td>
                  </tr>
                })
              }
            </tbody>
          </table>
        </div>
      )}

      {tab==='individual' && (
        <>
          <div className="search-bar">
            <select className="search-input" style={{ maxWidth:220 }} value={filterAnimal} onChange={e => setFilterAnimal(e.target.value)}>
              <option value="">Όλα τα ζώα</option>
              {animals.map(a => <option key={a.id} value={a.id}>{a.code} ({a.type==='sheep'?'Πρ.':'Αίγα'})</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ζώο</th><th>Είδος</th><th>Ημερομηνία</th><th>Πρωί (kg)</th><th>Βράδυ (kg)</th><th>Σύνολο</th><th>Σημ.</th><th></th></tr></thead>
              <tbody>
                {filteredInd.length===0 ? <tr><td colSpan={8}><div className="empty-state"><i className="ti ti-droplet"/><p>Καμία μέτρηση</p></div></td></tr>
                  : filteredInd.map(r => <tr key={r.id}><td style={{ fontWeight:600 }}>{r.animals?.code||'—'}</td><td>{r.animals?.type==='sheep'?'Προβατίνα':'Αίγα'}</td><td>{formatDate(r.date)}</td><td>{r.morning||0}</td><td>{r.evening||0}</td><td style={{ fontWeight:700, color:'var(--green)' }}>{((r.morning||0)+(r.evening||0)).toFixed(2)} kg</td><td style={{ color:'var(--text-muted)' }}>{r.notes||'—'}</td><td><button className="btn btn-sm btn-danger" onClick={() => deleteRecord(r.id)}><i className="ti ti-trash"/></button></td></tr>)
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab==='summary' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ζώο</th><th>Είδος</th><th>Μετρήσεις</th><th>Σύνολο (kg)</th><th>Μέσος (kg)</th></tr></thead>
            <tbody>
              {animalSummary.length===0 ? <tr><td colSpan={5}><div className="empty-state"><i className="ti ti-paw"/><p>Δεν υπάρχουν δεδομένα</p></div></td></tr>
                : animalSummary.map(a => <tr key={a.id}><td style={{ fontWeight:600 }}>{a.code}</td><td>{a.type==='sheep'?'Προβατίνα':'Αίγα'}</td><td>{a.count}</td><td style={{ fontWeight:700, color:'var(--green)' }}>{a.total.toFixed(2)}</td><td>{a.count>0?(a.total/a.count).toFixed(2):'—'}</td></tr>)
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Individual Modal */}
      {showIndModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowIndModal(false)}>
          <div className="modal">
            <div className="modal-header"><div className="modal-title">Ατομική γαλακτομέτρηση</div><button className="btn btn-sm" onClick={() => setShowIndModal(false)}><i className="ti ti-x"/></button></div>
            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group"><label>Ζώο *</label><select value={indForm.animal_id} onChange={e => setIndForm({...indForm, animal_id:e.target.value})}><option value="">Επιλογή...</option>{animals.map(a => <option key={a.id} value={a.id}>{a.code} ({a.type==='sheep'?'Πρ.':'Αίγα'})</option>)}</select></div>
              <div className="form-group"><label>Ημερομηνία *</label><input type="date" value={indForm.date} onChange={e => setIndForm({...indForm, date:e.target.value})}/></div>
              <div className="form-group"><label>Πρωί (kg)</label><input type="number" step="0.01" min="0" value={indForm.morning} onChange={e => setIndForm({...indForm, morning:e.target.value})} placeholder="0.00"/></div>
              <div className="form-group"><label>Βράδυ (kg)</label><input type="number" step="0.01" min="0" value={indForm.evening} onChange={e => setIndForm({...indForm, evening:e.target.value})} placeholder="0.00"/></div>
            </div>
            <div className="form-group" style={{ marginBottom:'1rem' }}><label>Σημειώσεις</label><textarea value={indForm.notes} onChange={e => setIndForm({...indForm, notes:e.target.value})}/></div>
            <div className="modal-footer"><button className="btn" onClick={() => setShowIndModal(false)}>Ακύρωση</button><button className="btn btn-primary" onClick={saveInd} disabled={saving}>{saving?'Αποθήκευση...':'Αποθήκευση'}</button></div>
          </div>
        </div>
      )}

      {/* Daily Modal */}
      {showDailyModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowDailyModal(false)}>
          <div className="modal" style={{ maxWidth:580 }}>
            <div className="modal-header"><div className="modal-title">Ημερήσια συνολική γαλακτομέτρηση</div><button className="btn btn-sm" onClick={() => setShowDailyModal(false)}><i className="ti ti-x"/></button></div>
            <div className="form-group" style={{ marginBottom:'1.25rem', maxWidth:200 }}><label>Ημερομηνία *</label><input type="date" value={dailyForm.date} onChange={e => setDailyForm({...dailyForm, date:e.target.value})}/></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
              <div style={{ padding:'1rem', background:'#f0faf6', borderRadius:8 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--green-dark)', marginBottom:10 }}>🐑 Πρόβατα</div>
                <div className="form-group" style={{ marginBottom:8 }}><label>Πρωί (kg)</label><input type="number" step="0.01" min="0" value={dailyForm.sheep_morning} onChange={e => setDailyForm({...dailyForm, sheep_morning:e.target.value})} placeholder="0.00"/></div>
                <div className="form-group" style={{ marginBottom:8 }}><label>Βράδυ (kg)</label><input type="number" step="0.01" min="0" value={dailyForm.sheep_evening} onChange={e => setDailyForm({...dailyForm, sheep_evening:e.target.value})} placeholder="0.00"/></div>
                <div style={{ fontWeight:700, color:'var(--green)', fontSize:14 }}>Σύνολο: {dfSheep.toFixed(2)} kg</div>
              </div>
              <div style={{ padding:'1rem', background:'#fff8ee', borderRadius:8 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--amber)', marginBottom:10 }}>🐐 Αίγες</div>
                <div className="form-group" style={{ marginBottom:8 }}><label>Πρωί (kg)</label><input type="number" step="0.01" min="0" value={dailyForm.goat_morning} onChange={e => setDailyForm({...dailyForm, goat_morning:e.target.value})} placeholder="0.00"/></div>
                <div className="form-group" style={{ marginBottom:8 }}><label>Βράδυ (kg)</label><input type="number" step="0.01" min="0" value={dailyForm.goat_evening} onChange={e => setDailyForm({...dailyForm, goat_evening:e.target.value})} placeholder="0.00"/></div>
                <div style={{ fontWeight:700, color:'var(--amber)', fontSize:14 }}>Σύνολο: {dfGoat.toFixed(2)} kg</div>
              </div>
            </div>
            <div style={{ padding:'10px 14px', background:'var(--blue-light)', borderRadius:8, marginBottom:'1rem', fontWeight:700, color:'var(--blue)', textAlign:'center', fontSize:15 }}>
              Γενικό σύνολο: {(dfSheep+dfGoat).toFixed(2)} kg
            </div>
            <div className="form-group" style={{ marginBottom:'1rem' }}><label>Σημειώσεις</label><textarea value={dailyForm.notes} onChange={e => setDailyForm({...dailyForm, notes:e.target.value})}/></div>
            <div className="modal-footer"><button className="btn" onClick={() => setShowDailyModal(false)}>Ακύρωση</button><button className="btn btn-primary" onClick={saveDaily} disabled={saving}>{saving?'Αποθήκευση...':'Αποθήκευση'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
