// ── Tipos ─────────────────────────────────────────────────
export const TIPOS_AHORRO = [
  {
    valor: 'plazo_fijo',
    emoji: '🔒',
    label: 'Plazo fijo / Depósito',
    desc: 'Dinero bloqueado por un período con tasa garantizada',
    color: '#0891b2',
  },
  {
    valor: 'cts',
    emoji: '🏛️',
    label: 'CTS',
    desc: 'Compensación por Tiempo de Servicios — depósito del empleador',
    color: '#7c3aed',
  },
  {
    valor: 'fondo_empresa',
    emoji: '🏢',
    label: 'Fondo de ahorro empresa',
    desc: 'Ahorro con aporte del empleador (AFP voluntaria, fondo mutual, etc.)',
    color: '#d97706',
  },
]

export const TIPO_MAP = Object.fromEntries(TIPOS_AHORRO.map(t => [t.valor, t]))

export const BANCOS_PERU = [
  'BCP', 'BBVA', 'Interbank', 'Scotiabank', 'BanBif',
  'Banco Pichincha', 'Mibanco', 'Banco GNB', 'Banco Falabella',
  'Banco Ripley', 'Banco Santander', 'Otra entidad',
]

// ── Estados ───────────────────────────────────────────────
export const ESTADO_INFO = {
  activo:     { label: 'Activo',        color: '#16a34a', bg: '#f0fdf4', emoji: '🟢' },
  por_vencer: { label: 'Por vencer',    color: '#d97706', bg: '#fffbeb', emoji: '🟡' },
  vencido:    { label: 'Vencido',       color: '#dc2626', bg: '#fef2f2', emoji: '🔴' },
  renovado:   { label: 'Renovado',      color: '#0891b2', bg: '#ecfeff', emoji: '🔄' },
  cobrado:    { label: 'Cobrado',       color: '#64748b', bg: '#f8fafc', emoji: '✅' },
  bloqueado:  { label: 'Bloqueado',     color: '#7c3aed', bg: '#f5f3ff', emoji: '🔐' },
}

// ── Movimientos CTS ───────────────────────────────────────
export const TIPOS_MOVIMIENTO = {
  deposito_empleador:  { label: 'Depósito empleador', emoji: '🏢', color: '#16a34a' },
  deposito_propio:     { label: 'Depósito propio',    emoji: '↑',  color: '#0891b2' },
  retiro_parcial:      { label: 'Retiro parcial',     emoji: '↓',  color: '#f97316' },
  retiro_total:        { label: 'Retiro total',       emoji: '↓↓', color: '#dc2626' },
  renovacion:          { label: 'Renovación',         emoji: '🔄', color: '#0891b2' },
  interes_acreditado:  { label: 'Interés acreditado', emoji: '💹', color: '#16a34a' },
  ajuste:              { label: 'Ajuste de saldo',    emoji: '⟳',  color: '#d97706' },
}

// ── Formateo ─────────────────────────────────────────────
export function fmt(n, moneda = 'PEN') {
  const s = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : 'S/.'
  return `${s} ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}
export function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f + 'T00:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Días hasta vencimiento ────────────────────────────────
export function diasHastaVencer(fecha) {
  if (!fecha) return null
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fecha + 'T00:00:00')
  return Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24))
}

// ── Estado automático según fechas ───────────────────────
export function calcularEstado(ahorro) {
  if (ahorro.estado === 'cobrado' || ahorro.estado === 'renovado') return ahorro.estado
  if (!ahorro.fecha_vencimiento) return ahorro.estado
  const dias = diasHastaVencer(ahorro.fecha_vencimiento)
  if (dias < 0)   return 'vencido'
  if (dias <= 7)  return 'por_vencer'
  return 'activo'
}

// ── Interés proyectado (TEA simple) ──────────────────────
export function calcularInteresProyectado(monto, tasaAnual, fechaInicio, fechaVencimiento) {
  if (!monto || !tasaAnual || !fechaInicio || !fechaVencimiento) return 0
  const ini  = new Date(fechaInicio + 'T00:00:00')
  const fin  = new Date(fechaVencimiento + 'T00:00:00')
  const dias = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24))
  if (dias <= 0) return 0
  return Number(monto) * (tasaAnual / 100) * (dias / 365)
}

// ── Lógica CTS ────────────────────────────────────────────
// Períodos de depósito: mayo (1-15) y noviembre (1-15)
export function proximoDepositoCTS() {
  const hoy = new Date()
  const mes = hoy.getMonth() + 1
  const año = hoy.getFullYear()
  if (mes < 5 || (mes === 5 && hoy.getDate() <= 15)) {
    return { fecha: `${año}-05-15`, periodo: 'nov–abr', meses: 'noviembre a abril' }
  }
  if (mes < 11 || (mes === 11 && hoy.getDate() <= 15)) {
    return { fecha: `${año}-11-15`, periodo: 'may–oct', meses: 'mayo a octubre' }
  }
  return { fecha: `${año + 1}-05-15`, periodo: 'nov–abr', meses: 'noviembre a abril' }
}

export function diasHastaDepositoCTS() {
  const { fecha } = proximoDepositoCTS()
  return diasHastaVencer(fecha)
}

// ── Mensaje de disponibilidad CTS ────────────────────────
export function mensajeCTS(cts_disponible) {
  if (cts_disponible) {
    return {
      titulo: '✅ Libre disposición',
      desc: 'Tu CTS está disponible para retiro por ley temporal vigente.',
      color: '#16a34a', bg: '#f0fdf4',
    }
  }
  return {
    titulo: '🔐 Restringida',
    desc: 'Tu CTS está bloqueada. Solo puedes retirar ante cese laboral.',
    color: '#7c3aed', bg: '#f5f3ff',
  }
}
