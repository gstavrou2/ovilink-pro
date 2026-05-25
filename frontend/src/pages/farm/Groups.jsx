import { useEffect, useState } from 'react'
import { supabase } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate, exportTableToExcel, exportToPDF } from '../../lib/exports'

const GROUP_COLORS = ['#1D9E75','#185FA5','#BA7517','#A32D2D','#534AB7','#0F6E56','#993C1D','#5F5E5A']
const emptyGroup = { name: '', description: '', color: '#1D9E75', milk_threshold_kg: '', notify_email: '' }
const emptyRation = { feed_name: '', quantity_kg: '', cost_per_kg: '', notes: '' }

export default function Groups() {
  const { farmId } = useAuth()
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [rations, setRations] = useState([])
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [tab, setTab] = useState('members')

  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showRationModal, setShowRationModal] = useState(false)
  const [showNewRationSet, setShowNewRationSet] = useState(false)

  const [groupForm, setGroupForm] = useState(emptyGroup)
  const [editGroupId, setEditGroupId] = useState(null)
  const [memberForm, setMemberForm] = useState({ animal_id: '', joined_date: new Date().toISOString().split('T')[0], notes: '' })
  const [rationForm, setRationForm] = useState(emptyRation)
  const [editRationId, setEditRationId] = useState(null)
  const [newRationDate, setNewRationDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const [grpRes, memRes, ratRes, animRes] = await Promise.all([
      supabase.from('animal_groups').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('animal_group_members').select('*,animals(id,code,type,breed,status)').eq('farm_id', farmId),
      supabase.from('group_rations').select('*').eq('farm_id', farmId).order('valid_from', { ascending: false }),
      supabase.from('animals').select('id,code,type,breed,status').eq('farm_id', farmId).order('code'),
    ])
    setGroups(grpRes.data || [])
    setMembers(memRes.data || [])
    setRations(ratRes.data || [])
    setAnimals(animRes.data || [])
    setLoading(false)
  }

  function groupMembers(groupId) { return members.filter(m => m.group_id === groupId) }
  function activeRations(groupId) { return rations.filter(r => r.group_id === groupId && r.is_active) }
  function allRations(groupId) { return rations.filter(r => r.group_id === groupId) }

  function calcGroupCosts(groupId) {
    const rats = activeRations(groupId)
    const count = groupMembers(groupId).length
    const costPerAnimalPerDay = rats.reduce((s,r) => s + (r.quantity_kg * r.cost_per_kg), 0)
    return {
      count,
      costPerAnimalPerDay,
      totalPerDay: costPerAnimalPerDay * count,
      totalPerMonth: costPerAnimalPerDay * count * 30,
    }
  }

  const assignedAnimalIds = new Set(members.map(m => m.animal_id))
  const unassignedAnimals = animals.filter(a => !assignedAnimalIds.has(a.id))

  function openNewGroup() { setGroupForm(emptyGroup); setEditGroupId(null); setShowGroupModal(true) }
  function openEditGroup(g) {
    setGroupForm({ name:g.name, description:g.description||'', color:g.color||'#1D9E75', milk_threshold_kg:g.milk_threshold_kg||'', notify_email:g.notify_email||'' })
    setEditGroupId(g.id); setShowGroupModal(true)
  }

  async function saveGroup() {
    if (!groupForm.name) return alert('Το όνομα είναι υποχρεωτικό')
    setSaving(true)
    const payload = { ...groupForm, milk_threshold_kg: parseFloat(groupForm.milk_threshold_kg) || null }
    if (editGroupId) {
      await supabase.from('animal_groups').update(payload).eq('id', editGroupId)
    } else {
      await supabase.from('animal_groups').insert({ ...payload, farm_id: farmId })
    }
    setSaving(false); setShowGroupModal(false); loadAll()
  }

  async function deleteGroup(id) {
    if (!confirm('Διαγραφή group;')) return
    await supabase.from('animal_groups').delete().eq('id', id)
    if (selectedGroup?.id === id) setSelectedGroup(null)
    loadAll()
  }

  async function saveMember() {
    if (!memberForm.animal_id) return alert('Επέλεξε ζώο')
    setSaving(true)
    await supabase.from('animal_group_members').delete().eq('animal_id', memberForm.animal_id)
    await supabase.from('animal_group_members').insert({ ...memberForm, group_id: selectedGroup.id, farm_id: farmId })
    setSaving(false); setShowMemberModal(false); loadAll()
  }

  async function removeMember(memberId) {
    if (!confirm('Αφαίρεση ζώου από το group;')) return
    await supabase.from('animal_group_members').delete().eq('id', memberId)
    loadAll()
  }

  async function saveRation() {
    if (!rationForm.feed_name || !rationForm.quantity_kg) return alert('Τροφή και ποσότητα είναι υποχρεωτικά')
    setSaving(true)
    const payload = { ...rationForm, quantity_kg: parseFloat(rationForm.quantity_kg), cost_per_kg: parseFloat(rationForm.cost_per_kg)||0, group_id: selectedGroup.id, farm_id: farmId, is_active: true }
    if (editRationId) {
      await supabase.from('group_rations').update(payload).eq('id', editRationId)
    } else {
      await supabase.from('group_rations').insert(payload)
    }
    setSaving(false); setShowRationModal(false); setRationForm(emptyRation); loadAll()
  }

  async function deleteRation(id) {
    if (!confirm('Διαγραφή τροφής;')) return
    await supabase.from('group_rations').delete().eq('id', id)
    loadAll()
  }

  // Δημιουργία νέου σιτηρεσίου — αρχειοθέτηση παλιού
  async function createNewRationSet() {
    if (!confirm(`Θα αρχειοθετηθεί το τρέχον σιτηρέσιο (${formatDate(newRationDate)}) και θα δημιουργηθεί νέο. Συνέχεια;`)) return
    setSaving(true)
    // Archive current active rations
    await supabase.from('group_rations')
      .update({ is_active: false, valid_to: newRationDate })
      .eq('group_id', selectedGroup.id)
      .eq('is_active', true)
    setSaving(false); setShowNewRationSet(false); loadAll()
  }

  async function restoreRationSet(validFrom) {
    if (!confirm(`Επαναφορά σιτηρεσίου από ${formatDate(validFrom)};`)) return
    // Archive current
    await supabase.from('group_rations').update({ is_active: false, valid_to: new Date().toISOString().split('T')[0] }).eq('group_id', selectedGroup.id).eq('is_active', true)
    // Restore old set
    await supabase.from('group_rations').update({ is_active: true, valid_to: null }).eq('group_id', selectedGroup.id).eq('valid_from', validFrom)
    loadAll()
  }

  async function handleExportExcel() {
    if (!selectedGroup) return
    const mems = groupMembers(selectedGroup.id)
    exportTableToExcel(mems.map(m => ({
      'Zoo': m.animals?.code||'', 'Eidos': m.animals?.type==='sheep'?'Provatiná':'Aiga',
      'Fylli': m.animals?.breed||'', 'Hmerominia eisodou': formatDate(m.joined_date),
    })), `Group_${selectedGroup.name}`)
  }

  async function handleExportPDF() {
    if (!selectedGroup) return
    const costs = calcGroupCosts(selectedGroup.id)
    exportToPDF({
      title: `Group: ${selectedGroup.name}`,
      subtitle: `Zoa: ${costs.count} | Kostos/zoo/mera: ${costs.costPerAnimalPerDay.toFixed(3)} EU`,
      headers: ['Zoo','Eidos','Fylli','Hmerominia eisodou'],
      rows: groupMembers(selectedGroup.id).map(m => [m.animals?.code||'', m.animals?.type==='sheep'?'Provatiná':'Aiga', m.animals?.breed||'', formatDate(m.joined_date)]),
      filename: `Group_${selectedGroup.name}`,
    })
  }

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  const sg = selectedGroup ? groups.find(g => g.id === selectedGroup.id) : null
  const sgMembers = sg ? groupMembers(sg.id) : []
  const sgActiveRations = sg ? activeRations(sg.id) : []
  const sgAllRations = sg ? allRations(sg.id) : []
  const sgCosts = sg ? calcGroupCosts(sg.id) : null

  // Group ration history by valid_from
  const rationHistory = sg ? [...new Set(sgAllRations.filter(r => !r.is_active).map(r => r.valid_from))].sort().reverse() : []

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Groups & Σιτηρέσια</div>
          <div className="page-subtitle">{groups.length} groups · {members.length} ζώα</div>
        </div>
        <button className="btn btn-primary" onClick={openNewGroup}><i className="ti ti-plus"/>Νέο group</button>
      </div>

      {/* Groups grid */}
      {groups.length === 0
        ? <div className="empty-state"><i className="ti ti-folders"/><p>Δεν υπάρχουν groups</p></div>
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
            {groups.map(g => {
              const costs = calcGroupCosts(g.id)
              const isSelected = selectedGroup?.id === g.id
              return (
                <div key={g.id} onClick={() => { setSelectedGroup(g); setTab('members') }}
                  style={{ background:'var(--surface)', border:`2px solid ${isSelected?g.color:'var(--border)'}`, borderRadius:'var(--radius)', padding:'1rem', cursor:'pointer', boxShadow:isSelected?`0 0 0 3px ${g.color}22`:'var(--shadow)', transition:'all 0.15s' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:14, height:14, borderRadius:'50%', background:g.color }}/>
                      <span style={{ fontWeight:700, fontSize:15 }}>{g.name}</span>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-sm" onClick={e=>{e.stopPropagation();openEditGroup(g)}}><i className="ti ti-edit"/></button>
                      <button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();deleteGroup(g.id)}}><i className="ti ti-trash"/></button>
                    </div>
                  </div>
                  {g.description && <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>{g.description}</div>}
                  {g.milk_threshold_kg && (
                    <div style={{ fontSize:12, background:'var(--amber-light)', color:'var(--amber)', padding:'4px 8px', borderRadius:4, marginBottom:8, display:'flex', alignItems:'center', gap:4 }}>
                      <i className="ti ti-bell" style={{ fontSize:13 }}/> Κατώφλι: {g.milk_threshold_kg} kg/ημέρα
                    </div>
                  )}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <div style={{ background:'var(--bg)', borderRadius:6, padding:'6px 10px' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Ζώα</div>
                      <div style={{ fontWeight:700, fontSize:18, color:g.color }}>{costs.count}</div>
                    </div>
                    <div style={{ background:'var(--bg)', borderRadius:6, padding:'6px 10px' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Κόστος/ζώο/μέρα</div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{costs.costPerAnimalPerDay.toFixed(3)} €</div>
                    </div>
                    <div style={{ background:'var(--bg)', borderRadius:6, padding:'6px 10px' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Σύνολο/μέρα</div>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--red)' }}>{costs.totalPerDay.toFixed(2)} €</div>
                    </div>
                    <div style={{ background:'var(--bg)', borderRadius:6, padding:'6px 10px' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Σύνολο/μήνα</div>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--red)' }}>{costs.totalPerMonth.toFixed(2)} €</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {/* Selected group detail */}
      {sg && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:sg.color }}/>
              <span style={{ fontWeight:700, fontSize:17 }}>{sg.name}</span>
              <span className="badge badge-blue">{sgMembers.length} ζώα</span>
              {sg.milk_threshold_kg && <span className="badge badge-amber"><i className="ti ti-bell"/> {sg.milk_threshold_kg} kg κατώφλι</span>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn" onClick={handleExportExcel}><i className="ti ti-file-spreadsheet"/>Excel</button>
              <button className="btn" onClick={handleExportPDF}><i className="ti ti-file-type-pdf"/>PDF</button>
            </div>
          </div>

          <div className="tabs">
            <button className={`tab-btn${tab==='members'?' active':''}`} onClick={() => setTab('members')}>Ζώα group</button>
            <button className={`tab-btn${tab==='ration'?' active':''}`} onClick={() => setTab('ration')}>Ενεργό σιτηρέσιο</button>
            <button className={`tab-btn${tab==='history'?' active':''}`} onClick={() => setTab('history')}>Ιστορικό σιτηρεσίων</button>
            <button className={`tab-btn${tab==='costs'?' active':''}`} onClick={() => setTab('costs')}>Κόστος</button>
          </div>

          {/* Members tab */}
          {tab==='members' && (
            <>
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
                <button className="btn btn-primary" onClick={() => { setMemberForm({ animal_id:'', joined_date:new Date().toISOString().split('T')[0], notes:'' }); setShowMemberModal(true) }} disabled={unassignedAnimals.length===0}>
                  <i className="ti ti-plus"/>Προσθήκη ζώου
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Κωδικός</th><th>Είδος</th><th>Φυλή</th><th>Κατάσταση</th><th>Ημ. εισόδου</th><th></th></tr></thead>
                  <tbody>
                    {sgMembers.length===0
                      ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-paw"/><p>Δεν υπάρχουν ζώα</p></div></td></tr>
                      : sgMembers.map(m => (
                        <tr key={m.id}>
                          <td style={{ fontWeight:600 }}>{m.animals?.code}</td>
                          <td>{m.animals?.type==='sheep'?'Προβατίνα':'Αίγα'}</td>
                          <td>{m.animals?.breed||'—'}</td>
                          <td><span className={`badge badge-${m.animals?.status==='active'?'green':m.animals?.status==='pregnant'?'blue':'gray'}`}>{m.animals?.status}</span></td>
                          <td>{formatDate(m.joined_date)}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => removeMember(m.id)}><i className="ti ti-user-minus"/></button></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Active ration tab */}
          {tab==='ration' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-primary" onClick={() => { setRationForm(emptyRation); setEditRationId(null); setShowRationModal(true) }}>
                    <i className="ti ti-plus"/>Προσθήκη τροφής
                  </button>
                </div>
                <button className="btn" style={{ color:'var(--amber)', borderColor:'var(--amber)' }} onClick={() => setShowNewRationSet(true)}>
                  <i className="ti ti-archive"/>Αρχειοθέτηση & Νέο σιτηρέσιο
                </button>
              </div>

              {sgActiveRations.length > 0 && (
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:'0.75rem' }}>
                  Ενεργό από: <strong>{formatDate(sgActiveRations[0]?.valid_from)}</strong>
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead><tr><th>Τροφή</th><th>Ποσ./ζώο/ημέρα (kg)</th><th>Κόστος/kg (€)</th><th>Κόστος/ζώο/ημέρα (€)</th><th></th></tr></thead>
                  <tbody>
                    {sgActiveRations.length===0
                      ? <tr><td colSpan={5}><div className="empty-state"><i className="ti ti-wheat"/><p>Δεν υπάρχει σιτηρέσιο</p></div></td></tr>
                      : sgActiveRations.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight:600 }}>{r.feed_name}</td>
                          <td>{r.quantity_kg} kg</td>
                          <td>{r.cost_per_kg} €</td>
                          <td style={{ fontWeight:600, color:'var(--amber)' }}>{(r.quantity_kg*r.cost_per_kg).toFixed(3)} €</td>
                          <td>
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="btn btn-sm" onClick={() => { setRationForm({ feed_name:r.feed_name, quantity_kg:r.quantity_kg, cost_per_kg:r.cost_per_kg, notes:r.notes||'' }); setEditRationId(r.id); setShowRationModal(true) }}><i className="ti ti-edit"/></button>
                              <button className="btn btn-sm btn-danger" onClick={() => deleteRation(r.id)}><i className="ti ti-trash"/></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                  {sgActiveRations.length>0 && (
                    <tfoot>
                      <tr style={{ background:'var(--bg)', fontWeight:700 }}>
                        <td>ΣΥΝΟΛΟ / ζώο / ημέρα</td>
                        <td>{sgActiveRations.reduce((s,r)=>s+parseFloat(r.quantity_kg),0).toFixed(3)} kg</td>
                        <td>—</td>
                        <td style={{ color:'var(--red)' }}>{sgActiveRations.reduce((s,r)=>s+(r.quantity_kg*r.cost_per_kg),0).toFixed(3)} €</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}

          {/* Ration history tab */}
          {tab==='history' && (
            <>
              {rationHistory.length===0
                ? <div className="empty-state"><i className="ti ti-history"/><p>Δεν υπάρχει ιστορικό σιτηρεσίων</p></div>
                : rationHistory.map(validFrom => {
                  const setRations = sgAllRations.filter(r => r.valid_from === validFrom && !r.is_active)
                  const validTo = setRations[0]?.valid_to
                  const totalCost = setRations.reduce((s,r)=>s+(r.quantity_kg*r.cost_per_kg),0)
                  return (
                    <div key={validFrom} style={{ marginBottom:'1rem', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>
                          Σιτηρέσιο {formatDate(validFrom)} → {validTo ? formatDate(validTo) : 'τώρα'}
                        </div>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{totalCost.toFixed(3)} €/ζώο/ημέρα</span>
                          <button className="btn btn-sm" onClick={() => restoreRationSet(validFrom)} title="Επαναφορά αυτού του σιτηρεσίου">
                            <i className="ti ti-restore"/>Επαναφορά
                          </button>
                        </div>
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', background:'var(--surface)' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign:'left', padding:'8px 14px', fontSize:12, color:'var(--text-muted)', background:'var(--bg)' }}>Τροφή</th>
                            <th style={{ textAlign:'left', padding:'8px 14px', fontSize:12, color:'var(--text-muted)', background:'var(--bg)' }}>Ποσότητα/ζώο</th>
                            <th style={{ textAlign:'left', padding:'8px 14px', fontSize:12, color:'var(--text-muted)', background:'var(--bg)' }}>Κόστος/kg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {setRations.map(r => (
                            <tr key={r.id}>
                              <td style={{ padding:'8px 14px', fontSize:13, borderBottom:'1px solid var(--border)' }}>{r.feed_name}</td>
                              <td style={{ padding:'8px 14px', fontSize:13, borderBottom:'1px solid var(--border)' }}>{r.quantity_kg} kg</td>
                              <td style={{ padding:'8px 14px', fontSize:13, borderBottom:'1px solid var(--border)' }}>{r.cost_per_kg} €</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })
              }
            </>
          )}

          {/* Costs tab */}
          {tab==='costs' && sgCosts && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1rem' }}>
              <div className="stat-card"><div className="stat-label">Αριθμός ζώων</div><div className="stat-value blue">{sgCosts.count}</div></div>
              <div className="stat-card"><div className="stat-label">Κόστος / ζώο / ημέρα</div><div className="stat-value amber">{sgCosts.costPerAnimalPerDay.toFixed(3)} €</div></div>
              <div className="stat-card"><div className="stat-label">Σύνολο / ημέρα</div><div className="stat-value red">{sgCosts.totalPerDay.toFixed(2)} €</div></div>
              <div className="stat-card"><div className="stat-label">Σύνολο / μήνα</div><div className="stat-value red">{sgCosts.totalPerMonth.toFixed(2)} €</div></div>
              <div className="stat-card"><div className="stat-label">Σύνολο / έτος</div><div className="stat-value red">{(sgCosts.totalPerMonth*12).toFixed(2)} €</div></div>
              {sg.milk_threshold_kg && <div className="stat-card"><div className="stat-label">Κατώφλι παραγωγής</div><div className="stat-value amber">{sg.milk_threshold_kg} kg</div></div>}
            </div>
          )}
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowGroupModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editGroupId?'Επεξεργασία group':'Νέο group'}</div>
              <button className="btn btn-sm" onClick={() => setShowGroupModal(false)}><i className="ti ti-x"/></button>
            </div>
            <div className="form-group" style={{ marginBottom:'1rem' }}>
              <label>Όνομα group *</label>
              <input value={groupForm.name} onChange={e => setGroupForm({...groupForm, name:e.target.value})} placeholder="πχ. Group A"/>
            </div>
            <div className="form-group" style={{ marginBottom:'1rem' }}>
              <label>Περιγραφή</label>
              <textarea value={groupForm.description} onChange={e => setGroupForm({...groupForm, description:e.target.value})}/>
            </div>
            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group">
                <label>Κατώφλι παραγωγής (kg/ημέρα)</label>
                <input type="number" step="0.1" min="0" value={groupForm.milk_threshold_kg} onChange={e => setGroupForm({...groupForm, milk_threshold_kg:e.target.value})} placeholder="πχ. 50"/>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>Notification αν η παραγωγή πέσει κάτω από αυτή την τιμή</span>
              </div>
              <div className="form-group">
                <label>Email για notifications</label>
                <input type="email" value={groupForm.notify_email} onChange={e => setGroupForm({...groupForm, notify_email:e.target.value})} placeholder="farm@example.com"/>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:'1rem' }}>
              <label>Χρώμα</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                {GROUP_COLORS.map(c => (
                  <div key={c} onClick={() => setGroupForm({...groupForm, color:c})}
                    style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border:groupForm.color===c?'3px solid var(--text)':'3px solid transparent' }}/>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowGroupModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={saveGroup} disabled={saving}>{saving?'Αποθήκευση...':'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowMemberModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Προσθήκη ζώου στο {sg?.name}</div>
              <button className="btn btn-sm" onClick={() => setShowMemberModal(false)}><i className="ti ti-x"/></button>
            </div>
            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Ζώο *</label>
                <select value={memberForm.animal_id} onChange={e => setMemberForm({...memberForm, animal_id:e.target.value})}>
                  <option value="">Επιλογή...</option>
                  {unassignedAnimals.map(a => <option key={a.id} value={a.id}>{a.code} — {a.type==='sheep'?'Προβατίνα':'Αίγα'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ημερομηνία εισόδου *</label>
                <input type="date" value={memberForm.joined_date} onChange={e => setMemberForm({...memberForm, joined_date:e.target.value})}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowMemberModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={saveMember} disabled={saving||!memberForm.animal_id}>{saving?'Αποθήκευση...':'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ration Modal */}
      {showRationModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowRationModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editRationId?'Επεξεργασία τροφής':'Προσθήκη τροφής'}</div>
              <button className="btn btn-sm" onClick={() => setShowRationModal(false)}><i className="ti ti-x"/></button>
            </div>
            <div className="form-grid" style={{ marginBottom:'1rem' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Τροφή *</label>
                <input value={rationForm.feed_name} onChange={e => setRationForm({...rationForm, feed_name:e.target.value})} placeholder="πχ. Σανός, Καλαμπόκι..."/>
              </div>
              <div className="form-group">
                <label>Ποσότητα / ζώο / ημέρα (kg) *</label>
                <input type="number" step="0.001" min="0" value={rationForm.quantity_kg} onChange={e => setRationForm({...rationForm, quantity_kg:e.target.value})} placeholder="0.000"/>
              </div>
              <div className="form-group">
                <label>Κόστος / kg (€)</label>
                <input type="number" step="0.001" min="0" value={rationForm.cost_per_kg} onChange={e => setRationForm({...rationForm, cost_per_kg:e.target.value})} placeholder="0.000"/>
              </div>
              {rationForm.quantity_kg && rationForm.cost_per_kg && (
                <div style={{ gridColumn:'1/-1', padding:'8px 12px', background:'var(--green-light)', borderRadius:6, fontSize:13, color:'var(--green-dark)', fontWeight:600 }}>
                  Κόστος / ζώο / ημέρα: {(parseFloat(rationForm.quantity_kg)*parseFloat(rationForm.cost_per_kg)).toFixed(3)} €
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowRationModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={saveRation} disabled={saving}>{saving?'Αποθήκευση...':'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}

      {/* New Ration Set Modal */}
      {showNewRationSet && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowNewRationSet(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Νέο σιτηρέσιο για {sg?.name}</div>
              <button className="btn btn-sm" onClick={() => setShowNewRationSet(false)}><i className="ti ti-x"/></button>
            </div>
            <div className="notice notice-warning" style={{ marginBottom:'1rem' }}>
              <i className="ti ti-info-circle"/> Το τρέχον σιτηρέσιο θα αρχειοθετηθεί και θα δημιουργηθεί νέο κενό σιτηρέσιο.
            </div>
            <div className="form-group" style={{ marginBottom:'1rem' }}>
              <label>Ημερομηνία έναρξης νέου σιτηρεσίου</label>
              <input type="date" value={newRationDate} onChange={e => setNewRationDate(e.target.value)}/>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowNewRationSet(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={createNewRationSet} disabled={saving}>
                <i className="ti ti-archive"/>Αρχειοθέτηση & Νέο σιτηρέσιο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
