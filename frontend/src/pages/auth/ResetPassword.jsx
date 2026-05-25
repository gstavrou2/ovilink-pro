import { useState, useEffect } from 'react'

import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Οι κωδικοί δεν ταιριάζουν'); return }
    if (password.length < 6) { setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setTimeout(() => navigate('/'), 2000) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src="/logo.jpg" alt="OVIlink" style={{ width:200, maxWidth:'100%', borderRadius:12, marginBottom:'0.75rem' }}/>
          <h2 style={{ fontSize:18, fontWeight:700 }}>Ορισμός νέου κωδικού</h2>
        </div>
        <div className="card">
          {success ? (
            <div className="notice notice-success">
              <i className="ti ti-check"/> Ο κωδικός ορίστηκε! Ανακατεύθυνση...
            </div>
          ) : (
            <form onSubmit={handleReset}>
              {error && <div className="notice notice-danger" style={{ marginBottom:'1rem' }}><i className="ti ti-alert-circle"/> {error}</div>}
              <div className="form-group" style={{ marginBottom:'1rem' }}>
                <label>Νέος κωδικός</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Τουλάχιστον 6 χαρακτήρες" required minLength={6}/>
              </div>
              <div className="form-group" style={{ marginBottom:'1.5rem' }}>
                <label>Επιβεβαίωση κωδικού</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Επανάλαβε τον κωδικό" required/>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} disabled={loading}>
                {loading ? <><i className="ti ti-loader"/> Αποθήκευση...</> : <><i className="ti ti-lock"/> Ορισμός κωδικού</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
