export const TIPOS_INVERSION = [
  { valor:'acciones',    emoji:'📈', label:'Acciones',        color:'#16a34a', desc:'Acciones de empresas en bolsa' },
  { valor:'etf',         emoji:'🗂️', label:'ETF',             color:'#0891b2', desc:'Fondos cotizados en bolsa' },
  { valor:'fondo_mutuo', emoji:'🏦', label:'Fondo mutuo',     color:'#7c3aed', desc:'Fondos administrados por terceros' },
  { valor:'afp',         emoji:'🛡️', label:'AFP / Jubilación',color:'#d97706', desc:'Fondo de pensiones obligatorio o voluntario' },
  { valor:'cripto',      emoji:'₿',  label:'Criptomonedas',   color:'#f97316', desc:'Bitcoin, Ethereum u otras cripto' },
  { valor:'negocio',     emoji:'🏪', label:'Negocio propio',  color:'#db2777', desc:'Participación en negocio o empresa' },
  { valor:'otro',        emoji:'📦', label:'Otro',            color:'#64748b', desc:'Otro tipo de inversión' },
]

export const TIPO_MAP = Object.fromEntries(TIPOS_INVERSION.map(t => [t.valor, t]))

export const PLATAFORMAS = [
  'Renta4','Credicorp Capital','BBVA Asset Management',
  'Sura','Intercorp','Prima AFP','Integra AFP','Profuturo AFP','Habitat AFP',
  'Binance','Coinbase','Buda','Bitso',
  'Interactive Brokers','TD Ameritrade','Fidelity',
  'Otro',
]

export function fmt(n, moneda='PEN') {
  if (n===null||n===undefined||n==='') return '—'
  const s = moneda==='USD'?'US$':moneda==='EUR'?'€':'S/.'
  return `${s} ${Number(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}
export function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})
}

// Valor total de la inversión
export function calcularValorTotal(inv) {
  if (inv.precio_actual && inv.cantidad) return Number(inv.precio_actual)*Number(inv.cantidad)
  return Number(inv.valor_total||0)
}

// Ganancia/pérdida
export function ganancia(inv) {
  if (!inv.precio_compra||!inv.precio_actual||!inv.cantidad) return null
  return (Number(inv.precio_actual)-Number(inv.precio_compra))*Number(inv.cantidad)
}
export function gananciaPct(inv) {
  if (!inv.precio_compra||inv.precio_compra===0) return null
  const g = ganancia(inv)
  if (g===null) return null
  return (g/(Number(inv.precio_compra)*Number(inv.cantidad)))*100
}

// Costo total de compra
export function costoCompra(inv) {
  if (!inv.precio_compra||!inv.cantidad) return null
  return Number(inv.precio_compra)*Number(inv.cantidad)
}
