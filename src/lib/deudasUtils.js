// ─── Tipos de deuda ───────────────────────────────────────
export const TIPOS_DEUDA = [
  { valor: 'tarjeta_credito',  emoji: '💳', label: 'Tarjeta de crédito',   color: '#ef4444' },
  { valor: 'prestamo_banco',   emoji: '🏦', label: 'Préstamo bancario',     color: '#f97316' },
  { valor: 'prestamo_personal',emoji: '🤝', label: 'Préstamo personal',     color: '#f59e0b' },
  { valor: 'cuotas_tienda',    emoji: '🛒', label: 'Cuotas / Tienda',       color: '#8b5cf6' },
  { valor: 'hipoteca',         emoji: '🏠', label: 'Hipoteca',              color: '#3b82f6' },
  { valor: 'deuda_amigo',      emoji: '👤', label: 'Deuda con persona',     color: '#14b8a6' },
  { valor: 'otro',             emoji: '📌', label: 'Otro',                  color: '#64748b' },
]

export const TIPO_MAP = Object.fromEntries(TIPOS_DEUDA.map(t => [t.valor, t]))

// ─── Formateo ─────────────────────────────────────────────
export function fmt(n) {
  return `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

export function fmtFecha(fecha) {
  if (!fecha) return '—'
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Calcula días hasta el próximo pago ───────────────────
export function diasHastaProximoPago(deuda) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Deuda con fecha fija de vencimiento
  if (deuda.fecha_vencimiento && !deuda.es_en_cuotas) {
    const venc = new Date(deuda.fecha_vencimiento + 'T00:00:00')
    return Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24))
  }

  // Deuda en cuotas con día de pago mensual
  if (deuda.dia_pago_mes) {
    const dia = deuda.dia_pago_mes
    let proximo = new Date(hoy.getFullYear(), hoy.getMonth(), dia)
    if (proximo <= hoy) {
      proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia)
    }
    return Math.ceil((proximo - hoy) / (1000 * 60 * 60 * 24))
  }

  return null
}

// ─── Semáforo de urgencia ─────────────────────────────────
export function urgencia(dias) {
  if (dias === null) return { color: '#64748b', bg: '#f1f5f9', label: 'Sin fecha', emoji: '📌' }
  if (dias < 0)     return { color: '#991b1b', bg: '#fef2f2', label: 'Vencida',   emoji: '🔴' }
  if (dias <= 3)    return { color: '#991b1b', bg: '#fef2f2', label: `${dias}d ⚡`, emoji: '🔴' }
  if (dias <= 7)    return { color: '#92400e', bg: '#fffbeb', label: `${dias}d`,   emoji: '🟠' }
  if (dias <= 15)   return { color: '#713f12', bg: '#fef3c7', label: `${dias}d`,   emoji: '🟡' }
  return               { color: '#166534', bg: '#f0fdf4', label: `${dias}d`,   emoji: '🟢' }
}

// ─── Porcentaje pagado ────────────────────────────────────
export function pctPagado(deuda) {
  if (!deuda.monto_total || deuda.monto_total === 0) return 0
  const pagado = deuda.monto_total - deuda.monto_pendiente
  return Math.min(100, Math.round((pagado / deuda.monto_total) * 100))
}

// ─── Interés mensual estimado ─────────────────────────────
export function interesMensualEstimado(deuda) {
  if (!deuda.tiene_interes || !deuda.monto_pendiente) return 0
  if (deuda.tasa_mensual) return deuda.monto_pendiente * (deuda.tasa_mensual / 100)
  if (deuda.tasa_anual)   return deuda.monto_pendiente * (deuda.tasa_anual / 100 / 12)
  return 0
}
