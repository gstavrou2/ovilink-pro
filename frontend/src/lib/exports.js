import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

const GREEK_MAP = {
  'α':'a','β':'b','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th',
  'ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p',
  'ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o',
  'ά':'a','έ':'e','ή':'i','ί':'i','ό':'o','ύ':'y','ώ':'o','ϊ':'i','ϋ':'y','ΐ':'i','ΰ':'y',
  'Α':'A','Β':'B','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'Th',
  'Ι':'I','Κ':'K','Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P',
  'Ρ':'R','Σ':'S','Τ':'T','Υ':'Y','Φ':'F','Χ':'Ch','Ψ':'Ps','Ω':'O',
  'Ά':'A','Έ':'E','Ή':'I','Ί':'I','Ό':'O','Ύ':'Y','Ώ':'O','Ϊ':'I','Ϋ':'Y',
}

export function toGreeklish(str) {
  if (!str && str !== 0) return ''
  return String(str).split('').map(c => GREEK_MAP[c] ?? c).join('')
}

export function exportTableToExcel(rows, filename = 'export') {
  if (!rows || rows.length === 0) return
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const cols = Object.keys(rows[0]).map(key => ({ wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2 }))
  ws['!cols'] = cols
  XLSX.writeFile(wb, `${filename}_${todayStr()}.xlsx`)
}

export function exportMultiSheetExcel(sheets, filename = 'export') {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, rows }) => {
    if (!rows || rows.length === 0) return
    const ws = XLSX.utils.json_to_sheet(rows)
    const cols = Object.keys(rows[0]).map(key => ({ wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2 }))
    ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, name)
  })
  XLSX.writeFile(wb, `${filename}_${todayStr()}.xlsx`)
}

export function exportToPDF({ title, subtitle, headers, rows, filename }) {
  const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' })
  const pageW = doc.internal.pageSize.width
  doc.setFillColor(29, 158, 117)
  doc.rect(0, 0, pageW, 24, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text(toGreeklish(title), 14, 15)
  if (subtitle) { doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.text(toGreeklish(subtitle), 14, 21) }
  doc.setFontSize(8); doc.setTextColor(200,240,225)
  doc.text(`Export: ${formatDate(todayStr())}`, pageW - 14, 15, { align: 'right' })
  doc.setTextColor(0,0,0)
  autoTable(doc, {
    startY: 30,
    head: [headers.map(h => toGreeklish(h))],
    body: rows.map(row => row.map(cell => toGreeklish(cell))),
    headStyles: { fillColor:[29,158,117], textColor:255, fontStyle:'bold', fontSize:9 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor:[245,252,249] },
    styles: { cellPadding:3 },
    margin: { left:14, right:14 },
  })
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150)
    doc.text(`Selida ${i} apo ${pageCount}`, pageW/2, doc.internal.pageSize.height-8, { align:'center' })
  }
  doc.save(`${filename || toGreeklish(title)}_${todayStr()}.pdf`)
}

function todayStr() { return new Date().toISOString().split('T')[0] }
