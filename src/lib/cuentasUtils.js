// ── Tipos de cuenta ───────────────────────────────────────
export const TIPOS_CUENTA = [
  {
    valor:  'sueldo',
    emoji:  '💼',
    label:  'Cuenta sueldo',
    desc:   'Cuenta donde depositan tu sueldo o quincenas',
    color:  '#16a34a',
    campos: ['banco', 'numero_cuenta', 'cci', 'dia_pago', 'entidad_pagadora'],
    es_dinero_inmediato_default: true,
  },
  {
    valor:  'ahorro_digital',
    emoji:  '🏦',
    label:  'Cuenta de ahorro',
    desc:   'Cuenta de ahorro en banco o fintech con saldo disponible',
    color:  '#2563eb',
    campos: ['banco', 'numero_cuenta', 'cci', 'tasa_anual'],
    es_dinero_inmediato_default: true,
  },
  {
    valor:  'billetera_digital',
    emoji:  '📱',
    label:  'Billetera digital',
    desc:   'Yape, Plin, Tunki, Bim u otras billeteras móviles',
    color:  '#7c3aed',
    campos: ['plataforma', 'numero_telefono'],
    es_dinero_inmediato_default: true,
  },
  {
    valor:  'efectivo',
    emoji:  '💵',
    label:  'Efectivo',
    desc:   'Dinero físico en billetera o caja — sin banco ni cuenta',
    color:  '#16a34a',
    campos: [],
    es_dinero_inmediato_default: true,
  },
  {
    valor:  'corriente',
    emoji:  '🔄',
    label:  'Cuenta corriente',
    desc:   'Cuenta para operaciones diarias, pagos y cheques',
    color:  '#0891b2',
    campos: ['banco', 'numero_cuenta', 'cci'],
    es_dinero_inmediato_default: true,
  },
  {
    valor:  'credito_entidad',
    emoji:  '🏛️',
    label:  'Línea de crédito',
    desc:   'Crédito con entidad bancaria o cooperativa (hipotecario, vehicular, etc.)',
    color:  '#dc2626',
    campos: ['banco', 'numero_cuenta', 'cci', 'limite_credito', 'tasa_anual', 'fecha_vencimiento'],
    es_dinero_inmediato_default: false,
  },
]

export const TIPO_MAP = Object.fromEntries(TIPOS_CUENTA.map(t => [t.valor, t]))

