import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('Λάθος email ή κωδικός πρόσβασης.')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src="/logo.jpg" alt="OVIlink" style={{ width:280, maxWidth:'100%', borderRadius:12, marginBottom:'0.75rem' }}/>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>Σύνδεση στο σύστημα διαχείρισης</p>
        </div>

        <div className="card">
          {error && (
            <div className="notice notice-danger" style={{ marginBottom:'1rem' }}>
              <i className="ti ti-alert-circle"/> {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom:'1rem' }}>
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required autoComplete="email"/>
            </div>
            <div className="form-group" style={{ marginBottom:'0.5rem' }}>
              <label>Κωδικός πρόσβασης</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="current-password"/>
            </div>
            <div style={{ textAlign:'right', marginBottom:'1.5rem' }}>
              <Link to="/forgot-password" style={{ fontSize:12, color:'var(--green)', textDecoration:'none' }}>
                Ξέχασες τον κωδικό;
              </Link>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'10px' }} disabled={loading}>
              {loading ? <><i className="ti ti-loader"/> Παρακαλώ...</> : <><i className="ti ti-login"/> Σύνδεση</>}
            </button>
          </form>
          <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', marginTop:'1rem' }}>
            Δεν έχεις λογαριασμό; Επικοινώνησε με τον διαχειριστή.
          </p>
        </div>

        <div style={{ textAlign:'center', marginTop:'1.5rem', fontSize:11, color:'var(--text-muted)' }}>
          Developed &amp; designed by <strong style={{ color:'var(--text)' }}>George Stavrou</strong>
        </div>
      </div>
    </div>
  )
}
