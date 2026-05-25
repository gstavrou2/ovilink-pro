import { useState } from 'react'
import { supabase } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

export default function Account() {
  const { user, profile } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleChangePassword(e) {
    e.preventDefault()
    setError(''); setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('Οι νέοι κωδικοί δεν ταιριάζουν')
      return
    }
    if (newPassword.length < 6) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες')
      return
    }

    setLoading(true)

    // Re-authenticate first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      setError('Ο τρέχων κωδικός δεν είναι σωστός')
      setLoading(false)
      return
    }

    // Update password
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Ο κωδικός άλλαξε επιτυχώς!')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    }
    setLoading(false)
  }

  const roleLabel = { admin: 'Admin', manager: 'Manager', viewer: 'Viewer' }
  const roleBadgeClass = { admin: 'badge-red', manager: 'badge-blue', viewer: 'badge-gray' }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Ο λογαριασμός μου</div>
          <div className="page-subtitle">Διαχείριση στοιχείων λογαριασμού</div>
        </div>
      </div>

      {/* Profile info */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title"><i className="ti ti-user"/>Στοιχεία λογαριασμού</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Email</div>
            <div style={{ fontWeight: 500 }}>{user?.email}</div>
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Role</div>
            <span className={`badge ${roleBadgeClass[profile?.role] || 'badge-gray'}`}>
              {roleLabel[profile?.role] || profile?.role}
            </span>
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Φάρμα</div>
            <div style={{ fontWeight: 500 }}>{profile?.farms?.name || '—'}</div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-title"><i className="ti ti-lock"/>Αλλαγή κωδικού πρόσβασης</div>

        {error && <div className="notice notice-danger" style={{ marginBottom: '1rem' }}><i className="ti ti-alert-circle"/> {error}</div>}
        {success && <div className="notice notice-success" style={{ marginBottom: '1rem' }}><i className="ti ti-check"/> {success}</div>}

        <form onSubmit={handleChangePassword}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Τρέχων κωδικός *</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Ο τρέχων κωδικός σου"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Νέος κωδικός *</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Τουλάχιστον 6 χαρακτήρες"
              required
              minLength={6}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Επιβεβαίωση νέου κωδικού *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Επανάλαβε τον νέο κωδικό"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><i className="ti ti-loader"/>Αποθήκευση...</> : <><i className="ti ti-lock"/>Αλλαγή κωδικού</>}
          </button>
        </form>
      </div>
    </div>
  )
}
