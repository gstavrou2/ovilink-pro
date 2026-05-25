import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { exportTableToExcel, exportToPDF } from '../../lib/exports'

const CATEGORIES = ['Ζωοτροφές', 'Φάρμακα', 'Εμβόλια', 'Αναλώσιμα υλικά', 'Εξοπλισμός', 'Άλλο']
const UNITS = ['kg', 'lt', 'τεμ.', 'σακί', 'κιβώτιο', 'φιάλη', 'ml', 'gr']

const emptyProduct = { name: '', category: CATEGORIES[0], unit: UNITS[0], quantity: '', notes: '' }
const emptyMovement = { product_id: '', type: 'in', quantity: '', date: new Date().toISOString().split('T')[0], reason: '', notes: '' }

export default function Warehouse() {
  const { farmId } = useAuth()
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stock')
  const [showProductModal, setShowProductModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [movementForm, setMovementForm] = useState(emptyMovement)
  const [editProductId, setEditProductId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [prodRes, movRes] = await Promise.all([
      supabase.from('warehouse_products').select('*').eq('farm_id', farmId).order('category').order('name'),
      supabase.from('warehouse_movements').select('*,warehouse_products(name,unit)').eq('farm_id', farmId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(300),
    ])
    setProducts(prodRes.data || [])
    setMovements(movRes.data || [])
    setLoading(false)
  }

  const filteredProducts = products.filter(p => filterCat === 'all' || p.category === filterCat)

  function openNewProduct() { setProductForm(emptyProduct); setEditProductId(null); setShowProductModal(true) }
  function openEditProduct(p) { setProductForm({ ...p }); setEditProductId(p.id); setShowProductModal(true) }
  function openMovement(productId = '') { setMovementForm({ ...emptyMovement, product_id: productId }); setShowMovementModal(true) }

  async function saveProduct() {
    if (!productForm.name) return alert('Το όνομα είναι υποχρεωτικό')
    setSaving(true)
    if (editProductId) {
      await supabase.from('warehouse_products').update({ ...productForm, quantity: parseFloat(productForm.quantity) || 0 }).eq('id', editProductId)
    } else {
      await supabase.from('warehouse_products').insert({...{ ...productForm, quantity: parseFloat(productForm.quantity) || 0 }, farm_id: farmId})
    }
    setSaving(false); setShowProductModal(false); loadAll()
  }

  async function saveMovement() {
    if (!movementForm.product_id || !movementForm.quantity || !movementForm.date) return alert('Προϊόν, ποσότητα και ημερομηνία είναι υποχρεωτικά')
    const qty = parseFloat(movementForm.quantity)
    const product = products.find(p => p.id === movementForm.product_id)
    if (movementForm.type === 'out' && product && qty > product.quantity) {
      if (!confirm(`Η ποσότητα εξόδου (${qty}) υπερβαίνει το απόθεμα (${product.quantity}). Συνέχεια;`)) return
    }
    setSaving(true)
    const delta = movementForm.type === 'in' ? qty : -qty
    await Promise.all([
      supabase.from('warehouse_movements').insert({...{ ...movementForm, quantity: qty }, farm_id: farmId}),
      supabase.from('warehouse_products').update({ quantity: Math.max(0, (product?.quantity || 0) + delta) }).eq('id', movementForm.product_id),
    ])
    setSaving(false); setShowMovementModal(false); setMovementForm(emptyMovement); loadAll()
  }

  async function deleteProduct(id) {
    if (!confirm('Διαγραφή προϊόντος; Θα διαγραφεί και το ιστορικό κινήσεων.')) return
    await supabase.from('warehouse_products').delete().eq('id', id)
    loadAll()
  }

  function handleExportExcel() {
    if (tab === 'stock') {
      exportTableToExcel(
        filteredProducts.map(p => ({ Προϊόν: p.name, Κατηγορία: p.category, Ποσότητα: p.quantity, Μονάδα: p.unit, Σημειώσεις: p.notes || '' })),
        'Αποθήκη_Απόθεμα'
      )
    } else {
      exportTableToExcel(
        movements.map(m => ({ Ημερομηνία: m.date, Προϊόν: m.warehouse_products?.name || '', Τύπος: m.type === 'in' ? 'Εισαγωγή' : 'Εξαγωγή', Ποσότητα: m.quantity, Αιτία: m.reason || '', Σημειώσεις: m.notes || '' })),
        'Αποθήκη_Κινήσεις'
      )
    }
  }

  function handleExportPDF() {
    if (tab === 'stock') {
      exportToPDF({
        title: 'Απόθεμα Αποθήκης',
        headers: ['Προϊόν', 'Κατηγορία', 'Ποσότητα', 'Μονάδα'],
        rows: filteredProducts.map(p => [p.name, p.category, p.quantity, p.unit]),
      })
    } else {
      exportToPDF({
        title: 'Ιστορικό Κινήσεων Αποθήκης',
        headers: ['Ημερομηνία', 'Προϊόν', 'Τύπος', 'Ποσότητα'],
        rows: movements.map(m => [m.date, m.warehouse_products?.name || '', m.type === 'in' ? 'Εισαγωγή' : 'Εξαγωγή', m.quantity]),
      })
    }
  }

  const productMovements = selectedProduct ? movements.filter(m => m.product_id === selectedProduct.id) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Αποθήκη</div>
          <div className="page-subtitle">{products.length} προϊόντα καταχωρημένα</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleExportExcel}><i className="ti ti-file-spreadsheet" />Excel</button>
          <button className="btn" onClick={handleExportPDF}><i className="ti ti-file-type-pdf" />PDF</button>
          <button className="btn" onClick={() => openMovement()}><i className="ti ti-arrows-transfer-up" />Κίνηση</button>
          <button className="btn btn-primary" onClick={openNewProduct}><i className="ti ti-plus" />Νέο προϊόν</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {CATEGORIES.slice(0, 4).map(cat => (
          <div key={cat} className="stat-card">
            <div className="stat-label">{cat}</div>
            <div className="stat-value blue">{products.filter(p => p.category === cat).length}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab === 'stock' ? ' active' : ''}`} onClick={() => setTab('stock')}>Απόθεμα</button>
        <button className={`tab-btn${tab === 'movements' ? ' active' : ''}`} onClick={() => setTab('movements')}>Ιστορικό κινήσεων</button>
      </div>

      {tab === 'stock' && (
        <>
          <div className="search-bar">
            <button className={`filter-chip${filterCat === 'all' ? ' active' : ''}`} onClick={() => setFilterCat('all')}>Όλα</button>
            {CATEGORIES.map(c => (
              <button key={c} className={`filter-chip${filterCat === c ? ' active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
            ))}
          </div>
          {loading ? <div className="loading"><i className="ti ti-loader" /> Φόρτωση...</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Προϊόν</th><th>Κατηγορία</th><th>Ποσότητα</th><th>Μονάδα</th><th>Σημειώσεις</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-building-warehouse" /><p>Δεν υπάρχουν προϊόντα</p></div></td></tr>
                    : filteredProducts.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td><span className="badge badge-blue">{p.category}</span></td>
                        <td style={{ fontWeight: 600, color: p.quantity <= 0 ? 'var(--red)' : 'var(--text)' }}>{p.quantity}</td>
                        <td>{p.unit}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.notes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm" onClick={() => { setSelectedProduct(p); setTab('movements') }} title="Ιστορικό"><i className="ti ti-history" /></button>
                            <button className="btn btn-sm btn-primary" onClick={() => openMovement(p.id)} title="Καταχώρηση κίνησης"><i className="ti ti-arrows-transfer-up" /></button>
                            <button className="btn btn-sm" onClick={() => openEditProduct(p)} title="Επεξεργασία"><i className="ti ti-edit" /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteProduct(p.id)} title="Διαγραφή"><i className="ti ti-trash" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'movements' && (
        <>
          <div className="search-bar" style={{ marginBottom: '1rem' }}>
            <select className="search-input" style={{ maxWidth: 240 }}
              value={selectedProduct?.id || ''}
              onChange={e => setSelectedProduct(e.target.value ? products.find(p => p.id === e.target.value) : null)}>
              <option value="">Όλα τα προϊόντα</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Ημερομηνία</th><th>Προϊόν</th><th>Τύπος</th><th>Ποσότητα</th><th>Αιτία</th><th>Σημειώσεις</th></tr>
              </thead>
              <tbody>
                {(selectedProduct ? productMovements : movements).length === 0
                  ? <tr><td colSpan={6}><div className="empty-state"><i className="ti ti-history" /><p>Δεν υπάρχουν κινήσεις</p></div></td></tr>
                  : (selectedProduct ? productMovements : movements).map(m => (
                    <tr key={m.id}>
                      <td>{m.date}</td>
                      <td style={{ fontWeight: 600 }}>{m.warehouse_products?.name || '—'}</td>
                      <td>
                        <span className={`badge badge-${m.type === 'in' ? 'green' : 'amber'}`}>
                          {m.type === 'in' ? 'Εισαγωγή' : 'Εξαγωγή'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: m.type === 'in' ? 'var(--green)' : 'var(--amber)' }}>
                        {m.type === 'in' ? '+' : '−'}{m.quantity} {m.warehouse_products?.unit}
                      </td>
                      <td>{m.reason || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{m.notes || '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowProductModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editProductId ? 'Επεξεργασία προϊόντος' : 'Νέο προϊόν αποθήκης'}</div>
              <button className="btn btn-sm" onClick={() => setShowProductModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Όνομα προϊόντος *</label>
                <input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="πχ. Σανός, Αμοξυκιλλίνη..." />
              </div>
              <div className="form-group">
                <label>Κατηγορία</label>
                <select value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Μονάδα μέτρησης</label>
                <select value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Αρχική ποσότητα</label>
                <input type="number" step="0.1" min="0" value={productForm.quantity} onChange={e => setProductForm({ ...productForm, quantity: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Σημειώσεις</label>
              <textarea value={productForm.notes} onChange={e => setProductForm({ ...productForm, notes: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowProductModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={saveProduct} disabled={saving}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMovementModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Καταχώρηση κίνησης αποθήκης</div>
              <button className="btn btn-sm" onClick={() => setShowMovementModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Προϊόν *</label>
                <select value={movementForm.product_id} onChange={e => setMovementForm({ ...movementForm, product_id: e.target.value })}>
                  <option value="">Επιλογή προϊόντος...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Τύπος κίνησης *</label>
                <select value={movementForm.type} onChange={e => setMovementForm({ ...movementForm, type: e.target.value })}>
                  <option value="in">Εισαγωγή (αγορά/παραλαβή)</option>
                  <option value="out">Εξαγωγή (χρήση/ανάλωση)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Ποσότητα *</label>
                <input type="number" step="0.1" min="0" value={movementForm.quantity} onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Ημερομηνία *</label>
                <input type="date" value={movementForm.date} onChange={e => setMovementForm({ ...movementForm, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Αιτία / Περιγραφή</label>
                <input value={movementForm.reason} onChange={e => setMovementForm({ ...movementForm, reason: e.target.value })} placeholder="πχ. Ημερήσια τροφοδοσία..." />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Σημειώσεις</label>
              <textarea value={movementForm.notes} onChange={e => setMovementForm({ ...movementForm, notes: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowMovementModal(false)}>Ακύρωση</button>
              <button className="btn btn-primary" onClick={saveMovement} disabled={saving}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
