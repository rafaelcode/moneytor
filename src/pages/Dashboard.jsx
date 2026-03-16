import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_DEUDA_REC, proximaFechaPago, diasHastaPago } from '../lib/deudaRecurrenteUtils'

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

function MiniDonut({ pct, color, size=52, stroke=8 }) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, fill=Math.min(pct||0,100)/100*circ
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

function BarChart({ ingreso, gasto, presupuesto }) {
  const bars = [
    { label:'Cobrado', v:ingreso, color:'#16a34a' },
    { label:'Gastado', v:gasto,   color:'#dc2626' },
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

export default function Dashboard({ usuarioId, onNavigate, onRegistrar }) {
  const hoy     = new Date()
  const diaHoy  = hoy.getDate()
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
  const [tarjetas,    setTarjetas]    = useState([])
  const [cuentas,     setCuentas]     = useState([])
  const [cobrandoRec, setCobrandoRec] = useState(null)
  const [montoCobro,  setMontoCobro]  = useState('')
  const [loadingCob,  setLoadingCob]  = useState(false)
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
    try {
      const [rR,cR,gR,dR,dRecR,pR,pmR,tR,ctR] = await Promise.all([
        supabase.from('ingresos_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
        supabase.from('cobros').select('*').eq('usuario_id',usuarioId).gte('fecha_cobro',desdeMes).lte('fecha_cobro',hastaMes),
        supabase.from('transacciones').select('*').eq('usuario_id',usuarioId).eq('tipo','gasto').gte('fecha',desdeMes).lte('fecha',hastaMes),
        supabase.from('deudas').select('*').eq('usuario_id',usuarioId).eq('estado','activa'),
        supabase.from('deudas_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
        supabase.from('pagos_deuda').select('*').eq('usuario_id',usuarioId),
        supabase.from('presupuesto_mes').select('*,presupuesto_mes_lineas(*)').eq('usuario_id',usuarioId).eq('mes',mesAct).eq('anio',anioAct).single(),
        supabase.from('tarjetas_credito').select('*').eq('usuario_id',usuarioId).eq('activa',true),
        supabase.from('cuentas').select('*').eq('usuario_id',usuarioId).eq('activa',true),
      ])
      setRec(rR.data||[])
      setCobros(cR.data||[])
      setTxsGasto(gR.data||[])
      setDeudas(dR.data||[])
      setDeudasRec(dRecR.data||[])
      const deudRecIds = new Set((dRecR.data||[]).map(d=>d.id))
      const ph={}; (pR.data||[]).forEach(p=>{
        if (p.deuda_recurrente_id) ph[`dr_${p.deuda_recurrente_id}`]=p
        else if (p.deuda_id && deudRecIds.has(p.deuda_id)) ph[`dr_${p.deuda_id}`]=p
        if (p.deuda_id) ph[`d_${p.deuda_id}`]=p
      })
      setPagosHechos(ph)
      setLineasPres(pmR.data?.presupuesto_mes_lineas||[])
      setTarjetas(tR.data||[])
      setCuentas(ctR.data||[])
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
    await supabase.from('pagos_deuda').insert({ deuda_id:deuda.id, usuario_id:usuarioId, monto:Number(montoPago), fecha })
    await supabase.from('transacciones').insert({ usuario_id:usuarioId, tipo:'gasto', monto:Number(montoPago), categoria:'otro_gasto', descripcion:`Pago ${deuda.nombre}`, fecha })
    await supabase.from('deudas').update({ monto_pendiente:Math.max(0,Number(deuda.monto_pendiente)-Number(montoPago)) }).eq('id',deuda.id)
    setMarcandoPago(null); setMontoPago(''); setLoadingPago(false); cargar()
  }

  async function marcarPagoDeudaPuntual(deuda) {
    const monto = Number(deuda.monto_pendiente || deuda.monto || deuda.monto_cuota || 0)
    const fecha = hoy.toISOString().split('T')[0]
    const {error:txError} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'gasto', monto, fecha,
      categoria:'otro_gasto', descripcion:`Pago ${deuda.nombre}`,
    })
    if (txError) { console.error(txError); return }
    const {error:pagoError} = await supabase.from('pagos_deuda').insert({ usuario_id:usuarioId, deuda_id:deuda.id, monto, fecha })
    if (pagoError) { console.error(pagoError); return }
    cargar()
  }

  async function marcarPagoDeudaRec(deudaRec, monto) {
    const montoNum = Number(monto || 0)
    const fecha = hoy.toISOString().split('T')[0]
    const {error:txError} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'gasto', monto:montoNum, fecha,
      categoria:'otro_gasto', descripcion:`Pago ${deudaRec.nombre}`,
    })
    if (txError) { console.error(txError); return }
    const { error } = await supabase.from('pagos_deuda').insert({
      usuario_id:usuarioId, deuda_recurrente_id:deudaRec.id, monto:montoNum, fecha,
    })
    if (error) { console.error(error); return }
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
    const {data:pagoData} = await supabase.from('pagos_deuda').select('*').eq('id', pagoId).single()
    if (pagoData) {
      const {data:txs} = await supabase.from('transacciones')
        .select('*').eq('usuario_id', usuarioId).eq('tipo', 'gasto')
        .eq('monto', pagoData.monto).eq('fecha', pagoData.fecha).ilike('descripcion', '%Pago%')
      if (txs?.length > 0) await supabase.from('transacciones').delete().eq('id', txs[0].id)
    }
    const {error} = await supabase.from('pagos_deuda').delete().eq('id', pagoId)
    if (error) console.error(error)
    else cargar()
  }

  async function pagarTarjeta(tarjeta, tipo) {
    const monto = tipo === 'total' ? Number(tarjeta.deuda_actual||0) : Number(tarjeta.monto_minimo||0)
    if (!monto) return
    const fecha = hoy.toISOString().split('T')[0]
    await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'gasto', monto, fecha,
      categoria:'otro_gasto', descripcion:`Pago tarjeta ${tarjeta.nombre_banco}`,
    })
    await supabase.from('tarjetas_credito').update({
      deuda_actual:  Math.max(0, Number(tarjeta.deuda_actual) - monto),
      saldo_actual:  Math.min(Number(tarjeta.limite_credito||0), Number(tarjeta.saldo_actual||0) + monto),
      actualizado_en: new Date().toISOString(),
    }).eq('id', tarjeta.id)
    cargar()
  }

  async function depositarEnCuenta(cuenta, monto, descripcion) {
    if (!monto) return
    const fecha = hoy.toISOString().split('T')[0]
    await supabase.from('movimientos_cuenta').insert({
      cuenta_id:cuenta.id, usuario_id:usuarioId, tipo:'deposito', monto:Number(monto), descripcion, fecha,
    })
    await supabase.from('cuentas').update({
      saldo_actual: Number(cuenta.saldo_actual) + Number(monto),
      actualizado_en: new Date().toISOString(),
    }).eq('id', cuenta.id)
    cargar()
  }

  async function marcarDepositado(r, quincena) {
    const pKey  = quincena==='q1'?'quincena_1':quincena==='q2'?'quincena_2':'mes_completo'
    const monto = quincena==='q1' ? Number(r.monto_pago_1||r.monto_total||0)
                : quincena==='q2' ? Number(r.monto_pago_2||r.monto_total||0)
                : Number(r.monto_total||0)
    const fecha = hoy.toISOString().split('T')[0]
    const desc  = `${r.nombre}${quincena==='q1'?' – 1ª quincena':quincena==='q2'?' – 2ª quincena':''}`
    const {data:tx} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'ingreso', monto, fecha,
      categoria:r.tipo==='sueldo'?'sueldo':'otro_ingreso', descripcion:desc,
    }).select().single()
    await supabase.from('cobros').insert({
      usuario_id:usuarioId, ingreso_recurrente_id:r.id,
      nombre:r.nombre, monto, moneda:r.moneda||'PEN',
      fecha_cobro:fecha, periodo:pKey, transaccion_id:tx?.id||null,
    })
    const cuentaSueldo = cuentas.find(c => c.tipo === 'sueldo')
    if (cuentaSueldo) {
      await supabase.from('movimientos_cuenta').insert({
        cuenta_id:cuentaSueldo.id, usuario_id:usuarioId, tipo:'quincena', monto, descripcion:desc, fecha,
      })
      await supabase.from('cuentas').update({
        saldo_actual: Number(cuentaSueldo.saldo_actual) + monto,
        actualizado_en: new Date().toISOString(),
      }).eq('id', cuentaSueldo.id)
    }
    cargar()
  }

  /* ── Cálculos ─────────────────────────────────────────── */
  const esQ1         = periodo==='q1'
  const pKey         = esQ1?'quincena_1':'quincena_2'
  const recPer       = rec.filter(r => r.frecuencia==='quincenal' || (r.frecuencia==='mensual'&&esQ1))
  const cobrosPer    = cobros.filter(c => c.periodo===pKey)
  const totalCobrado = cobrosPer.reduce((s,c)=>s+Number(c.monto),0)
  const totalEsperado= recPer.reduce((s,r)=>s+(esQ1?Number(r.monto_pago_1||r.monto_total):Number(r.monto_pago_2||r.monto_total)),0)
  const todosCobraron= recPer.length>0 && recPer.every(r=>cobrosPer.some(c=>c.ingreso_recurrente_id===r.id))
  const totalGastos  = txsGasto.reduce((s,t)=>s+Number(t.monto),0)
  const totalPres    = lineasPres.reduce((s,l)=>s+Number(l.monto_limite),0)/2
  const saldoReal    = totalCobrado - totalGastos

  const oblEsta      = deudas.filter(d=>d.dia_pago_mes&&(esQ1?d.dia_pago_mes<=15:d.dia_pago_mes>15))
  const oblSig       = deudas.filter(d=>d.dia_pago_mes&&(esQ1?d.dia_pago_mes>15:d.dia_pago_mes<=15))
  const totalOblEsta = oblEsta.reduce((s,d)=>s+Number(d.monto_cuota||0),0)
  const totalOblSig  = oblSig.reduce((s,d)=>s+Number(d.monto_cuota||0),0)

  const deudRecPer = deudasRec.filter(dr => dr.frecuencia==='quincenal' || (dr.frecuencia==='mensual'&&esQ1))
  const totalOblRecPer = deudRecPer.reduce((s,dr)=>{
    const m = (dr.frecuencia==='quincenal'&&esQ1)?dr.monto_pago_1||dr.monto_total
            : (dr.frecuencia==='quincenal'&&!esQ1)?dr.monto_pago_2||dr.monto_total
            : dr.monto_total
    return s+Number(m||0)
  },0)

  const deudasPendientes = deudas.reduce((s,d)=>{
    if (pagosHechos[`d_${d.id}`]) return s
    return s + Number(d.monto_pendiente||d.monto_cuota||0)
  },0)
  const obligacionesRecPendientes = deudRecPer.reduce((s,dr)=>{
    if (pagosHechos[`dr_${dr.id}`]) return s
    const m = (dr.frecuencia==='quincenal'&&esQ1)?dr.monto_pago_1||dr.monto_total
            : (dr.frecuencia==='quincenal'&&!esQ1)?dr.monto_pago_2||dr.monto_total
            : dr.monto_total
    return s+Number(m||0)
  },0)
  const totalObligacionesPeriodo = deudasPendientes + obligacionesRecPendientes
  const libre     = saldoReal - totalObligacionesPeriodo
  const alcanza   = totalCobrado >= totalOblEsta
  const pctGastos = totalCobrado>0 ? (totalGastos/totalCobrado)*100 : 0

  // ── KPIs ─────────────────────────────────────────────────
  const saldoCuentasInmediato = cuentas
    .filter(c => c.tipo !== 'credito_entidad' && c.es_dinero_inmediato !== false)
    .reduce((s,c) => s + Number(c.saldo_actual||0), 0)
  const saldoTarjetasDebito = tarjetas.filter(t=>t.tipo==='debito').reduce((s,t)=>s+Number(t.saldo_actual||0),0)
  const tienenCuentas = cuentas.filter(c=>c.tipo!=='credito_entidad').length > 0
  const kpiDisponible = tienenCuentas ? saldoCuentasInmediato+saldoTarjetasDebito : Math.max(0, totalCobrado-totalGastos)

  const cuentasSueldo    = cuentas.filter(c=>c.tipo==='sueldo'            && c.es_dinero_inmediato!==false)
  const cuentasAhorro    = cuentas.filter(c=>c.tipo==='ahorro_digital'    && c.es_dinero_inmediato!==false)
  const cuentasBilletera = cuentas.filter(c=>c.tipo==='billetera_digital' && c.es_dinero_inmediato!==false)
  const cuentasCorriente = cuentas.filter(c=>c.tipo==='corriente'         && c.es_dinero_inmediato!==false)
  const cuentasEfectivo  = cuentas.filter(c=>c.tipo==='efectivo'          && c.es_dinero_inmediato!==false)

  const kpiDeudas = deudas.reduce((s,d)=>s+Number(d.monto_pendiente||0),0)
    + tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).reduce((s,t)=>s+Number(t.deuda_actual||0),0)

  const kpiIngresos = cobros
    .filter(c => { const f=new Date(c.fecha_cobro+'T00:00:00'); return f.getFullYear()===anioAct && f.getMonth()+1===mesAct })
    .reduce((s,c)=>s+Number(c.monto||0),0)

  const cobrosDelMes = cobros.filter(c=>{ const f=new Date(c.fecha_cobro+'T00:00:00'); return f.getFullYear()===anioAct && f.getMonth()+1===mesAct })
  const recConEstado = rec.map(r => {
    const cobrado = cobrosDelMes.filter(c=>c.ingreso_recurrente_id===r.id)
    const montoCobrado = cobrado.reduce((s,c)=>s+Number(c.monto||0),0)
    const esperado = r.frecuencia==='mensual' ? Number(r.monto_total||0) : Number(r.monto_pago_1||0)+Number(r.monto_pago_2||0)
    return { ...r, cobrado:montoCobrado, esperado, yaCobro:cobrado.length>0 }
  })

  const kpiGastos = totalGastos

  const proximosIngresos = rec.map(r => {
    const dia   = esQ1?(r.dia_pago_2||30):(r.dia_pago_1||15)
    const diaStr= String(Math.min(dia,new Date(anioAct,mesAct,0).getDate())).padStart(2,'0')
    const fecha = `${anioAct}-${String(mesAct).padStart(2,'0')}-${diaStr}`
    const d     = diasHasta(fecha)
    const monto = esQ1?Number(r.monto_pago_2||r.monto_total):Number(r.monto_pago_1||r.monto_total)
    return { ...r, fechaProxima:fecha, diasRest:d, montoProximo:monto }
  }).filter(r=>r.diasRest>=0).sort((a,b)=>a.diasRest-b.diasRest)

  if (cargando) return (
    <div className="page">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[1,2,3,4,5,6].map(i=>(
          <div key={i} className="skeleton" style={{ height:i<=2?100:160, gridColumn:i>4?'span 2':'span 1' }}/>
        ))}
      </div>
    </div>
  )

  return (
    <div className="page">

      {/* ══ HEADER ══ */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:2 }}>{anioAct}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
              <button disabled style={{ width:26, height:26, borderRadius:8, border:'1.5px solid #c4b5fd', background:'#f5f3ff', color:'#8b5cf6', fontSize:14, fontWeight:900, cursor:'not-allowed', opacity:0.45, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Poppins', flexShrink:0 }}>‹</button>
              <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:32, letterSpacing:'-1px', background:'linear-gradient(135deg,#6c63ff,#8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', textTransform:'capitalize', lineHeight:1 }}>
                {MESES[hoy.getMonth()]}
              </span>
              <button disabled style={{ width:26, height:26, borderRadius:8, border:'1.5px solid #c4b5fd', background:'#f5f3ff', color:'#8b5cf6', fontSize:14, fontWeight:900, cursor:'not-allowed', opacity:0.45, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Poppins', flexShrink:0 }}>›</button>
            </div>
            <div style={{ fontSize:13, color:'var(--text3)', fontWeight:600, textTransform:'capitalize' }}>
              {hoy.toLocaleDateString('es-PE',{weekday:'long', day:'numeric'})}
            </div>
          </div>
          <button onClick={()=>onNavigate('quincena_resumen')} style={{ fontSize:11, fontWeight:700, color:'#6c63ff', background:'#f5f3ff', border:'1.5px solid #c4b5fd', borderRadius:8, padding:'6px 12px' }}>
            📊 Ver detalle
          </button>
        </div>
      </div>

      {/* ══ KPIs ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>

        {/* 1. Saldo disponible */}
        <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #86efac', borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#166534', textTransform:'uppercase', marginBottom:6, letterSpacing:'0.5px' }}>💵 Saldo disponible</div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:'#16a34a', marginBottom:6, letterSpacing:'-0.5px' }}>{S0(kpiDisponible)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {cuentasSueldo.length>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#15803d' }}><span>💼 Sueldo</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(cuentasSueldo.reduce((s,c)=>s+Number(c.saldo_actual||0),0))}</span></div>}
            {cuentasAhorro.length>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#15803d' }}><span>🏦 Ahorro</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(cuentasAhorro.reduce((s,c)=>s+Number(c.saldo_actual||0),0))}</span></div>}
            {cuentasBilletera.length>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#15803d' }}><span>📱 Billeteras</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(cuentasBilletera.reduce((s,c)=>s+Number(c.saldo_actual||0),0))}</span></div>}
            {cuentasCorriente.length>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#15803d' }}><span>🔄 Corriente</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(cuentasCorriente.reduce((s,c)=>s+Number(c.saldo_actual||0),0))}</span></div>}
            {cuentasEfectivo.length>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#15803d' }}><span>💵 Efectivo</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(cuentasEfectivo.reduce((s,c)=>s+Number(c.saldo_actual||0),0))}</span></div>}
            {saldoTarjetasDebito>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#15803d' }}><span>💳 Débito</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(saldoTarjetasDebito)}</span></div>}
            {!tienenCuentas && <div style={{ fontSize:9, color:'#15803d', opacity:0.7 }}>Cobrado - gastos del período</div>}
          </div>
        </div>

        {/* 2. Deudas */}
        <div style={{ background:'linear-gradient(135deg,#fef2f2,#fee2e2)', border:'1.5px solid #fca5a5', borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#991b1b', textTransform:'uppercase', marginBottom:6, letterSpacing:'0.5px' }}>⚠️ Deudas</div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:'#dc2626', marginBottom:6, letterSpacing:'-0.5px' }}>{S0(kpiDeudas)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {deudas.length>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#991b1b' }}><span>📋 Préstamos / cuotas</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(deudas.reduce((s,d)=>s+Number(d.monto_pendiente||0),0))}</span></div>}
            {tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).length>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#991b1b' }}><span>💳 Tarjetas crédito</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).reduce((s,t)=>s+Number(t.deuda_actual||0),0))}</span></div>}
            {kpiDeudas===0 && <div style={{ fontSize:9, color:'#16a34a', fontWeight:700 }}>✅ Sin deudas pendientes</div>}
          </div>
        </div>

        {/* 3. Ingresos cobrados */}
        <div onClick={()=>onNavigate('cuentas')} style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1.5px solid #93c5fd', borderRadius:14, padding:'14px', cursor:'pointer', transition:'box-shadow 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(37,99,235,0.18)'}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#1e40af', textTransform:'uppercase', letterSpacing:'0.5px' }}>💰 Ingresos cobrados</div>
            <span style={{ fontSize:9, color:'#3b82f6', fontWeight:700 }}>Ver →</span>
          </div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:'#2563eb', marginBottom:6, letterSpacing:'-0.5px' }}>{S0(kpiIngresos)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {recConEstado.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:9, color:'#1e40af' }}>
                <span style={{ display:'flex', alignItems:'center', gap:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:85 }}>
                  <span>{r.yaCobro?'✅':'⏳'}</span><span>{r.nombre}</span>
                </span>
                <span style={{ fontFamily:'Nunito', fontWeight:800, flexShrink:0, color:r.yaCobro?'#2563eb':'#94a3b8' }}>
                  {r.yaCobro?S0(r.cobrado):S0(r.esperado)}
                </span>
              </div>
            ))}
            {rec.length===0 && <div style={{ fontSize:9, color:'#1e40af', opacity:0.7 }}>Sin ingresos registrados</div>}
          </div>
        </div>

        {/* 4. Gastos */}
        <div style={{ background:'linear-gradient(135deg,#fff7ed,#ffedd5)', border:'1.5px solid #fdba74', borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#9a3412', textTransform:'uppercase', marginBottom:6, letterSpacing:'0.5px' }}>💸 Gastos</div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:'#ea580c', marginBottom:6, letterSpacing:'-0.5px' }}>{S0(kpiGastos)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#9a3412' }}><span>📊 Del presupuesto</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{totalPres>0?`${Math.round((kpiGastos/totalPres)*100)}%`:'—'}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#9a3412' }}><span>📝 Transacciones</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{txsGasto.length}</span></div>
            {kpiIngresos>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#9a3412' }}><span>📉 % del ingreso</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{Math.round((kpiGastos/kpiIngresos)*100)}%</span></div>}
          </div>
        </div>

      </div>

      <div style={{ display:'grid', gap:14, marginBottom:16 }}>
        <div style={{ display:'grid', gap:14 }}>

          {/* ══ FLUJO DE CAJA ══ */}
          <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, marginBottom:12, color:'#16a34a' }}>💧 Flujo de caja</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:12 }}>

              {/* Ingresos por cobrar */}
              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>💰 Ingresos por cobrar</div>
                  {cuentas.find(c=>c.tipo==='sueldo') && (
                    <div style={{ fontSize:9, color:'#0891b2', fontWeight:600, background:'#ecfeff', padding:'2px 7px', borderRadius:20, border:'1px solid #a5f3fc' }}>
                      💼 {cuentas.find(c=>c.tipo==='sueldo').nombre}
                    </div>
                  )}
                </div>
                {rec.length===0 ? (
                  <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'var(--text3)' }}>Sin ingresos configurados.</div>
                ) : (() => {
                  const pendientes = rec.flatMap(r => {
                    const cQ1  = cobros.find(c=>c.ingreso_recurrente_id===r.id && c.periodo==='quincena_1')
                    const cQ2  = cobros.find(c=>c.ingreso_recurrente_id===r.id && c.periodo==='quincena_2')
                    const cMes = cobros.find(c=>c.ingreso_recurrente_id===r.id && c.periodo==='mes_completo')
                    if (r.frecuencia==='mensual') {
                      if (cMes) return []
                      return [{ key:r.id+'_mes', r, quincena:'mes', label:'Pago mensual', dia:r.dia_pago_1||r.dia_pago_2||30, monto:Number(r.monto_total||0) }]
                    }
                    const items=[]
                    if (!cQ1) items.push({ key:r.id+'_q1', r, quincena:'q1', label:'1ª quincena · 1–15', dia:r.dia_pago_1||15, monto:Number(r.monto_pago_1||r.monto_total||0) })
                    if (!cQ2) items.push({ key:r.id+'_q2', r, quincena:'q2', label:'2ª quincena · 16–31', dia:r.dia_pago_2||30, monto:Number(r.monto_pago_2||r.monto_total||0) })
                    return items
                  })
                  if (pendientes.length===0) return (
                    <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'#16a34a', fontWeight:600 }}>✅ Todos los ingresos depositados este mes</div>
                  )
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {pendientes.map(({ key, r, quincena, label, dia, monto }) => {
                        const fechaDia = `${anioAct}-${String(mesAct).padStart(2,'0')}-${String(Math.min(dia,new Date(anioAct,mesAct,0).getDate())).padStart(2,'0')}`
                        const dRest   = diasHasta(fechaDia)
                        const urgente = dRest>=0 && dRest<=3
                        const cuentaSueldo = cuentas.find(c=>c.tipo==='sueldo')
                        return (
                          <div key={key} style={{ background:urgente?'#fff7ed':'white', borderRadius:10, border:`1.5px solid ${urgente?'#fdba74':'var(--border)'}`, padding:'10px 12px' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:700, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.nombre}</div>
                                <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
                                  {label} · día {dia}
                                  {dRest>=0 && <span style={{ marginLeft:6, color:urgente?'#ea580c':'#0891b2', fontWeight:700 }}>{dRest===0?'⚡ hoy':dRest===1?'mañana':`en ${dRest}d`}</span>}
                                </div>
                              </div>
                              <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, color:'var(--text)', flexShrink:0 }}>{S0(monto)}</div>
                            </div>
                            <button onClick={()=>marcarDepositado(r, quincena)} style={{ width:'100%', padding:'6px 0', borderRadius:8, border:'none', background:urgente?'#ea580c':'#0891b2', color:'white', fontFamily:'Poppins', fontWeight:700, fontSize:11, cursor:'pointer', boxShadow:`0 2px 6px ${urgente?'#ea580c':'#0891b2'}30` }}>
                              💰 Marcar depositado{cuentaSueldo?` → ${cuentaSueldo.nombre}`:''}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* Pagos mensuales pendientes */}
              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>📅 Pagos mensuales</div>
                  <button onClick={()=>onNavigate('flujo_caja')} style={{ fontSize:10, fontWeight:700, color:'var(--text3)', background:'none', border:'none', cursor:'pointer' }}>Ver todos →</button>
                </div>
                {deudRecPer.filter(dr=>!pagosHechos[`dr_${dr.id}`]).length===0 ? (
                  <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'#16a34a', fontWeight:600 }}>✅ Todos pagados este período</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    {deudRecPer.filter(dr=>!pagosHechos[`dr_${dr.id}`]).map(dr=>{
                      const monto = (dr.frecuencia==='quincenal'&&esQ1)?Number(dr.monto_pago_1||dr.monto_total||0)
                                  : (dr.frecuencia==='quincenal'&&!esQ1)?Number(dr.monto_pago_2||dr.monto_total||0)
                                  : Number(dr.monto_total||0)
                      const tipoInfo = TIPOS_DEUDA_REC.find(t=>t.valor===dr.tipo)||{emoji:'💳',color:'#7c3aed'}
                      return (
                        <div key={dr.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background:'white', border:'1.5px solid var(--border)', cursor:'pointer' }}
                          onClick={()=>marcarPagoDeudaRec(dr, monto)}>
                          <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, border:'1.5px solid #d1d5db', background:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9 }}>
                            <span style={{color:'#d1d5db'}}>○</span>
                          </div>
                          <span style={{ fontSize:14, flexShrink:0 }}>{tipoInfo.emoji}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)' }}>{dr.nombre||'Sin nombre'}</div>
                            {dr.dia_pago_mes && <div style={{ fontSize:10, color:'var(--text3)' }}>Día {dr.dia_pago_mes} del mes</div>}
                          </div>
                          <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13, color:tipoInfo.color, flexShrink:0 }}>{S0(monto)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ══ OBLIGACIONES ══ */}
          <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, color:'#ef4444' }}>⚠️ Obligaciones</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>onNavigate('deudas')}   style={{ fontSize:10, fontWeight:700, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>Deudas →</button>
                <button onClick={()=>onNavigate('tarjetas')} style={{ fontSize:10, fontWeight:700, color:'#dc2626', background:'none', border:'none', cursor:'pointer' }}>Tarjetas →</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

              {/* Deudas actuales */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>📋 Deudas actuales</span>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--text3)' }}>{S0(deudas.filter(d=>d.direccion!=='me_deben').reduce((s,d)=>s+Number(d.monto_pendiente||0),0))}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {deudas.filter(d=>d.direccion!=='me_deben').length===0 ? (
                    <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', padding:'12px 0' }}>Sin deudas activas 🎉</div>
                  ) : deudas.filter(d=>d.direccion!=='me_deben').map(d => {
                    const pagado = !!pagosHechos[`d_${d.id}`]
                    const pct = d.total_cuotas>0 ? Math.round((d.cuotas_pagadas/d.total_cuotas)*100) : null
                    return (
                      <div key={d.id} style={{ padding:'8px 10px', borderRadius:9, background:pagado?'#f0fdf4':'white', border:`1.5px solid ${pagado?'#86efac':'var(--border)'}` }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:pct!==null?5:0 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                            {pagado && <span style={{marginRight:4}}>✅</span>}{d.nombre}
                          </div>
                          <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:12, color:pagado?'#16a34a':'#ef4444', flexShrink:0 }}>{S0(d.monto_pendiente||d.monto_cuota||0)}</div>
                        </div>
                        {pct!==null && <div style={{ height:4, background:'var(--bg)', borderRadius:99, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:pct>=100?'#16a34a':'#ef4444', borderRadius:99 }}/></div>}
                        {d.es_en_cuotas && d.total_cuotas>0 && <div style={{ fontSize:9, color:'var(--text3)', marginTop:3 }}>{d.cuotas_pagadas}/{d.total_cuotas} cuotas · {pct}%</div>}
                      </div>
                    )
                  })}
                  <button onClick={()=>onNavigate('deudas')} style={{ marginTop:4, width:'100%', padding:'5px 0', fontSize:10, fontWeight:700, color:'#ef4444', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, cursor:'pointer' }}>Ver todas →</button>
                </div>
              </div>

              {/* Tarjetas de crédito — CAMBIO: botón "Pagar →" por tarjeta */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>💳 Tarjetas crédito</span>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--text3)' }}>{S0(tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).reduce((s,t)=>s+Number(t.deuda_actual||0),0))}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).length===0 ? (
                    <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', padding:'12px 0' }}>Sin tarjetas de crédito</div>
                  ) : tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).map(t => {
                    const pct = t.limite_credito>0 ? Math.min(Math.round((t.deuda_actual/t.limite_credito)*100),100) : 0
                    const colorBarra = pct>=90?'#ef4444':pct>=70?'#f97316':'#22c55e'
                    const color = t.color||'#dc2626'
                    const diasCorte = t.fecha_corte ? diasHasta(t.fecha_corte) : null
                    return (
                      <div key={t.id} style={{ padding:'8px 10px', borderRadius:9, background:'white', border:`1.5px solid ${color}25` }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:5 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, flex:1, minWidth:0 }}>
                            <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }}/>
                            <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.nombre_banco} ···{t.numero}</div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:12, color:'#dc2626', flexShrink:0 }}>{S0(t.deuda_actual||0)}</div>
                            {Number(t.deuda_actual||0)>0 && (
                              <button onClick={()=>onNavigate('tarjetas')} style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20, border:'1.5px solid #dc2626', background:'#fef2f2', color:'#dc2626', cursor:'pointer', whiteSpace:'nowrap' }}>
                                Pagar →
                              </button>
                            )}
                          </div>
                        </div>
                        {t.limite_credito>0 && (
                          <>
                            <div style={{ height:4, background:'var(--bg)', borderRadius:99, overflow:'hidden', marginBottom:3 }}>
                              <div style={{ height:'100%', width:`${pct}%`, background:colorBarra, borderRadius:99, transition:'width 0.5s' }}/>
                            </div>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text3)' }}>
                              <span>{pct}% usado · límite {S0(t.limite_credito)}</span>
                              {diasCorte!==null && <span style={{ color:diasCorte<=5?'#f97316':'var(--text3)', fontWeight:diasCorte<=5?700:400 }}>{diasCorte===0?'Corte hoy':diasCorte<0?'Cortó hace '+Math.abs(diasCorte)+'d':'Corte en '+diasCorte+'d'}</span>}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                  <button onClick={()=>onNavigate('tarjetas')} style={{ marginTop:4, width:'100%', padding:'5px 0', fontSize:10, fontWeight:700, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, cursor:'pointer' }}>Ver todas →</button>
                </div>
              </div>

            </div>
          </div>

          {/* ══ MOVIMIENTOS ══ */}
          <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, marginBottom:12, color:'#6c63ff' }}>📌 Movimientos del mes</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>💰 Ingresos del mes</div>
                  <button onClick={()=>onRegistrar('ingreso')} style={{ fontSize:10, fontWeight:700, color:'white', background:'#16a34a', border:'none', borderRadius:7, padding:'4px 9px', cursor:'pointer' }}>+ Registrar</button>
                </div>
                {cobros.length===0 ? (
                  <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'var(--text3)' }}>Sin ingresos este mes.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:200, overflowY:'auto', paddingRight:4 }}>
                    {cobros.map(c=>(
                      <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'var(--text2)', gap:8 }}>
                        <div style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nombre||c.descripcion||'Ingreso'}</div>
                        <div style={{ fontWeight:700, color:'#16a34a', flexShrink:0 }}>{S0(c.monto)}</div>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:'#f0fdf4', borderRadius:7, border:'1px solid #86efac', marginTop:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#166534' }}>Total</span>
                      <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#16a34a' }}>{S0(cobros.reduce((s,c)=>s+Number(c.monto),0))}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>💸 Gastos del mes</div>
                  <button onClick={()=>onRegistrar('gasto')} style={{ fontSize:10, fontWeight:700, color:'white', background:'#dc2626', border:'none', borderRadius:7, padding:'4px 9px', cursor:'pointer' }}>+ Registrar</button>
                </div>
                {txsGasto.length===0 ? (
                  <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'var(--text3)' }}>Sin gastos este mes.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:200, overflowY:'auto', paddingRight:4 }}>
                    {txsGasto.map(t=>(
                      <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'var(--text2)', gap:8 }}>
                        <div style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.descripcion||t.categoria||'Gasto'}</div>
                        <div style={{ fontWeight:700, color:'#dc2626', flexShrink:0 }}>{S0(t.monto)}</div>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:'#fef2f2', borderRadius:7, border:'1px solid #fca5a5', marginTop:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#991b1b' }}>Total</span>
                      <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#dc2626' }}>{S0(txsGasto.reduce((s,t)=>s+Number(t.monto),0))}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ══ ACCIONES RÁPIDAS ══ */}
      <div className="chips">
        {[
          {l:'↑ Ingreso',      c:'#16a34a', a:()=>onRegistrar('ingreso')},
          {l:'↓ Gasto',        c:'#dc2626', a:()=>onRegistrar('gasto')},
          {l:'💳 Deudas',      c:'#7c3aed', a:()=>onNavigate('deudas')},
          {l:'📋 Presupuesto', c:'#6c63ff', a:()=>onNavigate('presupuesto')},
          {l:'📅 Quincena',    c:'#0891b2', a:()=>onNavigate('quincena_resumen')},
          {l:'📈 Inversiones', c:'#16a34a', a:()=>onNavigate('inversiones')},
        ].map(a=>(
          <button key={a.l} onClick={a.a} style={{ padding:'8px 14px', borderRadius:9, border:`1.5px solid ${a.c}30`, background:`${a.c}08`, color:a.c, fontFamily:'Poppins', fontWeight:700, fontSize:11, flexShrink:0, whiteSpace:'nowrap' }}>{a.l}</button>
        ))}
      </div>

    </div>
  )
}