// ── Categorías ────────────────────────────────────────────
export const CATEGORIAS_INGRESO = [
  { valor: 'sueldo',       emoji: '🏢', label: 'Sueldo / Remuneración', color: '#16a34a' },
  { valor: 'honorarios',   emoji: '💻', label: 'Honorarios / Freelance', color: '#0891b2' },
  { valor: 'bono',         emoji: '🎁', label: 'Bonos y comisiones',     color: '#7c3aed' },
  { valor: 'alquiler',     emoji: '🏠', label: 'Alquiler cobrado',       color: '#d97706' },
  { valor: 'dividendos',   emoji: '📈', label: 'Dividendos',             color: '#db2777' },
  { valor: 'otro_ingreso', emoji: '➕', label: 'Otros ingresos',         color: '#475569' },
]

export const CATEGORIAS_GASTO = [
  { valor: 'casa',          emoji: '🏘️', label: 'Vivienda',              color: '#2563eb' },
  { valor: 'comida',        emoji: '🍔', label: 'Alimentación',          color: '#16a34a' },
  { valor: 'transporte',    emoji: '🚗', label: 'Transporte',            color: '#0891b2' },
  { valor: 'salud',         emoji: '💊', label: 'Salud',                 color: '#dc2626' },
  { valor: 'educacion',     emoji: '📚', label: 'Educación',             color: '#7c3aed' },
  { valor: 'ropa',          emoji: '👗', label: 'Ropa y cuidado',        color: '#db2777' },
  { valor: 'ocio',          emoji: '🎮', label: 'Entretenimiento',       color: '#d97706' },
  { valor: 'suscripciones', emoji: '📱', label: 'Suscripciones',         color: '#0d9488' },
  { valor: 'seguros',       emoji: '🛡️', label: 'Seguros',               color: '#475569' },
  { valor: 'mantenimiento', emoji: '🔧', label: 'Mantenimiento hogar',   color: '#b45309' },
  { valor: 'imprevisto',    emoji: '⚡', label: 'Imprevistos',           color: '#ef4444' },
  { valor: 'otro_gasto',    emoji: '➕', label: 'Otros gastos',          color: '#64748b' },
]

export const CAT_MAP = Object.fromEntries(
  [...CATEGORIAS_INGRESO, ...CATEGORIAS_GASTO].map(c => [c.valor, c])
)

// ── Meses ─────────────────────────────────────────────────
export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// ── Formateo ─────────────────────────────────────────────
export function fmt(n) {
  return `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}
export function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f + 'T00:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Rango de fechas del mes ───────────────────────────────
export function rangoMes(anio, mes) {
  const m = String(mes).padStart(2, '0')
  const ultimo = new Date(anio, mes, 0).getDate()
  return {
    desde: `${anio}-${m}-01`,
    hasta: `${anio}-${m}-${ultimo}`,
  }
}

// ── Salud financiera ──────────────────────────────────────
export function saludFinanciera(ingresos, gastos) {
  if (ingresos === 0) return { nivel: 0, label: 'Sin datos', color: '#94a3b8', emoji: '—' }
  const ratio = gastos / ingresos
  if (ratio <= 0.5)  return { nivel: 4, label: 'Excelente', color: '#16a34a', emoji: '🟢' }
  if (ratio <= 0.7)  return { nivel: 3, label: 'Buena',     color: '#65a30d', emoji: '🟡' }
  if (ratio <= 0.9)  return { nivel: 2, label: 'Ajustada',  color: '#d97706', emoji: '🟠' }
  if (ratio <= 1.0)  return { nivel: 1, label: 'En límite', color: '#dc2626', emoji: '🔴' }
  return                    { nivel: 0, label: 'En déficit', color: '#991b1b', emoji: '🚨' }
}
