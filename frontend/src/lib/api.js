const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken')
    this.refreshToken = localStorage.getItem('refreshToken')
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    localStorage.setItem('accessToken', accessToken)
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  async request(method, path, body = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }

    if (this.accessToken) {
      options.headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    if (body) options.body = JSON.stringify(body)

    let res = await fetch(`${API_URL}${path}`, options)

    // Auto-refresh token if expired
    if (res.status === 401) {
      const data = await res.json()
      if (data.code === 'TOKEN_EXPIRED' && this.refreshToken) {
        const refreshed = await this.refreshAccessToken()
        if (refreshed) {
          options.headers['Authorization'] = `Bearer ${this.accessToken}`
          res = await fetch(`${API_URL}${path}`, options)
        } else {
          this.clearTokens()
          window.location.href = '/login'
          return null
        }
      }
    }

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Server error')
    }

    return res.json()
  }

  async refreshAccessToken() {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      })
      if (!res.ok) return false
      const data = await res.json()
      this.setTokens(data.accessToken, data.refreshToken)
      return true
    } catch {
      return false
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('POST', '/auth/login', { email, password })
    if (data) {
      this.setTokens(data.accessToken, data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  }

  async logout() {
    await this.request('POST', '/auth/logout', { refreshToken: this.refreshToken }).catch(() => {})
    this.clearTokens()
  }

  async me() { return this.request('GET', '/auth/me') }
  async changePassword(currentPassword, newPassword) { return this.request('POST', '/auth/change-password', { currentPassword, newPassword }) }
  async forgotPassword(email) { return this.request('POST', '/auth/forgot-password', { email }) }
  async resetPassword(token, password) { return this.request('POST', '/auth/reset-password', { token, password }) }

  // Admin
  async getAdminStats() { return this.request('GET', '/admin/stats') }
  async getFarms() { return this.request('GET', '/admin/farms') }
  async createFarm(data) { return this.request('POST', '/admin/farms', data) }
  async updateFarm(id, data) { return this.request('PUT', `/admin/farms/${id}`, data) }
  async deleteFarm(id) { return this.request('DELETE', `/admin/farms/${id}`) }
  async getUsers() { return this.request('GET', '/admin/users') }
  async createUser(data) { return this.request('POST', '/admin/users', data) }
  async updateUser(id, data) { return this.request('PUT', `/admin/users/${id}`, data) }
  async deleteUser(id) { return this.request('DELETE', `/admin/users/${id}`) }
  async generateLicense(data) { return this.request('POST', '/admin/licenses/generate', data) }
  async getLicenses() { return this.request('GET', '/admin/licenses') }
  async revokeLicense(id) { return this.request('DELETE', `/admin/licenses/${id}`) }
  async getAuditLogs(params = {}) { return this.request('GET', `/admin/audit-logs?${new URLSearchParams(params)}`) }

  // Licenses
  async getMyLicenses() { return this.request('GET', '/licenses/my') }
  async getModules() { return this.request('GET', '/licenses/modules') }
  async activateLicense(license_key) { return this.request('POST', '/licenses/activate', { license_key }) }

  // Animals
  async getAnimals(params = {}) { return this.request('GET', `/animals?${new URLSearchParams(params)}`) }
  async getAnimal(id) { return this.request('GET', `/animals/${id}`) }
  async createAnimal(data) { return this.request('POST', '/animals', data) }
  async updateAnimal(id, data) { return this.request('PUT', `/animals/${id}`, data) }
  async deleteAnimal(id) { return this.request('DELETE', `/animals/${id}`) }

  // Milk
  async getMilkRecords(params = {}) { return this.request('GET', `/milk?${new URLSearchParams(params)}`) }
  async createMilkRecord(data) { return this.request('POST', '/milk', data) }
  async deleteMilkRecord(id) { return this.request('DELETE', `/milk/${id}`) }

  // Vaccines
  async getVaccines(params = {}) { return this.request('GET', `/vaccines?${new URLSearchParams(params)}`) }
  async createVaccine(data) { return this.request('POST', '/vaccines', data) }
  async deleteVaccine(id) { return this.request('DELETE', `/vaccines/${id}`) }

  // Costs
  async getCosts(params = {}) { return this.request('GET', `/costs?${new URLSearchParams(params)}`) }
  async createCost(data) { return this.request('POST', '/costs', data) }
  async deleteCost(id) { return this.request('DELETE', `/costs/${id}`) }

  // Groups
  async getGroups() { return this.request('GET', '/groups') }
  async createGroup(data) { return this.request('POST', '/groups', data) }
  async updateGroup(id, data) { return this.request('PUT', `/groups/${id}`, data) }
  async deleteGroup(id) { return this.request('DELETE', `/groups/${id}`) }

  // Warehouse
  async getProducts() { return this.request('GET', '/warehouse') }
  async createProduct(data) { return this.request('POST', '/warehouse', data) }
  async updateProduct(id, data) { return this.request('PUT', `/warehouse/${id}`, data) }
  async deleteProduct(id) { return this.request('DELETE', `/warehouse/${id}`) }

  // Todos
  async getTodos(params = {}) { return this.request('GET', `/todos?${new URLSearchParams(params)}`) }
  async createTodo(data) { return this.request('POST', '/todos', data) }
  async updateTodo(id, data) { return this.request('PUT', `/todos/${id}`, data) }
  async deleteTodo(id) { return this.request('DELETE', `/todos/${id}`) }

  // Notifications
  async getNotifications() { return this.request('GET', '/notifications') }
  async markNotificationRead(id) { return this.request('PUT', `/notifications/${id}/read`) }
  async markAllNotificationsRead() { return this.request('PUT', '/notifications/read-all') }
}

export const api = new ApiClient()
