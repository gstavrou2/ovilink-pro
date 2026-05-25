import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/exports'

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const data = await api.getAuditLogs({ limit: 100 })
    setLogs(data || [])
    setLoading(false)
  }

  const actionColor = { create:'green', update:'blue', delete:'red', login:'gray' }

  if (loading) return <div className="loading"><i className="ti ti-loader"/> Φόρτωση...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Logs</div>
          <div className="page-subtitle">Ιστορικό ενεργειών χρηστών</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Ημερομηνία</th><th>Χρήστης</th><th>Φάρμα</th><th>Ενέργεια</th><th>Resource</th><th>IP</th></tr>
          </thead>
          <tbody>
            {logs.length===0
              ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-list"/><p>Δεν υπάρχουν logs</p></div></td></tr>
              : logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(l.created_at).toLocaleString('el-GR')}</td>
                  <td style={{ fontWeight:500 }}>{l.users?.email||'—'}</td>
                  <td>{l.farms?.name||'—'}</td>
                  <td><span className={`badge badge-${actionColor[l.action]||'gray'}`}>{l.action}</span></td>
                  <td>{l.resource}</td>
                  <td style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'monospace' }}>{l.ip_address||'—'}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
