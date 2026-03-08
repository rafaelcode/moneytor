// ── Tipos de reserva ─────────────────────────────────────
export const TIPOS_RESERVA = [
  {
    valor: 'cuenta_ahorros',
    emoji: '🏦',
    label: 'Cuenta de ahorros',
    desc: 'Cuenta bancaria de ahorro con tasa de interés',
    color: '#2563eb',
    campos: ['banco', 'numero_cuenta', 'tasa_anual'],
  },
  {
    valor: 'cuenta_corriente',
    emoji: '💳',
    label: 'Cuenta corriente',
    desc: 'Cuenta bancaria para operaciones diarias',
    color: '#0891b2',
    campos: ['banco', 'numero_cuenta'],
  },
  {
    valor: 'efectivo',
    emoji: '💵',
    label: 'Efectivo',
    desc: 'Dinero en físico: billetera, casa, caja chica',
    color: '#16a34a',
    campos: [],
  },
  {
    valor: 'fondo_emergencia',
    emoji: '🛡️',
    label: 'Fondo de emergencia',
    desc: 'Reserva intocable para imprevistos (meta: 3-6 meses de gastos)',
    color: '#7c3aed',
    campos: ['meta_monto'],
  },
  {
    valor: 'reserva_administrada',
    emoji: '🤝',
    label: 'Reserva administrada',
    desc: 'Efectivo entregado a otra persona para guardar o administrar',
    color: '#d97706',
    campos: ['contacto_nombre', 'contacto_email', 'fecha_devolucion', 'notas_admin'],
  },
]

export const TIPO_MAP = Object.fromEntries(TIPOS_RESERVA.map(t => [t.valor, t]))

export const BANCOS_PERU = [
  'BCP', 'BBVA', 'Interbank', 'Scotiabank', 'BanBif',
  'Banco Pichincha', 'Mibanco', 'Banco GNB', 'Banco Falabella',
  'Banco Ripley', 'Banco Santander', 'BCRP', 'Otro',
]

// ── Formateo ─────────────────────────────────────────────
export function fmt(n, moneda = 'PEN') {
  const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : 'S/.'
  return `${simbolo} ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

export function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f + 'T00:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Porcentaje de meta (fondo de emergencia) ─────────────
export function pctMeta(reserva) {
  if (!reserva.meta_monto || reserva.meta_monto === 0) return null
  return Math.min(100, Math.round((reserva.saldo_actual / reserva.meta_monto) * 100))
}

// ── Color semáforo de fondo emergencia ───────────────────
export function colorMeta(pct) {
  if (pct === null) return '#64748b'
  if (pct >= 100)   return '#16a34a'
  if (pct >= 60)    return '#d97706'
  return '#dc2626'
}

// ── Días para devolución (reserva administrada) ───────────
export function diasDevolucion(fecha) {
  if (!fecha) return null
  const hoy   = new Date(); hoy.setHours(0,0,0,0)
  const venc  = new Date(fecha + 'T00:00:00')
  return Math.ceil((venc - hoy) / (1000*60*60*24))
}
