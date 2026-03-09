export const TIPOS_INGRESO_REC = [
  { valor:'sueldo',     emoji:'🏢', label:'Sueldo',            color:'#16a34a' },
  { valor:'honorarios', emoji:'💻', label:'Honorarios / RxH',  color:'#0891b2' },
  { valor:'renta',      emoji:'🏠', label:'Renta / Alquiler',  color:'#d97706' },
  { valor:'pension',    emoji:'🛡️', label:'Pensión / Jubilación',color:'#7c3aed' },
  { valor:'otro',       emoji:'💰', label:'Otro ingreso fijo', color:'#64748b' },
]

export const FRECUENCIAS = [
  { valor:'quincenal',  label:'Quincenal',     desc:'Cobra 2 veces al mes (ej: 15 y 30)' },
  { valor:'mensual',    label:'Mensual',        desc:'Cobra una vez al mes' },
  { valor:'semanal',    label:'Semanal',        desc:'Cobra cada semana' },
  { valor:'irregular',  label:'Irregular',      desc:'Sin frecuencia fija' },
]

export const PERIODOS = {
  quincena_1:   { label:'1ª quincena',  emoji:'🌓', color:'#0891b2', rango:'1–15' },
  quincena_2:   { label:'2ª quincena',  emoji:'🌕', color:'#7c3aed', rango:'16–fin' },
  mes_completo: { label:'Mes completo', emoji:'📅', color:'#16a34a', rango:'1–fin' },
}

// ── Formateo ─────────────────────────────────────────────
export function fmt(n, moneda='PEN') {
  if (n===null||n===undefined||n==='') return '—'
  const s = moneda==='USD'?'US$':'S/.'
  return `${s} ${Number(n).toLocaleString('es-PE',{minimumFractionDigits:2})}`
}
export function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})
}

// ── Calcular próxima fecha de cobro ──────────────────────
export function proximaFechaCobro(rec) {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const mes  = hoy.getMonth()
  const anio = hoy.getFullYear()

  if (rec.frecuencia === 'mensual') {
    let f = new Date(anio, mes, rec.dia_pago_1||1)
    if (f <= hoy) f = new Date(anio, mes+1, rec.dia_pago_1||1)
    return f.toISOString().split('T')[0]
  }

  if (rec.frecuencia === 'quincenal') {
    const d1 = rec.dia_pago_1 || 15
    const d2 = rec.dia_pago_2 || 30
    let f1   = new Date(anio, mes, d1)
    let f2   = new Date(anio, mes, Math.min(d2, new Date(anio,mes+1,0).getDate()))
    if (f1 > hoy) return f1.toISOString().split('T')[0]
    if (f2 > hoy) return f2.toISOString().split('T')[0]
    // Siguiente mes
    f1 = new Date(anio, mes+1, d1)
    return f1.toISOString().split('T')[0]
  }

  return rec.proxima_fecha || null
}

// ── Días hasta próximo cobro ──────────────────────────────
export function diasHastaCobro(fecha) {
  if (!fecha) return null
  const hoy  = new Date(); hoy.setHours(0,0,0,0)
  const prox = new Date(fecha+'T00:00:00')
  return Math.ceil((prox-hoy)/(1000*60*60*24))
}

// ── Quincena de una fecha ─────────────────────────────────
export function quincenaDeFecha(fecha) {
  const d = new Date(fecha+'T00:00:00').getDate()
  return d <= 15 ? 'quincena_1' : 'quincena_2'
}

// ── Rango de fechas de un período ────────────────────────
export function rangoPeriodo(mes, anio, periodo) {
  const m   = String(mes).padStart(2,'0')
  const ult = new Date(anio, mes, 0).getDate()
  if (periodo==='quincena_1') return { desde:`${anio}-${m}-01`, hasta:`${anio}-${m}-15` }
  if (periodo==='quincena_2') return { desde:`${anio}-${m}-16`, hasta:`${anio}-${m}-${ult}` }
  return { desde:`${anio}-${m}-01`, hasta:`${anio}-${m}-${ult}` }
}

// ── Asignar obligaciones al período correcto ──────────────
// Deudas: usa dia_pago_mes para asignar a quincena_1 (≤15) o quincena_2 (>15)
export function periodoDeObligacion(dia_pago) {
  if (!dia_pago) return 'mes_completo'
  return dia_pago <= 15 ? 'quincena_1' : 'quincena_2'
}

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
