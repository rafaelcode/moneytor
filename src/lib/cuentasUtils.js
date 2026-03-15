// ── Tipos de cuenta ───────────────────────────────────────
export const TIPOS_CUENTA = [
  {
    valor:  'sueldo',
    emoji:  '💼',
    label:  'Cuenta sueldo',
    desc:   'Cuenta donde depositan tu sueldo o quincenas',
    color:  '#16a34a',
    campos: ['banco', 'numero_cuenta', 'dia_pago', 'entidad_pagadora'],
  },
  {
    valor:  'ahorro_digital',
    emoji:  '🏦',
    label:  'Cuenta de ahorro',
    desc:   'Cuenta de ahorro en banco o fintech con saldo disponible',
    color:  '#2563eb',
    campos: ['banco', 'numero_cuenta', 'tasa_anual'],
  },
  {
    valor:  'billetera_digital',
    emoji:  '📱',
    label:  'Billetera digital',
    desc:   'Yape, Plin, Tunki, Bim u otras billeteras móviles',
    color:  '#7c3aed',
    campos: ['plataforma', 'numero_telefono'],
  },
  {
    valor:  'corriente',
    emoji:  '🔄',
    label:  'Cuenta corriente',
    desc:   'Cuenta para operaciones diarias, pagos y cheques',
    color:  '#0891b2',
    campos: ['banco', 'numero_cuenta'],
  },
  {
    valor:  'credito_entidad',
    emoji:  '🏛️',
    label:  'Línea de crédito',
    desc:   'Crédito con entidad bancaria o cooperativa (hipotecario, vehicular, etc.)',
    color:  '#dc2626',
    campos: ['banco', 'numero_cuenta', 'limite_credito', 'tasa_anual', 'fecha_vencimiento'],
  },
]

export const TIPO_MAP = Object.fromEntries(TIPOS_CUENTA.map(t => [t.valor, t]))

export const BANCOS_PERU = [
  'BCP', 'BBVA', 'Interbank', 'Scotiabank', 'BanBif',
  'Banco de la Nación', 'Banco Pichincha', 'Mibanco',
  'Banco GNB', 'Banco Falabella', 'Banco Ripley',
  'Caja Huancayo', 'Caja Arequipa', 'Caja Piura',
  'Cooperativa San Cristóbal', 'Otro',
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
