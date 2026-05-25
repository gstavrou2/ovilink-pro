import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verify token on mount
    if (api.accessToken) {
      api.me()
        .then(u => { setUser(u); localStorage.setItem('user', JSON.stringify(u)) })
        .catch(() => { api.clearTokens(); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    const data = await api.login(email, password)
    setUser(data.user)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  async function logout() {
    await api.logout()
    setUser(null)
  }

  const isSuperAdmin = user?.role === 'super_admin'
  const isAdmin = user?.role === 'admin' || isSuperAdmin
  const isManager = user?.role === 'manager' || isAdmin
  const farmId = user?.farm_id

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isSuperAdmin, isAdmin, isManager, farmId }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
