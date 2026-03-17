import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_DEUDA_REC, proximaFechaPago, diasHastaPago } from '../lib/deudaRecurrenteUtils'

const S0 = n => `S/. ${Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`
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
  const [cobrandoPeriodo, setCobrandoPeriodo] = useState(null)
  const [montoCobro,  setMontoCobro]  = useState('')
  const [loadingCob,  setLoadingCob]  = useState(false)
  const [marcandoPago, setMarcandoPago] = useState(null)
  const [montoPago,    setMontoPago]    = useState('')
  const [loadingPago,  setLoadingPago]  = useState(false)
  const [verPagadas,   setVerPagadas]   = useState(false)

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
        supabase.from('pagos_deuda').select('*').eq('usuario_id',usuarioId).gte('fecha',desdeMes).lte('fecha',hastaMes),
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
      // ph tracks: dr_<id>_q1, dr_<id>_q2 for quincenal; dr_<id> for mensual; d_<id> for deudas
      const ph={}; (pR.data||[]).forEach(p=>{
        const fechaDia = p.fecha ? new Date(p.fecha+'T00:00:00').getDate() : 0
        const esQ1Pago = fechaDia <= 15
        if (p.deuda_recurrente_id) {
          const dr = (dRecR.data||[]).find(d=>d.id===p.deuda_recurrente_id)
          if (dr?.frecuencia==='quincenal') {
            ph[`dr_${p.deuda_recurrente_id}_${esQ1Pago?'q1':'q2'}`] = p
          } else {
            ph[`dr_${p.deuda_recurrente_id}`] = p
          }
        } else if (p.deuda_id && deudRecIds.has(p.deuda_id)) {
          const dr = (dRecR.data||[]).find(d=>d.id===p.deuda_id)
          if (dr?.frecuencia==='quincenal') {
            ph[`dr_${p.deuda_id}_${esQ1Pago?'q1':'q2'}`] = p
          } else {
            ph[`dr_${p.deuda_id}`] = p
          }
        }
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

  async function marcarPagoDeudaRecQuincena(deudaRec, monto, quincena) {
    const montoNum = Number(monto || 0)
    // Usar fecha en la quincena correcta del mes actual
    const diaFecha = quincena === 'q1' ? Math.min(deudaRec.dia_pago_1||15, 15) : Math.max(deudaRec.dia_pago_2||hoy.getDate(), 16)
    const m = String(mesAct).padStart(2,'0')
    const ultDia = new Date(anioAct, mesAct, 0).getDate()
    const dia = String(Math.min(diaFecha, quincena==='q1'?15:ultDia)).padStart(2,'0')
    const fecha = `${anioAct}-${m}-${dia}`
    const {error:txError} = await supabase.from('transacciones').insert({
      usuario_id:usuarioId, tipo:'gasto', monto:montoNum, fecha,
      categoria:'otro_gasto', descripcion:`Pago ${deudaRec.nombre} ${quincena==='q1'?'1ª quincena':'2ª quincena'}`,
    })
    if (txError) { console.error(txError); return }
    const { error } = await supabase.from('pagos_deuda').insert({
      usuario_id:usuarioId, deuda_recurrente_id:deudaRec.id, monto:montoNum, fecha,
    })
    if (error) { console.error(error); return }
    cargar()
  }

  async function anularPagoDeudaRec(pagoObj) {
    if (!pagoObj?.id) return
    // Eliminar transacción de gasto asociada (buscar por monto, fecha y descripción)
    const { data: txs } = await supabase.from('transacciones')
      .select('*').eq('usuario_id', usuarioId).eq('tipo', 'gasto')
      .eq('monto', pagoObj.monto).eq('fecha', pagoObj.fecha).ilike('descripcion', '%Pago%')
    if (txs?.length > 0) await supabase.from('transacciones').delete().eq('id', txs[0].id)
    // Eliminar el pago recurrente
    await supabase.from('pagos_deuda').delete().eq('id', pagoObj.id)
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
  // Para quincenales: verificar cada quincena del mes por separado
  const obligacionesRecPendientes = deudasRec.reduce((s,dr)=>{
    if (dr.frecuencia==='quincenal') {
      const q1Pag = !!pagosHechos[`dr_${dr.id}_q1`]
      const q2Pag = !!pagosHechos[`dr_${dr.id}_q2`]
      if (!q1Pag) s += Number(dr.monto_pago_1||dr.monto_total||0)
      if (!q2Pag) s += Number(dr.monto_pago_2||dr.monto_total||0)
    } else if (dr.frecuencia==='mensual') {
      if (!pagosHechos[`dr_${dr.id}`]) s += Number(dr.monto_total||0)
    }
    return s
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
      <div className="g2" style={{ gap:10 }}>
        {[1,2,3,4,5,6].map(i=>(
          <div key={i} className="skeleton" style={{ height:i<=2?100:160, gridColumn:i>4?'span 2':'span 1' }}/>
        ))}
      </div>
    </div>
  )

  return (
    <div className="page">

      {/* ══ SECCIÓN 1: SALDO ACTUAL ══ */}
      {(() => {
        const porCobrar  = recConEstado.filter(r=>!r.yaCobro).reduce((s,r)=>s+r.esperado, 0)
        const saldoMes   = kpiDisponible + porCobrar
        const saldoLibre = saldoMes - kpiGastos - totalObligacionesPeriodo
        const colorLibre = saldoLibre >= 0 ? '#16a34a' : '#dc2626'
        return (
          <>
            <Seccion titulo="💵 Saldo actual" colorBorde="#86efac" colorHeader="#22c55e">
              <div className="g2">

                <KpiCard titulo="💵 Saldo disponible" monto={S0(kpiDisponible)}
                  colorBg="linear-gradient(135deg,#f0fdf4,#dcfce7)" colorBorde="#86efac"
                  colorTitulo="#166534" colorMonto="#16a34a"
                  defaultOpen={true}
                  onNavigate={()=>onNavigate('cuentas')}>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {cuentas.filter(c => c.tipo !== 'credito_entidad' && c.es_dinero_inmediato !== false).map(c => {
                      const destino = c.tipo === 'efectivo' ? 'efectivo' : 'cuentas'
                      const emoji = c.tipo==='sueldo'?'💼':c.tipo==='ahorro_digital'?'🏦':c.tipo==='billetera_digital'?'📱':c.tipo==='corriente'?'🔄':c.tipo==='efectivo'?'💵':'🏦'
                      return (
                        <div key={c.id} style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#15803d' }}>
                          <span onClick={e=>{ e.stopPropagation(); onNavigate(destino) }}
                            style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110, cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted', textUnderlineOffset:'2px' }}>
                            {emoji} {c.nombre}
                          </span>
                          <span style={{ fontFamily:'Nunito', fontWeight:800, flexShrink:0 }}>{S0(c.saldo_actual||0)}</span>
                        </div>
                      )
                    })}
                    {!tienenCuentas && <div style={{ fontSize:9, color:'#15803d', opacity:0.7 }}>Cobrado - gastos del período</div>}
                  </div>
                </KpiCard>

                <KpiCard titulo="⚠️ Deudas" monto={S0(kpiDeudas)}
                  colorBg="linear-gradient(135deg,#fef2f2,#fee2e2)" colorBorde="#fca5a5"
                  colorTitulo="#991b1b" colorMonto="#dc2626"
                  defaultOpen={true}
                  onNavigate={()=>onNavigate('deudas')}>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {deudas.filter(d=>!pagosHechos[`d_${d.id}`]).map(d => (
                      <div key={d.id} style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#991b1b' }}>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>📋 {d.nombre}</span>
                        <span style={{ fontFamily:'Nunito', fontWeight:800, flexShrink:0 }}>{S0(d.monto_pendiente||d.monto_cuota||0)}</span>
                      </div>
                    ))}
                    {tarjetas.filter(t=>(t.tipo==='credito'||!t.tipo)&&Number(t.deuda_actual||0)>0).map(t => (
                      <div key={t.id}
                        onClick={e=>{ e.stopPropagation(); onNavigate('tarjetas', { abrirMovimiento: t }) }}
                        style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#991b1b', cursor:'pointer', padding:'2px 4px', borderRadius:4, transition:'background 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#fee2e2'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      >
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>💳 {t.nombre_banco}{t.numero?` ···${t.numero}`:''}</span>
                        <span style={{ fontFamily:'Nunito', fontWeight:800, flexShrink:0 }}>{S0(t.deuda_actual)}</span>
                      </div>
                    ))}
                    {kpiDeudas===0 && <div style={{ fontSize:9, color:'#16a34a', fontWeight:700, marginTop:4 }}>✅ Sin deudas pendientes</div>}
                  </div>
                </KpiCard>

              </div>
            </Seccion>

            {/* ══ SECCIÓN 2: FLUJO MENSUAL ══ */}
            <Seccion
              titulo="📅 Flujo mensual"
              subtitulo={`${MESES[hoy.getMonth()]} ${anioAct} · ${hoy.toLocaleDateString('es-PE',{weekday:'long', day:'numeric'})}`}
              colorBorde="#c4b5fd" colorHeader="#8b5cf6"
            >
              {/* Botón ver detalle */}
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
                <button onClick={()=>onNavigate('quincena_resumen')} style={{ fontSize:11, fontWeight:700, color:'#6c63ff', background:'#f5f3ff', border:'1.5px solid #c4b5fd', borderRadius:8, padding:'5px 12px' }}>
                  📊 Ver detalle
                </button>
              </div>

              {/* Tarjetas Saldo mes + Saldo libre */}
              <div className="g2" style={{ marginBottom:12 }}>

                <KpiCard titulo="💰 Saldo del mes" monto={S0(saldoMes)}
                  colorBg="linear-gradient(135deg,#eff6ff,#dbeafe)" colorBorde="#93c5fd"
                  colorTitulo="#1e40af" colorMonto="#2563eb"
                  onNavigate={()=>onNavigate('cuentas')}>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#1e40af' }}><span>💵 Disponible hoy</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>{S0(kpiDisponible)}</span></div>
                    {porCobrar>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#64748b' }}><span>⏳ Por cobrar</span><span style={{ fontFamily:'Nunito', fontWeight:800 }}>+{S0(porCobrar)}</span></div>}
                    {recConEstado.length>0 && (
                      <div style={{ borderTop:'1px dashed #93c5fd', paddingTop:4, marginTop:2, display:'flex', flexDirection:'column', gap:2 }}>
                        {recConEstado.map(r => (
                          <div key={r.id} style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:r.yaCobro?'#1e40af':'#94a3b8' }}>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110 }}>{r.yaCobro?'✅':'⏳'} {r.nombre}</span>
                            <span style={{ fontFamily:'Nunito', fontWeight:800, flexShrink:0 }}>{S0(r.yaCobro?r.cobrado:r.esperado)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </KpiCard>

                <KpiCard titulo="🏁 Saldo libre estimado" monto={S0(saldoLibre)}
                  colorBg={saldoLibre>=0?'linear-gradient(135deg,#f0fdf4,#dcfce7)':'linear-gradient(135deg,#fff1f2,#ffe4e6)'}
                  colorBorde={saldoLibre>=0?'#86efac':'#fca5a5'}
                  colorTitulo={saldoLibre>=0?'#166534':'#991b1b'} colorMonto={colorLibre}>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                    {[
                      { label:'💰 Saldo del mes', val:S0(saldoMes), prefix:'' },
                      { label:'💸 Gastos',         val:S0(kpiGastos), prefix:'-' },
                      { label:'💳 Obligaciones',   val:S0(totalObligacionesPeriodo), prefix:'-' },
                      ...(totalPres>0?[{ label:'📊 Presupuesto usado', val:Math.round((kpiGastos/totalPres)*100)+'%', prefix:'' }]:[]),
                    ].map((row,i,arr) => (
                      <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10,
                        color: saldoLibre>=0 ? '#166534' : '#991b1b',
                        paddingBottom: i<arr.length-1 ? 4 : 0,
                        borderBottom: i<arr.length-1 ? `1px dashed ${saldoLibre>=0?'#86efac':'#fca5a5'}` : 'none',
                      }}>
                        <span style={{ fontWeight:600, opacity:0.8 }}>{row.label}</span>
                        <span style={{ fontFamily:'Nunito', fontWeight:800 }}>{row.prefix}{row.val}</span>
                      </div>
                    ))}
                  </div>
                </KpiCard>
              </div>

              {/* Ingresos fijos + Pagos del mes */}
              <div className="g2" style={{ marginBottom:12 }}>

                {/* Ingresos fijos */}
                {(() => {
                  const cobroItems = rec.flatMap(r => {
                    const cQ1  = cobros.find(c=>c.ingreso_recurrente_id===r.id && c.periodo==='quincena_1')
                    const cQ2  = cobros.find(c=>c.ingreso_recurrente_id===r.id && c.periodo==='quincena_2')
                    const cMes = cobros.find(c=>c.ingreso_recurrente_id===r.id && c.periodo==='mes_completo')
                    if (r.frecuencia==='mensual') return [{ id:r.id+'_mes', r, cobrado:!!cMes, cobroObj:cMes||null, monto:Number(r.monto_total||0), label:r.nombre, periodo:'mes_completo', dia:r.dia_pago_1||30 }]
                    return [
                      { id:r.id+'_q1', r, cobrado:!!cQ1, cobroObj:cQ1||null, monto:Number(r.monto_pago_1||r.monto_total||0), label:`${r.nombre} · 1ª`, periodo:'quincena_1', dia:r.dia_pago_1||15 },
                      { id:r.id+'_q2', r, cobrado:!!cQ2, cobroObj:cQ2||null, monto:Number(r.monto_pago_2||r.monto_total||0), label:`${r.nombre} · 2ª`, periodo:'quincena_2', dia:r.dia_pago_2||30 },
                    ]
                  })
                  const pendCobros = cobroItems.filter(i=>!i.cobrado)
                  const pagCobros  = cobroItems.filter(i=>i.cobrado)
                  return (
                    <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                        <div style={{ fontSize:12, fontWeight:700 }}>💰 Ingresos fijos</div>
                        <button onClick={()=>onNavigate('flujo_caja')} style={{ fontSize:9, fontWeight:700, color:'var(--text3)', background:'none', border:'none', cursor:'pointer' }}>Ver →</button>
                      </div>
                      {cobroItems.length===0
                        ? <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'var(--text3)' }}>Sin ingresos configurados</div>
                        : <>
                            {pendCobros.length===0
                              ? <div style={{ textAlign:'center', padding:'10px 0', fontSize:12, color:'#16a34a', fontWeight:600 }}>✅ Todos cobrados</div>
                              : <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:pagCobros.length?8:0 }}>
                                  {pendCobros.map(item => {
                                    const dRest = diasHasta(`${anioAct}-${String(mesAct).padStart(2,'0')}-${String(Math.min(item.dia,new Date(anioAct,mesAct,0).getDate())).padStart(2,'0')}`)
                                    const urgente = dRest>=0 && dRest<=3
                                    return (
                                      <div key={item.id} style={{ borderRadius:8, border:`1.5px solid ${urgente?'#fdba74':'var(--border)'}`, background:urgente?'#fff7ed':'white' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px' }}>
                                          <div style={{ width:16, height:16, borderRadius:4, flexShrink:0, border:'1.5px solid #86efac', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                            <span style={{ fontSize:8, color:'#86efac' }}>○</span>
                                          </div>
                                          <div style={{ flex:1, minWidth:0 }}>
                                            <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</div>
                                            <div style={{ fontSize:9, color:'var(--text3)' }}>día {item.dia}{dRest>=0?` · ${dRest===0?'⚡hoy':dRest===1?'mañana':`en ${dRest}d`}`:''}</div>
                                          </div>
                                          <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:12, color:'#16a34a', flexShrink:0, marginRight:4 }}>{S0(item.monto)}</div>
                                          <button onClick={()=>{ setCobrandoRec(item.r); setMontoCobro(String(item.monto)); setCobrandoPeriodo(item.periodo) }}
                                            style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:6, border:'none', background:'#16a34a', color:'white', cursor:'pointer', whiteSpace:'nowrap' }}>
                                            Cobrar
                                          </button>
                                        </div>
                                        {cobrandoRec?.id===item.r.id && cobrandoPeriodo===item.periodo && (
                                          <div style={{ padding:'8px 10px', borderTop:'1px solid #86efac', background:'#f0fdf4', borderRadius:'0 0 7px 7px' }}>
                                            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6, alignItems:'center' }}>
                                              <div style={{ position:'relative' }}>
                                                <span style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', fontSize:11, fontWeight:700, color:'#16a34a' }}>S/.</span>
                                                <input type="number" value={montoCobro} onChange={e=>setMontoCobro(e.target.value)} autoFocus min="0" step="0.01"
                                                  style={{ width:'100%', padding:'6px 8px 6px 28px', border:'1.5px solid #86efac', borderRadius:7, fontSize:12, fontWeight:700, color:'#16a34a', fontFamily:'Poppins', outline:'none', boxSizing:'border-box', background:'white' }}/>
                                              </div>
                                              <div style={{ display:'flex', gap:5 }}>
                                                <button onClick={()=>confirmarCobro(item.r)} disabled={loadingCob} style={{ padding:'6px 10px', background:'#16a34a', color:'white', border:'none', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer' }}>{loadingCob?'...':'✅'}</button>
                                                <button onClick={()=>{ setCobrandoRec(null); setCobrandoPeriodo(null) }} style={{ padding:'6px 8px', background:'white', border:'1.5px solid var(--border)', borderRadius:7, fontSize:11, cursor:'pointer' }}>✕</button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                            }
                            {pagCobros.length>0 && (
                              <TogglePagados count={pagCobros.length}>
                                {pagCobros.map(item => (
                                  <div key={item.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', borderRadius:8, background:'#f0fdf4', border:'1px solid #86efac' }}>
                                    <span style={{ fontSize:10 }}>✅</span>
                                    <div style={{ flex:1, fontSize:11, fontWeight:600, color:'#166534', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</div>
                                    <div style={{ fontFamily:'Nunito', fontWeight:700, fontSize:11, color:'#16a34a', flexShrink:0 }}>{S0(item.monto)}</div>
                                    <button onClick={async()=>{ await supabase.from('cobros').delete().eq('id',item.cobroObj.id); if(item.cobroObj.transaccion_id) await supabase.from('transacciones').delete().eq('id',item.cobroObj.transaccion_id); cargar() }}
                                      style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:5, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', cursor:'pointer', flexShrink:0 }}>Anular</button>
                                  </div>
                                ))}
                              </TogglePagados>
                            )}
                          </>
                      }
                    </div>
                  )
                })()}

                {/* Pagos del mes */}
                <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>📅 Pagos del mes</div>
                    <button onClick={()=>onNavigate('flujo_caja')} style={{ fontSize:9, fontWeight:700, color:'var(--text3)', background:'none', border:'none', cursor:'pointer' }}>Ver →</button>
                  </div>
                  {(() => {
                    const items = []
                    deudasRec.forEach(dr => {
                      const tipoInfo = TIPOS_DEUDA_REC.find(t=>t.valor===dr.tipo)||{emoji:'💳',color:'#7c3aed'}
                      if (dr.frecuencia==='quincenal') {
                        const pQ1 = pagosHechos[`dr_${dr.id}_q1`], pQ2 = pagosHechos[`dr_${dr.id}_q2`]
                        items.push({ id:`${dr.id}_q1`, tipoInfo, pagado:!!pQ1, pagoObj:pQ1||null, monto:Number(dr.monto_pago_1||dr.monto_total||0), label:`${dr.nombre} · 1ª`, onPagar:()=>marcarPagoDeudaRecQuincena(dr,Number(dr.monto_pago_1||dr.monto_total||0),'q1') })
                        items.push({ id:`${dr.id}_q2`, tipoInfo, pagado:!!pQ2, pagoObj:pQ2||null, monto:Number(dr.monto_pago_2||dr.monto_total||0), label:`${dr.nombre} · 2ª`, onPagar:()=>marcarPagoDeudaRecQuincena(dr,Number(dr.monto_pago_2||dr.monto_total||0),'q2') })
                      } else {
                        const p = pagosHechos[`dr_${dr.id}`]
                        items.push({ id:`${dr.id}`, tipoInfo, pagado:!!p, pagoObj:p||null, monto:Number(dr.monto_total||0), label:dr.nombre, onPagar:()=>marcarPagoDeudaRec(dr,Number(dr.monto_total||0)) })
                      }
                    })
                    const pendientes = items.filter(i=>!i.pagado)
                    const pagados    = items.filter(i=>i.pagado)
                    if (items.length===0) return <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'var(--text3)' }}>Sin pagos configurados</div>
                    return (
                      <>
                        {pendientes.length===0
                          ? <div style={{ textAlign:'center', padding:'10px 0', fontSize:12, color:'#16a34a', fontWeight:600 }}>✅ Todo pagado</div>
                          : <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:pagados.length?8:0 }}>
                              {pendientes.map(({ id, tipoInfo, monto, label, onPagar }) => (
                                <div key={id} onClick={onPagar} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, background:'white', border:'1.5px solid var(--border)', cursor:'pointer' }}>
                                  <div style={{ width:16, height:16, borderRadius:4, flexShrink:0, border:'1.5px solid #fca5a5', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <span style={{ fontSize:8, color:'#fca5a5' }}>○</span>
                                  </div>
                                  <span style={{ fontSize:12, flexShrink:0 }}>{tipoInfo.emoji}</span>
                                  <div style={{ flex:1, fontSize:11, fontWeight:600, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
                                  <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:12, color:tipoInfo.color, flexShrink:0 }}>{S0(monto)}</div>
                                </div>
                              ))}
                            </div>
                        }
                        {pagados.length>0 && (
                          <TogglePagados count={pagados.length}>
                            {pagados.map(({ id, tipoInfo, monto, label, pagoObj }) => (
                              <div key={id} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', borderRadius:8, background:'#f0fdf4', border:'1px solid #86efac' }}>
                                <span style={{ fontSize:10 }}>✅</span>
                                <span style={{ fontSize:12, flexShrink:0 }}>{tipoInfo.emoji}</span>
                                <div style={{ flex:1, fontSize:11, fontWeight:600, color:'#166534', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
                                <div style={{ fontFamily:'Nunito', fontWeight:700, fontSize:11, color:'#16a34a', flexShrink:0 }}>{S0(monto)}</div>
                                <button onClick={()=>anularPagoDeudaRec(pagoObj)} style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:5, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', cursor:'pointer', flexShrink:0 }}>Anular</button>
                              </div>
                            ))}
                          </TogglePagados>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Movimientos del mes */}
              <div className="g2">
                <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>💰 Ingresos del mes</div>
                    <button onClick={()=>onRegistrar('ingreso')} style={{ fontSize:10, fontWeight:700, color:'white', background:'#16a34a', border:'none', borderRadius:7, padding:'4px 9px', cursor:'pointer' }}>+ Registrar</button>
                  </div>
                  {cobros.length===0
                    ? <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'var(--text3)' }}>Sin ingresos este mes.</div>
                    : <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:200, overflowY:'auto', paddingRight:4 }}>
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
                  }
                </div>
                <div style={{ background:'var(--bg)', borderRadius:12, padding:12, border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>💸 Gastos del mes</div>
                    <button onClick={()=>onRegistrar('gasto')} style={{ fontSize:10, fontWeight:700, color:'white', background:'#dc2626', border:'none', borderRadius:7, padding:'4px 9px', cursor:'pointer' }}>+ Registrar</button>
                  </div>
                  {txsGasto.length===0
                    ? <div style={{ textAlign:'center', padding:'14px 0', fontSize:12, color:'var(--text3)' }}>Sin gastos este mes.</div>
                    : <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:200, overflowY:'auto', paddingRight:4 }}>
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
                  }
                </div>
              </div>

            </Seccion>

            {/* ══ SECCIÓN 3: DEUDAS ══ */}
            <Seccion titulo="💳 Deudas" monto={S0(kpiDeudas)} colorMonto="#dc2626" colorBorde="#fca5a5" colorHeader="#ef4444">
              <div className="g2">

                <KpiCard titulo="📋 Préstamos activos" monto={S0(deudas.filter(d=>d.direccion!=='me_deben').reduce((s,d)=>s+Number(d.monto_pendiente||0),0))}
                  colorBg="#fef2f2" colorBorde="#fca5a5" colorTitulo="#991b1b" colorMonto="#ef4444"
                  onNavigate={()=>onNavigate('deudas')}>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {deudas.filter(d=>d.direccion!=='me_deben').length===0
                      ? <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', padding:'8px 0' }}>Sin deudas activas 🎉</div>
                      : deudas.filter(d=>d.direccion!=='me_deben').map(d => {
                          const pct = d.total_cuotas>0 ? Math.round((d.cuotas_pagadas/d.total_cuotas)*100) : null
                          return (
                            <div key={d.id} style={{ padding:'7px 9px', borderRadius:8, background:'white', border:'1px solid #fecaca' }}>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:pct!==null?3:0 }}>
                                <div style={{ fontSize:11, fontWeight:600, color:'#991b1b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{d.nombre}</div>
                                <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:11, color:'#ef4444', flexShrink:0 }}>{S0(d.monto_pendiente||d.monto_cuota||0)}</div>
                              </div>
                              {pct!==null && <div style={{ height:3, background:'#fee2e2', borderRadius:99, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:'#ef4444', borderRadius:99 }}/></div>}
                              {d.es_en_cuotas&&d.total_cuotas>0 && <div style={{ fontSize:9, color:'#991b1b', marginTop:2, opacity:0.7 }}>{d.cuotas_pagadas}/{d.total_cuotas} cuotas · {pct}%</div>}
                            </div>
                          )
                        })
                    }
                  </div>
                </KpiCard>

                <KpiCard titulo="💳 Tarjetas crédito" monto={S0(tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).reduce((s,t)=>s+Number(t.deuda_actual||0),0))}
                  colorBg="#fef2f2" colorBorde="#fca5a5" colorTitulo="#991b1b" colorMonto="#dc2626"
                  onNavigate={()=>onNavigate('tarjetas')}>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).length===0
                      ? <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', padding:'8px 0' }}>Sin tarjetas de crédito</div>
                      : tarjetas.filter(t=>t.tipo==='credito'||!t.tipo).map(t => {
                          const pct = t.limite_credito>0 ? Math.min(Math.round((t.deuda_actual/t.limite_credito)*100),100) : 0
                          const colorBarra = pct>=90?'#ef4444':pct>=70?'#f97316':'#22c55e'
                          const color = t.color||'#dc2626'
                          const diasCorte = t.fecha_corte ? diasHasta(t.fecha_corte) : null
                          return (
                            <div key={t.id}
                              onClick={()=>onNavigate('tarjetas', { abrirMovimiento: t })}
                              style={{ padding:'7px 9px', borderRadius:8, background:'white', border:`1px solid ${color}30`, cursor:'pointer', transition:'box-shadow 0.15s' }}
                              onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 2px 8px ${color}30`}
                              onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                            >
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:t.limite_credito>0?3:0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:5, flex:1, minWidth:0 }}>
                                  <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }}/>
                                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.nombre_banco}{t.numero?` ···${t.numero}`:''}</div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                                  <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:11, color:'#dc2626' }}>{S0(t.deuda_actual||0)}</div>
                                  <span style={{ fontSize:9, fontWeight:700, color:color, opacity:0.7 }}>Pagar →</span>
                                </div>
                              </div>
                              {t.limite_credito>0 && (
                                <>
                                  <div style={{ height:3, background:'var(--bg)', borderRadius:99, overflow:'hidden', marginBottom:2 }}><div style={{ height:'100%', width:`${pct}%`, background:colorBarra, borderRadius:99 }}/></div>
                                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text3)' }}>
                                    <span>{pct}% · límite {S0(t.limite_credito)}</span>
                                    {diasCorte!==null && <span style={{ color:diasCorte<=5?'#f97316':'var(--text3)', fontWeight:diasCorte<=5?700:400 }}>{diasCorte===0?'Corte hoy':diasCorte<0?'Cortó hace '+Math.abs(diasCorte)+'d':'Corte en '+diasCorte+'d'}</span>}
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })
                    }
                  </div>
                </KpiCard>

              </div>
            </Seccion>

          </>
        )
      })()}

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
function TogglePagados({ count, children }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button onClick={()=>setOpen(v=>!v)}
        style={{ width:'100%', padding:'5px 0', fontSize:10, fontWeight:700, color:'#16a34a', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:7, cursor:'pointer', marginBottom:open?6:0 }}>
        {open ? '▲ Ocultar' : `✅ Ver hechos (${count})`}
      </button>
      {open && <div style={{ display:'flex', flexDirection:'column', gap:4 }}>{children}</div>}
    </>
  )
}

// Sección colapsable con header clicable
function Seccion({ titulo, subtitulo, monto, colorMonto='var(--text)', colorBorde='var(--border)', colorHeader, defaultOpen=true, children }) {
  const [open, setOpen] = React.useState(defaultOpen)
  // Header usa el color de acento fuerte para máximo contraste
  const hdrBg     = colorHeader || colorBorde
  const hdrActivo = `${hdrBg}22`   // ~13% opacidad — tinte visible pero suave
  return (
    <div style={{ background:'white', borderRadius:16, border:`1.5px solid ${colorBorde}`, marginBottom:14, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', overflow:'hidden' }}>
      {/* Header siempre tintado con el color temático */}
      <div
        onClick={()=>setOpen(v=>!v)}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', cursor:'pointer', userSelect:'none',
          background: hdrActivo,
          borderBottom: open ? `1.5px solid ${colorBorde}` : 'none',
        }}
      >
        <div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, color:'var(--text)', lineHeight:1.2 }}>{titulo}</div>
          {subtitulo && <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginTop:2 }}>{subtitulo}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {monto!==undefined && <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:15, color:colorMonto }}>{monto}</span>}
          {/* Pill chevron con fondo del color temático */}
          <div style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'3px 9px 3px 7px', borderRadius:20,
            background: open ? colorBorde : `${colorBorde}40`,
            border:`1px solid ${colorBorde}`,
            transition:'background 0.2s',
          }}>
            <span style={{
              fontSize:10, lineHeight:1, display:'inline-block',
              color: open ? 'white' : 'var(--text2)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition:'transform 0.2s',
            }}>▾</span>
            <span style={{ fontSize:10, fontWeight:700, color: open ? 'white' : 'var(--text2)' }}>
              {open ? 'Cerrar' : 'Ver'}
            </span>
          </div>
        </div>
      </div>
      {open && <div style={{ padding:'14px 16px 16px', background:'white' }}>{children}</div>}
    </div>
  )
}

// Tarjeta colapsable: título + monto visible siempre, detalle con click; navegación con click en header
function KpiCard({ titulo, monto, colorBg, colorBorde, colorTitulo, colorMonto, onNavigate: nav, defaultOpen=false, children }) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div style={{ background:colorBg, border:`1.5px solid ${colorBorde}`, borderRadius:14, overflow:'hidden', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div onClick={()=>setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <span style={{ fontSize:10, fontWeight:800, color:colorTitulo, textTransform:'uppercase', letterSpacing:'0.6px', opacity:0.85 }}>{titulo}</span>
          <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:colorMonto, letterSpacing:'-0.5px', lineHeight:1 }}>{monto}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {nav && <button onClick={e=>{ e.stopPropagation(); nav() }} style={{ fontSize:9, fontWeight:700, padding:'3px 9px', borderRadius:20, border:`1.5px solid ${colorBorde}`, background:'rgba(255,255,255,0.7)', color:colorTitulo, cursor:'pointer', whiteSpace:'nowrap' }}>Ver →</button>}
          <div style={{ width:20, height:20, borderRadius:6, background:'rgba(255,255,255,0.5)', border:`1px solid ${colorBorde}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:10, color:colorTitulo, transform:open?'rotate(0deg)':'rotate(-90deg)', transition:'transform 0.2s', display:'inline-block', lineHeight:1 }}>▾</span>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ background:'rgba(255,255,255,0.55)', borderTop:`1.5px solid ${colorBorde}`, padding:'10px 14px 13px' }}>
          {children}
        </div>
      )}
    </div>
  )
}