// ── Clasificaciones de saldo ──────────────────────────────
export const CLASIFICACIONES_SALDO = [
  {
    valor: 'disponible',
    label: 'Disponible',
    desc: 'Dinero inmediato que puedes usar hoy',
    emoji: '✅',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
  {
    valor: 'patrimonio',
    label: 'Patrimonio',
    desc: 'Activo de valor pero no liquidable de inmediato',
    emoji: '🏛️',
    color: '#0891b2',
    bg: '#ecfeff',
  },
  {
    valor: 'intangible',
    label: 'Intangible / Bloqueado',
    desc: 'CTS, plazo fijo u otro dinero inmovilizado',
    emoji: '🔒',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  {
    valor: 'bloqueado',
    label: 'Reservado',
    desc: 'Asignado a una reserva específica (fondo de emergencia, etc.)',
    emoji: '🛡️',
    color: '#d97706',
    bg: '#fffbeb',
  },
]

export const CLASIFICACION_MAP = Object.fromEntries(CLASIFICACIONES_SALDO.map(c => [c.valor, c]))

export const BANCOS_PERU = [
  'BCP', 'BBVA', 'Interbank', 'Scotiabank', 'BanBif',
  'Banco de la Nación', 'Banco Pichincha', 'Mibanco',
  'Banco GNB', 'Banco Falabella', 'Banco Ripley',
  'Caja Huancayo', 'Caja Arequipa', 'Caja Piura',
  'Caja Metropolitana de Lima', 'Cooperativa San Cristóbal',
]

export const BILLETERAS = [
  'Yape', 'Plin', 'Tunki', 'Bim', 'Lukita', 'Mercado Pago', 'Otra',
]

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

// Formatea CCI con guiones para legibilidad (20 dígitos → xx-xxx-xxxxxxxxxx-xx)
export function fmtCCI(cci) {
  if (!cci) return ''
  const d = cci.replace(/\D/g, '')
  if (d.length !== 20) return cci
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,16)}-${d.slice(16)}`
}

// ── Íconos de movimientos ─────────────────────────────────
export const ICONO_MOV = {
  deposito:      { e: '↑',  c: '#16a34a', label: 'Depósito'        },
  retiro:        { e: '↓',  c: '#dc2626', label: 'Retiro'          },
  transferencia: { e: '↔',  c: '#2563eb', label: 'Transferencia'   },
  quincena:      { e: '💼', c: '#16a34a', label: 'Pago quincena'   },
  pago:          { e: '💸', c: '#f97316', label: 'Pago realizado'  },
  ajuste:        { e: '⟳',  c: '#d97706', label: 'Ajuste de saldo' },
}

// ── Acciones disponibles por tipo ────────────────────────
export function accionesDeTipo(tipo) {
  if (tipo === 'sueldo') {
    return [
      { v: 'quincena',      e: '💼', label: 'Cobro quincena',   color: '#16a34a', desc: 'Recibir pago' },
      { v: 'retiro',        e: '↓',  label: 'Retiro / Cobro',   color: '#dc2626', desc: 'Retirar dinero' },
      { v: 'transferencia', e: '↔',  label: 'Transferencia',    color: '#2563eb', desc: 'Mover a otra cuenta' },
      { v: 'ajuste',        e: '⟳',  label: 'Ajuste saldo',     color: '#d97706', desc: 'Corregir saldo' },
    ]
  }
  if (tipo === 'credito_entidad') {
    return [
      { v: 'pago',    e: '💸', label: 'Pagar cuota',    color: '#16a34a', desc: 'Abonar a la deuda' },
      { v: 'retiro',  e: '↓',  label: 'Disposición',    color: '#dc2626', desc: 'Usar crédito' },
      { v: 'ajuste',  e: '⟳',  label: 'Ajuste saldo',   color: '#d97706', desc: 'Corregir saldo' },
    ]
  }
  return [
    { v: 'deposito',      e: '↑',  label: 'Depósito',       color: '#16a34a', desc: 'Ingresar dinero' },
    { v: 'retiro',        e: '↓',  label: 'Retiro',          color: '#dc2626', desc: 'Retirar dinero' },
    { v: 'transferencia', e: '↔',  label: 'Transferencia',   color: '#2563eb', desc: 'Mover a otra cuenta' },
    { v: 'ajuste',        e: '⟳',  label: 'Ajuste saldo',    color: '#d97706', desc: 'Corregir saldo' },
  ]
}

// ── Calcular nuevo saldo después de un movimiento ─────────
export function calcNuevoSaldo(cuenta, accion, monto) {
  const saldo  = Number(cuenta.saldo_actual || 0)
  const deuda  = Number(cuenta.deuda_actual || 0)
  const limite = Number(cuenta.limite_credito || 0)
  const n      = Number(monto || 0)

  if (accion === 'ajuste') return { saldo_actual: n }

  if (cuenta.tipo === 'credito_entidad') {
    if (accion === 'pago')   return { saldo_actual: Math.min(limite, saldo + n), deuda_actual: Math.max(0, deuda - n) }
    if (accion === 'retiro') return { saldo_actual: Math.max(0, saldo - n),       deuda_actual: deuda + n }
  }

  if (['deposito', 'quincena'].includes(accion)) return { saldo_actual: saldo + n }
  if (['retiro', 'transferencia', 'pago'].includes(accion)) return { saldo_actual: Math.max(0, saldo - n) }
  return {}
}

// ── KPI helpers ───────────────────────────────────────────
/**
 * Dado un array de cuentas, calcula el saldo real (dinero inmediato disponible).
 * Incluye: sueldo, ahorro_digital, billetera_digital, corriente
 * con es_dinero_inmediato = true (o null, por compatibilidad hacia atrás).
 * Excluye: credito_entidad siempre.
 */
export function calcularSaldoRealCuentas(cuentas) {
  return cuentas
    .filter(c =>
      c.tipo !== 'credito_entidad' &&
      c.es_dinero_inmediato !== false  // null o true → incluye
    )
    .reduce((s, c) => s + Number(c.saldo_actual || 0), 0)
}

/**
 * Saldo que está en reservas/ahorro pero NO es dinero inmediato.
 */
export function calcularPatrimonioIntangible(cuentas) {
  return cuentas
    .filter(c => c.es_dinero_inmediato === false)
    .reduce((s, c) => s + Number(c.saldo_actual || 0), 0)
}
