import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_DEUDA_REC, proximaFechaPago, diasHastaPago } from '../lib/deudaRecurrenteUtils'

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const S0 = n => `S/. ${Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:0})}`
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function diasHasta(fecha) {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  return Math.ceil((new Date(fecha+'T00:00:00') - hoy) / 86400000)
}
function labelDias(d) {
  if (d < 0)  return { txt:`Venció hace ${Math.abs(d)}d`, color:'#dc2626' }
  if (d === 0) return { txt:'Vence HOY',                  color:'#dc2626' }
  if (d === 1) return { txt:'Mañana',                     color:'#f97316' }
  if (d <= 5)  return { txt:`En ${d} días`,               color:'#d97706' }
  return              { txt:`En ${d} días`,               color:'#64748b' }
}
function saludoHora() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

/* ── Mini donut ─────────────────────────────────────────── */
function MiniDonut({ pct, color, size=52, stroke=8 }) {
  const r=( size-stroke)/2, circ=2*Math.PI*r, fill=Math.min(pct||0,100)/100*circ
  return (
    <svg width={size} height={size} style={{flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={stroke-1} strokeLinecap="round"
        strokeDasharray={`${fill} ${circ-fill}`} strokeDashoffset={circ*0.25}
        style={{transition:'stroke-dasharray 0.6s'}}/>
      <text x={size/2} y={size/2+4} textAnchor="middle" fontSize="10"
        fill={color} fontFamily="Nunito,sans-serif" fontWeight="900">
        {Math.round(pct||0)}%
      </text>
    </svg>
  )
}

/* ── Bar chart ──────────────────────────────────────────── */
function BarChart({ ingreso, gasto, presupuesto }) {
  const bars = [
    { label:'Cobrado', v:ingreso,     color:'#16a34a' },
    { label:'Gastado', v:gasto,       color:'#dc2626' },
    ...(presupuesto ? [{ label:'Presup.', v:presupuesto, color:'#6c63ff' }] : []),
  ]
  const max = Math.max(...bars.map(b=>b.v), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:100 }}>
      {bars.map((b,i) => {
        const h = Math.round((b.v/max)*84)
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ fontSize:9, fontWeight:700, color:b.color, fontFamily:'Nunito' }}>{S0(b.v)}</div>
            <div style={{ width:'100%', height:84, display:'flex', alignItems:'flex-end' }}>
              <div style={{ width:'100%', height:h||3, background:`linear-gradient(180deg,${b.color},${b.color}cc)`, borderRadius:'5px 5px 0 0', boxShadow:`0 -2px 6px ${b.color}40`, transition:'height 0.7s cubic-bezier(.34,1.56,.64,1)' }}/>
            </div>
            <div style={{ width:'100%', height:2, background:b.color, borderRadius:1, opacity:0.4 }}/>
            <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600, textAlign:'center' }}>{b.label}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function Dashboard({ usuarioId, onNavigate, onRegistrar }) {
  const hoy    = new Date()
  const diaHoy = hoy.getDate()
  const mesAct  = hoy.getMonth()+1
  const anioAct = hoy.getFullYear()

  const [periodo,     setPeriodo]     = useState(diaHoy<=15 ? 'q1' : 'q2')
  const [cargando,    setCargando]    = useState(true)
  const [rec,         setRec]         = useState([])
  const [cobros,      setCobros]      = useState([])
  const [txsGasto,    setTxsGasto]    = useState([])
  const [deudas,      setDeudas]      = useState([])
  const [deudasRec,   setDeudasRec]   = useState([])
  const [pagosHechos, setPagosHechos] = useState({})
  const [lineasPres,  setLineasPres]  = useState([])

  // UI cobro
  const [cobrandoRec, setCobrandoRec] = useState(null)
  const [montoCobro,  setMontoCobro]  = useState('')
  const [loadingCob,  setLoadingCob]  = useState(false)

  // UI pago
  const [marcandoPago, setMarcandoPago] = useState(null)
  const [montoPago,    setMontoPago]    = useState('')
  const [loadingPago,  setLoadingPago]  = useState(false)

  useEffect(() => { cargar() }, [periodo])

  async function cargar() {
    setCargando(true)
    const m   = String(mesAct).padStart(2,'0')
    const ult = new Date(anioAct,mesAct,0).getDate()
    const desdeMes = `${anioAct}-${m}-01`
    const hastaMes = `${anioAct}-${m}-${ult}`
    const esQ1     = periodo==='q1'
    const desdePer = `${anioAct}-${m}-${esQ1?'01':'16'}`
    const hastaPer = `${anioAct}-${m}-${esQ1?'15':String(ult).padStart(2,'0')}`

    try {
      const [rR,cR,gR,dR,dRecR,pR,pmR] = await Promise.all([
        supabase.from('ingresos_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
        supabase.from('cobros').select('*').eq('usuario_id',usuarioId).gte('fecha_cobro',desdeMes).lte('fecha_cobro',hastaMes),
        supabase.from('transacciones').select('*').eq('usuario_id',usuarioId).eq('tipo','gasto').gte('fecha',desdeMes).lte('fecha',hastaMes),
        supabase.from('deudas').select('*').eq('usuario_id',usuarioId).eq('estado','activa'),
        supabase.from('deudas_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
        supabase.from('pagos_deuda').select('*').eq('usuario_id',usuarioId),
        supabase.from('presupuesto_mes').select('*,presupuesto_mes_lineas(*)').eq('usuario_id',usuarioId).eq('mes',mesAct).eq('anio',anioAct).single(),
      ])
      
      setRec(rR.data||[])
      setCobros(cR.data||[])
      setTxsGasto(gR.data||[])
      setDeudas(dR.data||[])
      setDeudasRec(dRecR.data||[])
      const deudRecIds = new Set((dRecR.data||[]).map(d=>d.id))
      const ph={}; (pR.data||[]).forEach(p=>{ 
        if (p.deuda_recurrente_id) {
          ph[`dr_${p.deuda_recurrente_id}`]=p
        } else if (p.deuda_id && deudRecIds.has(p.deuda_id)) {
          // Some schemas store recurring payments in deuda_id instead of deuda_recurrente_id
          ph[`dr_${p.deuda_id}`]=p
        }
        if (p.deuda_id) ph[`d_${p.deuda_id}`]=p
      })
      console.log('Pagos cargados desde BD:', pR.data)
      console.log('Pagos procesados (ph):', ph)
      setPagosHechos(ph)
      setLineasPres(pmR.data?.presupuesto_mes_lineas||[])
      setCargando(false)
    } catch (error) {
      console.error('Error cargando datos:', error)
      setCargando(false)
    }
  }

  async function confirmarCobro(r) {
    if (!montoCobro||Number(montoCobro)<=0) return
    setLoadingCob(true)
    const pKey = periodo==='q1'?'quincena_1':'quincena_2'
    const fecha = hoy.toISOString().split('T')[0]
    const {data:tx} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'ingreso', monto:Number(montoCobro),
      categoria:r.tipo==='sueldo'?'sueldo':'otro_ingreso',
      descripcion:`${r.nombre}${periodo==='q1'?' – 1ª quincena':' – 2ª quincena'}`, fecha,
    }).select().single()
    await supabase.from('cobros').insert({
      usuario_id:usuarioId, ingreso_recurrente_id:r.id,
      nombre:r.nombre, monto:Number(montoCobro), fecha_cobro:fecha, periodo:pKey, transaccion_id:tx?.id||null,
    })
    setCobrandoRec(null); setMontoCobro(''); setLoadingCob(false); cargar()
  }

  async function confirmarPago(deuda) {
    if (!montoPago||Number(montoPago)<=0) return
    setLoadingPago(true)
    const fecha = hoy.toISOString().split('T')[0]
    await supabase.from('pagos_deuda').insert({ deuda_id:deuda.id, usuario_id:usuarioId, monto:Number(montoPago), fecha:fecha })
    await supabase.from('transacciones').insert({ usuario_id:usuarioId, tipo:'gasto', monto:Number(montoPago), categoria:'otro_gasto', descripcion:`Pago ${deuda.nombre}`, fecha })
    await supabase.from('deudas').update({ monto_pendiente:Math.max(0,Number(deuda.monto_pendiente)-Number(montoPago)) }).eq('id',deuda.id)
    setMarcandoPago(null); setMontoPago(''); setLoadingPago(false); cargar()
  }

  async function marcarPagoDeudaPuntual(deuda) {
    const monto = Number(deuda.monto_pendiente || deuda.monto || deuda.monto_cuota || 0)
    const fecha = hoy.toISOString().split('T')[0]
    
    const {data:tx, error:txError} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'gasto', monto, fecha,
      categoria:'otro_gasto', descripcion:`Pago ${deuda.nombre}`,
    }).select().single()
    
    if (txError) {
      console.error('Error creando transacción:', txError)
      return
    }
    
    const {error:pagoError} = await supabase.from('pagos_deuda').insert({
      usuario_id:usuarioId,
      deuda_id:deuda.id,
      monto:monto,
      fecha:fecha,
    })
    
    if (pagoError) {
      console.error('Error guardando pago deuda:', pagoError)
      return
    }
    
    cargar()
  }

  async function marcarPagoDeudaRec(deudaRec, monto) {
    const montoNum = Number(monto || 0)
    const fecha = hoy.toISOString().split('T')[0]
    
    const {data:tx, error:txError} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'gasto', monto:montoNum, fecha,
      categoria:'otro_gasto', descripcion:`Pago ${deudaRec.nombre}`,
    }).select().single()
    
    if (txError) {
      console.error('Error creando transacción:', txError)
      return
    }
    
    // Try to save with the dedicated recurring-debt foreign key column.
    // If the column doesn't exist or the foreign key fails, we can't safely fallback.
    // This helps uncover schema mismatch issues early.
    const { error: err1 } = await supabase.from('pagos_deuda').insert({
      usuario_id: usuarioId,
      deuda_recurrente_id: deudaRec.id,
      monto: montoNum,
      fecha: fecha,
    })

    let pagoError = err1
    if (err1) {
      // Common schema issues:
      // - PGRST204: column deuda_recurrente_id is missing in pagos_deuda
      // - 23503: foreign key constraint failed (no matching row in deudas_recurrentes)
      if (err1.code === 'PGRST204' && err1.message?.includes('deuda_recurrente_id')) {
        console.error('Esquema incompleto: falta la columna deuda_recurrente_id en pagos_deuda.', err1)
        alert('Error: no se puede registrar el pago porque falta la columna `deuda_recurrente_id` en la tabla `pagos_deuda`. Por favor actualiza el esquema. (PGRST204)')
      } else if (err1.code === '23503' && err1.message?.includes('pagos_deuda_deuda_id_fkey')) {
        console.error('Clave foránea fallida: el registro de deuda recurrente no existe en la tabla deudas.', err1)
        alert('Error: no se encontró la deuda recurrente asociada. Verifica que el registro exista en la tabla `deudas_recurrentes`. (23503)')
      }
    }

    if (pagoError) {
      console.error('Error guardando pago deuda recurrente:', pagoError)
      alert('No se pudo registrar el pago de la deuda recurrente. Revisa la consola para más detalles.')
      return
    }

    cargar()
  }

  async function marcarCobroIngreso(rec, quincena) {
    const pKey = quincena==='q1'?'quincena_1':'quincena_2'
    const monto = quincena==='q1'?Number(rec.monto_pago_1||rec.monto_total):Number(rec.monto_pago_2||rec.monto_total)
    const fecha = hoy.toISOString().split('T')[0]
    
    const {data:tx} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'ingreso', monto, fecha,
      categoria:rec.tipo==='sueldo'?'sueldo':'otro_ingreso',
      descripcion:`${rec.nombre}${quincena==='q1'?' – 1ª quincena':' – 2ª quincena'}`,
    }).select().single()
    
    await supabase.from('cobros').insert({
      usuario_id:usuarioId, ingreso_recurrente_id:rec.id, nombre:rec.nombre,
      monto, moneda:rec.moneda||'PEN', fecha_cobro:fecha, periodo:pKey, transaccion_id:tx?.id||null,
    })
    cargar()
  }

  async function desmarcarCobroIngreso(cobroId, txId) {
    await supabase.from('cobros').delete().eq('id', cobroId)
    if (txId) await supabase.from('transacciones').delete().eq('id', txId)
    cargar()
  }

  async function desmarcarPagoDeuda(pagoId) {
    // Obtener los datos del pago para buscar la transacción asociada
    const {data:pagoData} = await supabase.from('pagos_deuda').select('*').eq('id', pagoId).single()
    
    // Eliminar la transacción asociada si existe
    if (pagoData) {
      const {data:txs} = await supabase.from('transacciones')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('tipo', 'gasto')
        .eq('monto', pagoData.monto)
        .eq('fecha', pagoData.fecha)
        .ilike('descripcion', '%Pago%')
      
      if (txs && txs.length > 0) {
        await supabase.from('transacciones').delete().eq('id', txs[0].id)
      }
    }
    
    // Eliminar el registro de pago
    const {error:delError} = await supabase.from('pagos_deuda').delete().eq('id', pagoId)
    if (delError) {
      console.error('Error eliminando pago:', delError)
      return
    }
    
    cargar()
  }

  /* ── Cálculos ─────────────────────────────────────────── */
  const esQ1         = periodo==='q1'
  const pKey         = esQ1?'quincena_1':'quincena_2'
  const recPer       = rec.filter(r=> r.frecuencia==='quincenal' || (r.frecuencia==='mensual'&&esQ1))
  const cobrosPer    = cobros.filter(c=>c.periodo===pKey)
  const totalCobrado = cobrosPer.reduce((s,c)=>s+Number(c.monto),0)
  const totalEsperado= recPer.reduce((s,r)=>s+(esQ1?Number(r.monto_pago_1||r.monto_total):Number(r.monto_pago_2||r.monto_total)),0)
  const todosCobraron= recPer.length>0 && recPer.every(r=>cobrosPer.some(c=>c.ingreso_recurrente_id===r.id))
  const totalGastos  = txsGasto.reduce((s,t)=>s+Number(t.monto),0)
  const totalPres    = lineasPres.reduce((s,l)=>s+Number(l.monto_limite),0)/2

  const saldoReal = totalCobrado - totalGastos

  const oblEsta      = deudas.filter(d=>d.dia_pago_mes&&(esQ1?d.dia_pago_mes<=15:d.dia_pago_mes>15))
  const oblSig       = deudas.filter(d=>d.dia_pago_mes&&(esQ1?d.dia_pago_mes>15:d.dia_pago_mes<=15))
  const totalOblEsta = oblEsta.reduce((s,d)=>s+Number(d.monto_cuota||0),0)
  const totalOblSig  = oblSig.reduce((s,d)=>s+Number(d.monto_cuota||0),0)

  // Obligaciones recurrentes del período (para Saldo Final)
  const deudRecPer = deudasRec.filter(dr => dr.frecuencia==='quincenal' || (dr.frecuencia==='mensual'&&esQ1))
  const totalOblRecPer = deudRecPer.reduce((s,dr)=>{
    const m = (dr.frecuencia==='quincenal' && esQ1) ? dr.monto_pago_1||dr.monto_total
            : (dr.frecuencia==='quincenal' && !esQ1) ? dr.monto_pago_2||dr.monto_total
            : dr.monto_total
    return s+Number(m||0)
  },0)

  // Deudas puntuales pendientes de pago (no solo el período actual)
  const deudasPendientes = deudas.reduce((s,d)=>{
    const pagado = !!pagosHechos[`d_${d.id}`]
    if (pagado) return s
    return s + Number(d.monto_pendiente || d.monto_cuota || 0)
  },0)

  const obligacionesRecPendientes = deudRecPer.reduce((s,dr)=>{
    const pagado = !!pagosHechos[`dr_${dr.id}`]
    if (pagado) return s
    const m = (dr.frecuencia==='quincenal' && esQ1) ? dr.monto_pago_1||dr.monto_total
            : (dr.frecuencia==='quincenal' && !esQ1) ? dr.monto_pago_2||dr.monto_total
            : dr.monto_total
    return s + Number(m||0)
  },0)

  const totalObligacionesPeriodo = deudasPendientes + obligacionesRecPendientes
  const libre        = saldoReal - totalObligacionesPeriodo
  const alcanza      = totalCobrado >= totalOblEsta
  const pctGastos    = totalCobrado>0 ? (totalGastos/totalCobrado)*100 : 0

  const proximosIngresos = rec.map(r => {
    const dia   = esQ1 ? (r.dia_pago_2||30) : (r.dia_pago_1||15)
    const diaStr= String(Math.min(dia, new Date(anioAct,mesAct,0).getDate())).padStart(2,'0')
    const fecha = `${anioAct}-${String(mesAct).padStart(2,'0')}-${diaStr}`
    const d     = diasHasta(fecha)
    const monto = esQ1 ? Number(r.monto_pago_2||r.monto_total) : Number(r.monto_pago_1||r.monto_total)
    return { ...r, fechaProxima:fecha, diasRest:d, montoProximo:monto }
  }).filter(r=>r.diasRest>=0).sort((a,b)=>a.diasRest-b.diasRest)

  if (cargando) return (
    <div className="page">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[1,2,3,4,5,6].map(i=>(
          <div key={i} className="skeleton" style={{ height: i<=2?100:160, gridColumn: i>4?'span 2':'span 1' }}/>
        ))}
      </div>
    </div>
  )

  return (
    <div className="page">

      {/* ══ HEADER ══════════════════════════════════════════ */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, letterSpacing:'-0.4px' }}>{saludoHora()} 👋</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span>
                {hoy.toLocaleDateString('es-PE',{weekday:'long',day:'numeric'})}
              </span>
              <span style={{
                background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',
                color:'white',
                padding:'4px 10px',
                borderRadius:8,
                fontWeight:900,
                fontSize:12,
                textTransform:'capitalize',
                letterSpacing:'0.5px',
                boxShadow:'0 2px 8px rgba(108,99,255,0.3)'
              }}>
                {MESES[hoy.getMonth()]}
              </span>
              <span>{anioAct}</span>
            </div>
          </div>
          <button onClick={()=>onNavigate('quincena_resumen')} style={{ fontSize:11, fontWeight:700, color:'#6c63ff', background:'#f5f3ff', border:'1.5px solid #c4b5fd', borderRadius:8, padding:'6px 12px' }}>
            📊 Ver detalle
          </button>
        </div>
      </div>

      {/* ══ KPIs PRINCIPALES ═════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {/* Cobrado */}
        <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #86efac', borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#166534', textTransform:'uppercase', marginBottom:6 }}>💰 Cobrado</div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color:'#16a34a', marginBottom:2 }}>{S0(totalCobrado)}</div>
          <div style={{ fontSize:10, color:'#166534' }}>{cobrosPer.length}/{recPer.length} cuotas</div>
        </div>

        {/* Gastos */}
        <div style={{ background:'linear-gradient(135deg,#fef2f2,#fee2e2)', border:'1.5px solid #fca5a5', borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#991b1b', textTransform:'uppercase', marginBottom:6 }}>💸 Gastos</div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color:'#dc2626', marginBottom:2 }}>{S0(totalGastos)}</div>
          <div style={{ fontSize:10, color:'#991b1b' }}>{pctGastos.toFixed(0)}% del cobrado</div>
        </div>

        {/* Saldo Real */}
        <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1.5px solid #93c5fd', borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#1e40af', textTransform:'uppercase', marginBottom:6 }}>💵 Saldo Real</div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color:'#2563eb', marginBottom:2 }}>{S0(totalCobrado - totalGastos)}</div>
          <div style={{ fontSize:10, color:'#1e40af' }}>{totalCobrado - totalGastos >= 0 ? '✅' : '⚠️'}</div>
        </div>

        {/* Saldo Final */}
        <div style={{ background:libre>=0?'linear-gradient(135deg,#f0f9ff,#e0f2fe)':'linear-gradient(135deg,#fef2f2,#fee2e2)', border:`1.5px solid ${libre>=0?'#0284c7':'#fca5a5'}`, borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:libre>=0?'#0c4a6e':'#991b1b', textTransform:'uppercase', marginBottom:6 }}>{libre>=0?'✨ Saldo Final':'⚠️ Falta'}</div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color:libre>=0?'#0369a1':'#dc2626', marginBottom:2 }}>{S0(libre)}</div>
          <div style={{ fontSize:9, color:'var(--text3)' }}>Saldo real - deudas pendientes</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          FLUJO DE CAJA & MOVIMIENTOS
      ══════════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gap:14, marginBottom:16 }}>

        {/* ────── FLUJO DE CAJA + MOVIMIENTOS (full width) ────── */}
        <div style={{ display:'grid', gap:14 }}>

          {/* Flujo de caja */}
          <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, marginBottom:12, color:'#16a34a' }}>
              💧 Flujo de caja
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12 }}>

              {/* Ingresos recurrentes */}
              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>💰 Ingresos recurrentes</div>
                {rec.length===0 ? (
                  <div style={{ textAlign:'center', padding:'18px 0', fontSize:12, color:'var(--text3)' }}>
                    Sin ingresos configurados. Configura en Flujo de Caja.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:250, overflowY:'auto', paddingRight:6 }}>
                    {rec.map(r => {
                      const cobroQ1 = cobros.find(c => c.ingreso_recurrente_id===r.id && c.periodo==='quincena_1')
                      const cobroQ2 = cobros.find(c => c.ingreso_recurrente_id===r.id && c.periodo==='quincena_2')
                      const cobroMes = cobros.find(c => c.ingreso_recurrente_id===r.id && c.periodo==='mes_completo')
                      return (
                        <div key={r.id}>
                          <div style={{ fontWeight:700, fontSize:12, marginBottom:6, color:'var(--text)' }}>{r.nombre}</div>
                          {r.frecuencia==='quincenal' ? (
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                              {[
                                { q:'q1', label:'Q1 (1-15)', monto:r.monto_pago_1, cobro:cobroQ1 },
                                { q:'q2', label:'Q2 (16-31)', monto:r.monto_pago_2, cobro:cobroQ2 },
                              ].map(item => (
                                <div key={item.q}
                                  style={{
                                    display:'flex', alignItems:'center', gap:6,
                                    padding:'8px 10px', borderRadius:9,
                                    background:item.cobro?'#f0fdf4':'var(--bg)',
                                    border:`1.5px solid ${item.cobro?'#86efac':'var(--border)'}`,
                                    transition:'all 0.2s',
                                  }}>
                                  <div onClick={() => !item.cobro && marcarCobroIngreso(r, item.q)}
                                    style={{
                                      display:'flex', alignItems:'center', gap:6,
                                      cursor:item.cobro?'default':'pointer',
                                      flex:1,
                                    }}>
                                    <div style={{
                                      width:18, height:18, borderRadius:5, flexShrink:0,
                                      border:`2px solid ${item.cobro?'#16a34a':'#d1d5db'}`,
                                      background:item.cobro?'#16a34a':'white',
                                      display:'flex', alignItems:'center', justifyContent:'center',
                                    }}>
                                      {item.cobro && <span style={{fontSize:10, color:'white', fontWeight:900}}>✓</span>}
                                    </div>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{item.label}</div>
                                      <div style={{ fontSize:11, fontWeight:700, color:item.cobro?'#16a34a':'#666' }}>{S0(item.monto)}</div>
                                    </div>
                                  </div>
                                  {item.cobro && (
                                    <button onClick={() => desmarcarCobroIngreso(item.cobro.id, item.cobro.transaccion_id)}
                                      style={{ padding:'4px 6px', borderRadius:5, background:'#fca5a5', border:'none', color:'white', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div
                              style={{
                                display:'flex', alignItems:'center', gap:6,
                                padding:'8px 10px', borderRadius:9,
                                background:cobroMes?'#f0fdf4':'var(--bg)',
                                border:`1.5px solid ${cobroMes?'#86efac':'var(--border)'}`,
                                transition:'all 0.2s',
                              }}>
                              <div onClick={() => !cobroMes && marcarCobroIngreso(r, 'mes_completo')}
                                style={{
                                  display:'flex', alignItems:'center', gap:6,
                                  cursor:cobroMes?'default':'pointer',
                                  flex:1,
                                }}>
                                <div style={{
                                  width:18, height:18, borderRadius:5, flexShrink:0,
                                  border:`2px solid ${cobroMes?'#16a34a':'#d1d5db'}`,
                                  background:cobroMes?'#16a34a':'white',
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                }}>
                                  {cobroMes && <span style={{fontSize:10, color:'white', fontWeight:900}}>✓</span>}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>Mes completo</div>
                                  <div style={{ fontSize:11, fontWeight:700, color:cobroMes?'#16a34a':'#666' }}>{S0(r.monto_total)}</div>
                                </div>
                              </div>
                              {cobroMes && (
                                <button onClick={() => desmarcarCobroIngreso(cobroMes.id, cobroMes.transaccion_id)}
                                  style={{ padding:'4px 6px', borderRadius:5, background:'#fca5a5', border:'none', color:'white', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Gastos recurrentes */}
              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>💸 Gastos recurrentes</div>
                {deudRecPer.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'18px 0', fontSize:12, color:'var(--text3)' }}>
                    Sin gastos recurrentes para este período.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:250, overflowY:'auto', paddingRight:6 }}>
                    {deudRecPer.sort((a,b)=>{
                      const pagA=!!pagosHechos[`dr_${a.id}`];
                      const pagB=!!pagosHechos[`dr_${b.id}`];
                      return pagA - pagB;
                    }).map(dr=>{
                      const monto = (dr.frecuencia==='quincenal' && esQ1) ? Number(dr.monto_pago_1||dr.monto_total||0)
                                  : (dr.frecuencia==='quincenal' && !esQ1) ? Number(dr.monto_pago_2||dr.monto_total||0)
                                  : Number(dr.monto_total||0)
                      const pagado = !!pagosHechos[`dr_${dr.id}`]
                      const tipoInfo = TIPOS_DEUDA_REC.find(t=>t.valor===dr.tipo) || {emoji:'💳', color:'#7c3aed'}
                      return (
                        <div key={dr.id}
                          style={{
                            display:'flex', alignItems:'center', gap:6,
                            padding:'6px 8px', borderRadius:7,
                            background:pagado?'#f0fdf4':'var(--bg)',
                            border:`1px solid ${pagado?'#86efac':'var(--border)'}`,
                            transition:'all 0.2s',
                            cursor:pagado?'default':'pointer',
                          }}
                          onClick={() => !pagado && marcarPagoDeudaRec(dr, monto)}>
                          <div style={{
                            width:16, height:16, borderRadius:4, flexShrink:0,
                            border:`1.5px solid ${pagado?'#16a34a':'#d1d5db'}`,
                            background:pagado?'#16a34a':'white',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:8,
                          }}>
                            {pagado && <span style={{color:'white', fontWeight:900}}>✓</span>}
                          </div>
                          <div style={{ fontSize:13, flexShrink:0, opacity:pagado?0.5:1 }}>{tipoInfo.emoji}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, fontWeight:600, color:'var(--text2)', textDecoration:pagado?'line-through':'none' }}>{dr.nombre||'Sin nombre'}</div>
                            <div style={{ fontSize:10, fontWeight:700, color:pagado?'#16a34a':'#7c3aed' }}>{S0(monto)}</div>
                          </div>
                          {pagado && (
                            <button onClick={(e) => {
                              e.stopPropagation()
                              desmarcarPagoDeuda(pagosHechos[`dr_${dr.id}`].id)
                            }}
                              style={{ padding:'3px 5px', borderRadius:4, background:'#fca5a5', border:'none', color:'white', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                              ✕
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Movimientos */}
          <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, marginBottom:12, color:'#6c63ff' }}>
              📌 Movimientos
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12 }}>

              {/* Ingresos del mes */}
              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>💰 Ingresos del mes</div>
                {cobros.length===0 ? (
                  <div style={{ textAlign:'center', padding:'18px 0', fontSize:12, color:'var(--text3)' }}>
                    Sin cobros registrados.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:210, overflowY:'auto', paddingRight:6 }}>
                    {cobros.map(c => (
                      <div key={c.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2)' }}>
                        <div style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nombre || c.descripcion || 'Ingreso'}</div>
                        <div style={{ fontWeight:700, color:'#16a34a', marginLeft:10 }}>{S0(c.monto)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gastos pagados */}
              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>💸 Gastos pagados</div>
                {txsGasto.length===0 ? (
                  <div style={{ textAlign:'center', padding:'18px 0', fontSize:12, color:'var(--text3)' }}>
                    Sin gastos registrados este mes.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:210, overflowY:'auto', paddingRight:6 }}>
                    {txsGasto.map(t => (
                      <div key={t.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2)' }}>
                        <div style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {t.descripcion || t.categoria || 'Gasto'}
                        </div>
                        <div style={{ fontWeight:700, color:'#dc2626', marginLeft:10 }}>{S0(t.monto)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Deudas actuales */}
              <div style={{ gridColumn:'span 2', background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>💳 Deudas actuales</div>
                {deudas.length===0 ? (
                  <div style={{ textAlign:'center', padding:'18px 0', fontSize:12, color:'var(--text3)' }}>
                    Sin deudas configuradas.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:240, overflowY:'auto', paddingRight:6 }}>
                    {deudas.sort((a,b)=>{
                      const pa=!!pagosHechos[`d_${a.id}`];
                      const pb=!!pagosHechos[`d_${b.id}`];
                      return pa - pb;
                    }).map(d=>{
                      const pagado = !!pagosHechos[`d_${d.id}`]
                      return (
                        <div key={d.id}
                          style={{
                            display:'flex', alignItems:'center', gap:6,
                            padding:'6px 8px', borderRadius:7,
                            background:pagado?'#f0fdf4':'var(--bg)',
                            border:`1px solid ${pagado?'#86efac':'var(--border)'}`,
                            transition:'all 0.2s',
                            cursor:pagado?'default':'pointer',
                          }}
                          onClick={() => !pagado && marcarPagoDeudaPuntual(d)}>
                          <div style={{
                            width:16, height:16, borderRadius:4, flexShrink:0,
                            border:`1.5px solid ${pagado?'#16a34a':'#d1d5db'}`,
                            background:pagado?'#16a34a':'white',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:8,
                          }}>
                            {pagado && <span style={{color:'white', fontWeight:900}}>✓</span>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, fontWeight:600, color:'var(--text2)', textDecoration:pagado?'line-through':'none' }}>{d.nombre||'Sin nombre'}</div>
                            <div style={{ fontSize:10, fontWeight:700, color:pagado?'#16a34a':'#dc2626' }}>{S0(Number(d.monto_pendiente || d.monto || d.monto_cuota || 0))}</div>
                          </div>
                          {pagado && (
                            <button onClick={(e) => {
                              e.stopPropagation()
                              desmarcarPagoDeuda(pagosHechos[`d_${d.id}`].id)
                            }}
                              style={{ padding:'3px 5px', borderRadius:4, background:'#fca5a5', border:'none', color:'white', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                              ✕
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>


      {/* ══ PRÓXIMOS INGRESOS + PRÓXIMA QUINCENA ════════════ */}
      <div className="g2" style={{ marginBottom:16 }}>

        {/* Próximos ingresos */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13 }}>📅 Próximos ingresos</div>
            <button onClick={()=>onNavigate('flujo_caja')} style={{ fontSize:10, fontWeight:700, color:'#16a34a', background:'none', border:'none' }}>Config →</button>
          </div>
          {proximosIngresos.length===0 ? (
            <div style={{ textAlign:'center', padding:'14px 0' }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>Sin ingresos configurados</div>
              <button onClick={()=>onNavigate('flujo_caja')} style={{ fontSize:11, fontWeight:700, color:'#16a34a', background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:9, padding:'6px 12px' }}>+ Configurar</button>
            </div>
          ) : proximosIngresos.map((r,i)=>{
            const dl = labelDias(r.diasRest)
            return (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, background:r.diasRest<=2?'#f0fdf4':'var(--bg)', border:`1.5px solid ${r.diasRest<=2?'#86efac':'var(--border)'}`, borderRadius:11, padding:'10px 12px', marginBottom:7 }}>
                <div style={{ width:36, height:36, borderRadius:9, flexShrink:0, background:r.diasRest<=2?'#16a34a15':'#0891b215', border:`1.5px solid ${r.diasRest<=2?'#86efac':'#bae6fd'}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:r.diasRest<=2?'#16a34a':'#0891b2', lineHeight:1 }}>{new Date(r.fechaProxima+'T00:00:00').getDate()}</div>
                  <div style={{ fontSize:8, color:'var(--text3)', textTransform:'uppercase' }}>{MESES[new Date(r.fechaProxima+'T00:00:00').getMonth()].slice(0,3)}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.nombre}</div>
                  <div style={{ fontSize:10, color:dl.color, fontWeight:600 }}>{r.diasRest===0?'⚡ HOY':dl.txt}</div>
                </div>
                <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:15, color:'#16a34a', flexShrink:0 }}>{S0(r.montoProximo)}</div>
              </div>
            )
          })}
          {proximosIngresos.length>0&&(
            <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 10px', background:'var(--bg)', borderRadius:9, border:'1px solid var(--border)', marginTop:4 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)' }}>Total próximo período</span>
              <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#0891b2' }}>{S0(proximosIngresos.reduce((s,r)=>s+r.montoProximo,0))}</span>
            </div>
          )}
        </div>

        {/* Próxima quincena */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13 }}>🔮 Próxima quincena</div>
            <button onClick={()=>onNavigate('quincena_resumen')} style={{ fontSize:10, fontWeight:700, color:'#6c63ff', background:'none', border:'none' }}>Ver →</button>
          </div>

          {oblSig.length>0&&(
            <div style={{ padding:'8px 10px', borderRadius:10, marginBottom:10, background:totalOblSig<=proximosIngresos.reduce((s,r)=>s+r.montoProximo,0)?'#f0fdf4':'#fef2f2', border:`1.5px solid ${totalOblSig<=proximosIngresos.reduce((s,r)=>s+r.montoProximo,0)?'#86efac':'#fca5a5'}` }}>
              <div style={{ fontSize:11, fontWeight:600 }}>
                {totalOblSig<=proximosIngresos.reduce((s,r)=>s+r.montoProximo,0)?'✅ Ingreso cubre las obligaciones':'⚠️ El ingreso podría no alcanzar'}
              </div>
            </div>
          )}

          {oblSig.length===0 ? (
            <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:'var(--text3)' }}>✅ Sin obligaciones pendientes</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {oblSig.map(d=>(
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:9, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, padding:'9px 12px' }}>
                  <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:'#fef2f2', border:'1.5px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Nunito', fontWeight:900, fontSize:12, color:'#dc2626' }}>{d.dia_pago_mes}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.nombre}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{d.tipo?.replace(/_/g,' ')}</div>
                  </div>
                  <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, color:'#dc2626', flexShrink:0 }}>{S0(d.monto_cuota||d.monto_pendiente)}</div>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 10px', background:'#fef2f2', borderRadius:9, border:'1.5px solid #fecaca', marginTop:2 }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#991b1b' }}>Total</span>
                <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#dc2626' }}>{S0(totalOblSig)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ACCIONES RÁPIDAS (scroll horizontal en mobile) ══ */}
      <div className="chips">
        {[
          {l:'↑ Ingreso',  c:'#16a34a', a:()=>onRegistrar('ingreso')},
          {l:'↓ Gasto',    c:'#dc2626', a:()=>onRegistrar('gasto')},
          {l:'💳 Deudas',  c:'#7c3aed', a:()=>onNavigate('deudas')},
          {l:'📋 Presupuesto', c:'#6c63ff', a:()=>onNavigate('presupuesto')},
          {l:'📅 Quincena',c:'#0891b2', a:()=>onNavigate('quincena_resumen')},
          {l:'📈 Inversiones',c:'#16a34a',a:()=>onNavigate('inversiones')},
        ].map(a=>(
          <button key={a.l} onClick={a.a} style={{ padding:'8px 14px', borderRadius:9, border:`1.5px solid ${a.c}30`, background:`${a.c}08`, color:a.c, fontFamily:'Poppins', fontWeight:700, fontSize:11, flexShrink:0, whiteSpace:'nowrap' }}>{a.l}</button>
        ))}
      </div>

    </div>
  )
}
