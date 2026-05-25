import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/api'
import { formatDate } from '../../lib/exports'
import { useAuth } from '../../contexts/AuthContext'
import { addDays, parseISO, format } from 'date-fns'

export default function Dashboard() {
  const { farmId } = useAuth()
  const [stats, setStats] = useState({ total:0, sheep:0, goats:0, milkToday:0 })
  const [upcoming, setUpcoming] = useState([])
  const [recentMilk, setRecentMilk] = useState([])
  const [monthCosts, setMonthCosts] = useState({ expenses:0, income:0 })
  const [pendingTodos, setPendingTodos] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = format(new Date(), 'yyyy-MM-01')
    const [animalsRes, milkRes, vacRes, costsRes, todosRes, notifRes] = await Promise.all([
      supabase.from('animals').select('type').eq('farm_id', farmId).eq('status','active'),
      supabase.from('milk_daily_totals').select('*').eq('farm_id', farmId).eq('date', today),
      supabase.from('vaccines').select('*,animals(code)').eq('farm_id', farmId).gte('next_date', today).lte('next_date', format(addDays(new Date(),30),'yyyy-MM-dd')).order('next_date'),
      supabase.from('costs').select('type,amount').eq('farm_id', farmId).gte('date', monthStart),
      supabase.from('todos').select('*').eq('farm_id', farmId).eq('completed', false).order('due_date').limit(5),
      supabase.from('notifications').select('*,animal_groups(name,color)').eq('farm_id', farmId).eq('is_read', false).order('created_at', { ascending:false }).limit(10),
    ])
    const animals = animalsRes.data || []
    const todayMilk = milkRes.data?.[0]
    const milkToday = todayMilk?(todayMilk.sheep_morning||0)+(todayMilk.sheep_evening||0)+(todayMilk.goat_morning||0)+(todayMilk.goat_evening||0):0
    setStats({ total:animals.length, sheep:animals.filter(a=>a.type==='sheep').length, goats:animals.filter(a=>a.type==='goat').length, milkToday })
    setUpcoming(vacRes.data || [])
    setPendingTodos(todosRes.data || [])
    setNotifications(notifRes.data || [])
    const milk = await supabase.from('milk_daily_totals').select('*').eq('farm_id', farmId).order('date', { ascending:false }).limit(5)
    setRecentMilk(milk.data || [])
    const costs = costsRes.data || []
    setMonthCosts({ expenses:costs.filter(c=>c.type==='expense').reduce((s,c)=>s+c.amount,0), income:costs.filter(c=>c.type==='income').reduce((s,c)=>s+c.amount,0) })
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('farm_id', farmId).eq('is_read', false)
    setNotifications([])
  }

  if (!farmId) return (
    <div className="empty-state" style={{ paddingTop:'4rem' }}>
      <i className="ti ti-building" style={{ fontSize:64, opacity:0.2 }}/>
      <p style={{ fontSize:16, marginBottom:8 }}>Δεν έχεις ανατεθεί σε φάρμα</p>
      <p style={{ fontSize:13 }}>Επικοινώνησε με τον διαχειριστή.</p>
    </div>
  )

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  const net = monthCosts.income - monthCosts.expenses
  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Πίνακας Ελέγχου</div><div className="page-subtitle">{formatDate(today)}</div></div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="card" style={{ marginBottom:'1rem', border:'1px solid var(--amber)', background:'#fffdf5' }}>
          <div className="card-title" style={{ color:'var(--amber)' }}>
            <i className="ti ti-bell"/>Ειδοποιήσεις
            <span className="badge badge-red" style={{ marginLeft:4 }}>{notifications.length}</span>
            <button className="btn btn-sm" onClick={markAllRead} style={{ marginLeft:'auto' }}>Όλες ως αναγνωσμένες</button>
          </div>
          {notifications.map(n => (
            <div key={n.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background: n.animal_groups?.color ? n.animal_groups.color+'22' : 'var(--amber-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize:18, color:'var(--amber)' }}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{n.title}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{n.message}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{formatDate(n.created_at?.split('T')[0])}</div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <Link to="/groups" className="btn btn-sm" style={{ color:'var(--amber)' }}>Σιτηρέσιο</Link>
                <button className="btn btn-sm" onClick={() => markRead(n.id)}><i className="ti ti-check"/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Σύνολο ζώων</div><div className="stat-value blue">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-label">Προβατίνες</div><div className="stat-value green">{stats.sheep}</div></div>
        <div className="stat-card"><div className="stat-label">Αίγες</div><div className="stat-value amber">{stats.goats}</div></div>
        <div className="stat-card"><div className="stat-label">Παραγωγή σήμερα</div><div className="stat-value green">{stats.milkToday.toFixed(2)} kg</div></div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
        <div className="card">
          <div className="card-title" style={{ color:'var(--amber)' }}>
            <i className="ti ti-calendar-event"/>Επερχόμενοι εμβολιασμοί
            <Link to="/vaccines" className="btn btn-sm" style={{ marginLeft:'auto' }}>Όλοι <i className="ti ti-arrow-right"/></Link>
          </div>
          {upcoming.length===0 ? <div style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'1rem' }}>Κανένας εκκρεμής</div>
            : upcoming.slice(0,4).map((v,i) => {
              const days = Math.ceil((parseISO(v.next_date)-new Date())/86400000)
              return <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <div><span style={{ fontWeight:600 }}>{v.animals?.code||'—'}</span><span style={{ color:'var(--text-muted)' }}> · {v.vaccine_name}</span></div>
                <div style={{ display:'flex', gap:6 }}><span style={{ fontSize:11, color:'var(--text-muted)' }}>{formatDate(v.next_date)}</span><span className={`badge badge-${days<=7?'red':days<=14?'amber':'green'}`}>{days===0?'Σήμερα':`${days}μ`}</span></div>
              </div>
            })
          }
        </div>
        <div className="card">
          <div className="card-title" style={{ color:'var(--green)' }}>
            <i className="ti ti-droplet"/>Τελευταίες μετρήσεις
            <Link to="/milk" className="btn btn-sm" style={{ marginLeft:'auto' }}>Όλες <i className="ti ti-arrow-right"/></Link>
          </div>
          {recentMilk.length===0 ? <div style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'1rem' }}>Καμία μέτρηση</div>
            : recentMilk.map((m,i) => {
              const total=(m.sheep_morning||0)+(m.sheep_evening||0)+(m.goat_morning||0)+(m.goat_evening||0)
              return <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <span style={{ color:'var(--text-muted)' }}>{formatDate(m.date)}</span>
                <span>🐑 {((m.sheep_morning||0)+(m.sheep_evening||0)).toFixed(2)} kg</span>
                <span>🐐 {((m.goat_morning||0)+(m.goat_evening||0)).toFixed(2)} kg</span>
                <span style={{ fontWeight:600, color:'var(--green)' }}>{total.toFixed(2)} kg</span>
              </div>
            })
          }
        </div>
      </div>

      {pendingTodos.length>0 && (
        <div className="card" style={{ marginBottom:'1rem' }}>
          <div className="card-title" style={{ color:'var(--blue)' }}>
            <i className="ti ti-checkbox"/>Εκκρεμείς εργασίες
            <Link to="/todos" className="btn btn-sm" style={{ marginLeft:'auto' }}>Όλες <i className="ti ti-arrow-right"/></Link>
          </div>
          {pendingTodos.map((t,i) => {
            const isOverdue = t.due_date && t.due_date < today
            return <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <div><span style={{ fontWeight:600, color:isOverdue?'var(--red)':undefined }}>{t.title}</span><span style={{ marginLeft:8 }} className={`badge badge-${t.category_type==='unit'?'blue':'gray'}`}>{t.category}</span></div>
              {t.due_date && <span style={{ fontSize:11, color:isOverdue?'var(--red)':'var(--text-muted)' }}>{formatDate(t.due_date)}{isOverdue?' ⚠️':''}</span>}
            </div>
          })}
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ color:'var(--blue)' }}>
          <i className="ti ti-cash"/>Οικονομικά τρέχοντος μήνα
          <Link to="/costs" className="btn btn-sm" style={{ marginLeft:'auto' }}>Λεπτομέρειες <i className="ti ti-arrow-right"/></Link>
        </div>
        <div className="stats-grid" style={{ marginBottom:0 }}>
          <div className="stat-card"><div className="stat-label">Έξοδα</div><div className="stat-value red">{monthCosts.expenses.toFixed(2)} €</div></div>
          <div className="stat-card"><div className="stat-label">Έσοδα</div><div className="stat-value green">{monthCosts.income.toFixed(2)} €</div></div>
          <div className="stat-card"><div className="stat-label">Αποτέλεσμα</div><div className="stat-value" style={{ color:net>=0?'var(--green)':'var(--red)' }}>{net>=0?'+':''}{net.toFixed(2)} €</div></div>
          <div className="stat-card"><div className="stat-label">Κόστος / ζώο</div><div className="stat-value blue">{stats.total>0?(monthCosts.expenses/stats.total).toFixed(2):'0.00'} €</div></div>
        </div>
      </div>
    </div>
  )
}
