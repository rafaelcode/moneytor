export const TIPOS_PROPIEDAD = [
  {
    valor: 'inmueble_vivienda',
    emoji: '🏠', label: 'Vivienda propia',
    desc:  'Casa o departamento donde resides',
    color: '#2563eb',
  },
  {
    valor: 'inmueble_inversion',
    emoji: '🏢', label: 'Inmueble inversión',
    desc:  'Propiedad para alquilar o revender',
    color: '#7c3aed',
  },
  {
    valor: 'terreno',
    emoji: '🏔️', label: 'Terreno',
    desc:  'Lote, parcela o terreno sin construir',
    color: '#b45309',
  },
  {
    valor: 'vehiculo',
    emoji: '🚗', label: 'Vehículo',
    desc:  'Auto, moto, camión u otro vehículo',
    color: '#0891b2',
  },
  {
    valor: 'maquinaria',
    emoji: '⚙️', label: 'Maquinaria / Equipo',
    desc:  'Equipo productivo de valor significativo',
    color: '#475569',
  },
  {
    valor: 'otro_activo',
    emoji: '📦', label: 'Otro activo',
    desc:  'Obra de arte, joyas, colección u otro bien',
    color: '#64748b',
  },
]

export const TIPO_MAP = Object.fromEntries(TIPOS_PROPIEDAD.map(t => [t.valor, t]))

// ── Liquidez estimada (días para convertir en efectivo) ──
export const LIQUIDEZ_OPCIONES = [
  { dias: 7,    label: 'Muy alta',  desc: '≤1 semana',  color: '#16a34a', emoji: '🟢' },
  { dias: 30,   label: 'Alta',      desc: '≈1 mes',     color: '#65a30d', emoji: '🟢' },
  { dias: 90,   label: 'Media',     desc: '1-3 meses',  color: '#d97706', emoji: '🟡' },
  { dias: 180,  label: 'Baja',      desc: '3-6 meses',  color: '#f97316', emoji: '🟠' },
  { dias: 365,  label: 'Muy baja',  desc: '6-12 meses', color: '#dc2626', emoji: '🔴' },
  { dias: 9999, label: 'Ilíquida',  desc: 'No vendería', color: '#991b1b', emoji: '⛔' },
]

export function liquidezInfo(dias) {
  if (!dias) return LIQUIDEZ_OPCIONES[5]
  return LIQUIDEZ_OPCIONES.find(o => dias <= o.dias) || LIQUIDEZ_OPCIONES[5]
}

// ── Formateo ─────────────────────────────────────────────
export function fmt(n, moneda = 'PEN') {
  if (n === null || n === undefined || n === '') return '—'
  const s = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : 'S/.'
  return `${s} ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
export function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Patrimonio neto de la propiedad ──────────────────────
export function patrimonioNeto(propiedad) {
  const valor = Number(propiedad.valor_estimado || 0)
  const deuda = Number(propiedad.deuda_pendiente || 0)
  return valor - deuda
}

// ── Rentabilidad (yield bruto) ────────────────────────────
export function yieldBruto(propiedad) {
  if (!propiedad.genera_renta || !propiedad.renta_mensual) return null
  if (!propiedad.valor_estimado || propiedad.valor_estimado === 0) return null
  return ((Number(propiedad.renta_mensual) * 12) / Number(propiedad.valor_estimado)) * 100
}

// ── Plusvalía ────────────────────────────────────────────
export function plusvalia(propiedad) {
  if (!propiedad.valor_compra || !propiedad.valor_estimado) return null
  return Number(propiedad.valor_estimado) - Number(propiedad.valor_compra)
}
export function plusvaliaPct(propiedad) {
  if (!propiedad.valor_compra || propiedad.valor_compra === 0) return null
  const pv = plusvalia(propiedad)
  if (pv === null) return null
  return (pv / Number(propiedad.valor_compra)) * 100
}
