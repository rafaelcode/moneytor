import { CATEGORIAS_GASTO, CAT_MAP } from './flujoUtils'

export { CATEGORIAS_GASTO, CAT_MAP }

// ── Categorías disponibles para presupuestar ─────────────
// Solo categorías de gasto (no tiene sentido presupuestar ingresos aquí)
export const CATS_PRESUPUESTO = CATEGORIAS_GASTO

// ── Plantillas predefinidas para arrancar rápido ─────────
export const PLANTILLAS_SUGERIDAS = [
  {
    nombre: '🏠 Hogar básico',
    descripcion: 'Para gastos esenciales del hogar: vivienda, comida, transporte y salud.',
    lineas: [
      { categoria: 'casa',       monto: 1200 },
      { categoria: 'comida',     monto: 800  },
      { categoria: 'transporte', monto: 300  },
      { categoria: 'salud',      monto: 150  },
      { categoria: 'imprevisto', monto: 200  },
    ],
  },
  {
    nombre: '📱 Estilo de vida completo',
    descripcion: 'Incluye ocio, suscripciones y ropa además de los básicos.',
    lineas: [
      { categoria: 'casa',          monto: 1200 },
      { categoria: 'comida',        monto: 800  },
      { categoria: 'transporte',    monto: 300  },
      { categoria: 'salud',         monto: 150  },
      { categoria: 'ocio',          monto: 200  },
      { categoria: 'suscripciones', monto: 80   },
      { categoria: 'ropa',          monto: 150  },
      { categoria: 'imprevisto',    monto: 200  },
    ],
  },
  {
    nombre: '💪 Ahorro agresivo',
    descripcion: 'Límites ajustados para maximizar el ahorro mensual.',
    lineas: [
      { categoria: 'comida',        monto: 500  },
      { categoria: 'transporte',    monto: 200  },
      { categoria: 'salud',         monto: 100  },
      { categoria: 'suscripciones', monto: 50   },
      { categoria: 'imprevisto',    monto: 150  },
    ],
  },
]

// ── Formateo ─────────────────────────────────────────────
export function fmt(n) {
  return `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
export function fmtDec(n) {
  return `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

// ── Estado de una línea: ok / alerta / excedido ───────────
export function estadoLinea(gastado, limite) {
  const pct = limite > 0 ? (gastado / limite) * 100 : 0
  if (pct >= 100) return { label: 'Excedido',  color: '#dc2626', bg: '#fef2f2', emoji: '🔴', pct }
  if (pct >= 80)  return { label: 'En alerta', color: '#d97706', bg: '#fffbeb', emoji: '🟡', pct }
  if (pct >= 50)  return { label: 'En curso',  color: '#0891b2', bg: '#ecfeff', emoji: '🔵', pct }
  return            { label: 'Holgado',   color: '#16a34a', bg: '#f0fdf4', emoji: '🟢', pct }
}

// ── Salud global del presupuesto ─────────────────────────
export function saludPresupuesto(lineas) {
  // lineas: [{limite, gastado}]
  const totalLimite  = lineas.reduce((s, l) => s + Number(l.monto_limite), 0)
  const totalGastado = lineas.reduce((s, l) => s + Number(l.gastado || 0), 0)
  const excedidas    = lineas.filter(l => Number(l.gastado || 0) > Number(l.monto_limite)).length
  const pct          = totalLimite > 0 ? (totalGastado / totalLimite) * 100 : 0
  return { totalLimite, totalGastado, excedidas, pct }
}

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
