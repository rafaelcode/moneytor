export const TIPOS_DEUDA_REC = [
  { valor: 'tarjeta_credito', label: 'Tarjeta Crédito', emoji: '💳', color: '#7c3aed' },
  { valor: 'prestamo', label: 'Préstamo', emoji: '🏦', color: '#3b82f6' },
  { valor: 'servicios', label: 'Servicios (agua, luz, etc)', emoji: '💡', color: '#f59e0b' },
  { valor: 'renta', label: 'Renta', emoji: '🏠', color: '#ec4899' },
  { valor: 'otro', label: 'Otro', emoji: '💰', color: '#6b7280' },
]

export const FRECUENCIAS_DEUDA = [
  { valor: 'quincenal', label: 'Quincenal', desc: 'Cada 15 días' },
  { valor: 'mensual', label: 'Mensual', desc: 'Una vez al mes' },
  { valor: 'bimensual', label: 'Bimensual', desc: 'Cada 2 meses' },
]

export const fmt = n => `S/. ${Number(n||0).toLocaleString('es-PE', { maximumFractionDigits: 2 })}`

export function proximaFechaPago(deuda) {
  const hoy = new Date()
  const diaHoy = hoy.getDate()
  const mes = hoy.getMonth() + 1
  const anio = hoy.getFullYear()
  
  if (deuda.frecuencia === 'quincenal') {
    const dia1 = deuda.dia_pago_1 || 15
    const dia2 = deuda.dia_pago_2 || 30
    
    if (diaHoy < dia1) {
      return new Date(anio, mes - 1, dia1)
    } else if (diaHoy < dia2) {
      return new Date(anio, mes - 1, dia2)
    } else {
      return new Date(anio, mes, dia1)
    }
  } else if (deuda.frecuencia === 'mensual') {
    const dia = deuda.dia_pago_1 || 15
    if (diaHoy < dia) {
      return new Date(anio, mes - 1, dia)
    } else {
      return new Date(anio, mes, dia)
    }
  } else if (deuda.frecuencia === 'bimensual') {
    const dia = deuda.dia_pago_1 || 15
    if (diaHoy < dia) {
      return new Date(anio, mes - 1, dia)
    } else {
      return new Date(anio, mes + 1, dia)
    }
  }
  return null
}

export function diasHastaPago(fechaPago) {
  if (!fechaPago) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaPago)
  fecha.setHours(0, 0, 0, 0)
  return Math.ceil((fecha - hoy) / 86400000)
}
