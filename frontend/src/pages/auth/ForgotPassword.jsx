import { useState } from 'react'

import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src="/logo.jpg" alt="OVIlink" style={{ width:200, maxWidth:'100%', borderRadius:12, marginBottom:'0.75rem' }}/>
          <h2 style={{ fontSize:18, fontWeight:700 }}>Επαναφορά κωδικού</h2>
          <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:4 }}>Θα σου στείλουμε email με οδηγίες</p>
        </div>

        <div className="card">
          {sent ? (
            <div>
              <div className="notice notice-success" style={{ marginBottom:'1rem' }}>
                <i className="ti ti-mail"/> Email στάλθηκε στο <strong>{email}</strong>!
              </div>
              <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:'1rem' }}>
                Έλεγξε τα εισερχόμενά σου και πάτα το link για να ορίσεις νέο κωδικό.
              </p>
              <Link to="/login" className="btn" style={{ width:'100%', justifyContent:'center' }}>
                <i className="ti ti-arrow-left"/> Πίσω στη σύνδεση
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="notice notice-danger" style={{ marginBottom:'1rem' }}><i className="ti ti-alert-circle"/> {error}</div>}
              <div className="form-group" style={{ marginBottom:'1.5rem' }}>
                <label>Email λογαριασμού</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} disabled={loading}>
                {loading ? <><i className="ti ti-loader"/>Αποστολή...</> : <><i className="ti ti-mail"/>Αποστολή email επαναφοράς</>}
              </button>
              <div style={{ textAlign:'center', marginTop:'1rem' }}>
                <Link to="/login" style={{ fontSize:13, color:'var(--text-muted)' }}>
                  <i className="ti ti-arrow-left"/> Πίσω στη σύνδεση
                </Link>
              </div>
            </form>
          )}
        </div>

        <div style={{ textAlign:'center', marginTop:'1.5rem', fontSize:11, color:'var(--text-muted)' }}>
          Developed &amp; designed by <strong style={{ color:'var(--text)' }}>George Stavrou</strong>
        </div>
      </div>
    </div>
  )
}
