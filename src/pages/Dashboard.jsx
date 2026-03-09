import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
  const [pagosHechos, setPagosHechos] = useState({})
  const [lineasPres,  setLineasPres]  = useState([])

  // UI cobro
  const [cobrandoRec, setCobrandoRec] = useState(null)
  const [montoCobro,  setMontoCobro]  = useState('')
  const [loadingCob,  setLoadingCob]  = useState(false)

  // UI pago
  const [marcandoPago, setMarcandoPago] = useState(null)
  const [montoPago,    setMontoPago]    = useState('')
  const [tipoPago,     setTipoPago]     = useState('efectivo')
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

    const [rR,cR,gR,dR,pR,pmR] = await Promise.all([
      supabase.from('ingresos_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
      supabase.from('cobros').select('*').eq('usuario_id',usuarioId).gte('fecha_cobro',desdeMes).lte('fecha_cobro',hastaMes),
      supabase.from('transacciones').select('*').eq('usuario_id',usuarioId).eq('tipo','gasto').gte('fecha',desdePer).lte('fecha',hastaPer),
      supabase.from('deudas').select('*').eq('usuario_id',usuarioId).eq('estado','activa'),
      supabase.from('pagos_deuda').select('*').eq('usuario_id',usuarioId).gte('fecha_pago',desdeMes).lte('fecha_pago',hastaMes),
      supabase.from('presupuesto_mes').select('*,presupuesto_mes_lineas(*)').eq('usuario_id',usuarioId).eq('mes',mesAct).eq('anio',anioAct).single(),
    ])
    setRec(rR.data||[])
    setCobros(cR.data||[])
    setTxsGasto(gR.data||[])
    setDeudas(dR.data||[])
    const ph={}; (pR.data||[]).forEach(p=>{ ph[p.deuda_id]=p }); setPagosHechos(ph)
    setLineasPres(pmR.data?.presupuesto_mes_lineas||[])
    setCargando(false)
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
    await supabase.from('pagos_deuda').insert({ deuda_id:deuda.id, usuario_id:usuarioId, monto:Number(montoPago), fecha_pago:fecha, tipo_pago:tipoPago })
    if (tipoPago!=='tarjeta_credito') {
      await supabase.from('transacciones').insert({ usuario_id:usuarioId, tipo:'gasto', monto:Number(montoPago), categoria:'otro_gasto', descripcion:`Pago ${deuda.nombre}`, fecha })
    }
    await supabase.from('deudas').update({ monto_pendiente:Math.max(0,Number(deuda.monto_pendiente)-Number(montoPago)) }).eq('id',deuda.id)
    setMarcandoPago(null); setMontoPago(''); setTipoPago('efectivo'); setLoadingPago(false); cargar()
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

  const oblEsta      = deudas.filter(d=>d.dia_pago_mes&&(esQ1?d.dia_pago_mes<=15:d.dia_pago_mes>15))
  const oblSig       = deudas.filter(d=>d.dia_pago_mes&&(esQ1?d.dia_pago_mes>15:d.dia_pago_mes<=15))
  const totalOblEsta = oblEsta.reduce((s,d)=>s+Number(d.monto_cuota||0),0)
  const totalOblSig  = oblSig.reduce((s,d)=>s+Number(d.monto_cuota||0),0)
  const pagosEfect   = oblEsta.filter(d=>pagosHechos[d.id]&&pagosHechos[d.id].tipo_pago!=='tarjeta_credito').reduce((s,d)=>s+Number(pagosHechos[d.id].monto),0)
  const pagosTC      = oblEsta.filter(d=>pagosHechos[d.id]?.tipo_pago==='tarjeta_credito').reduce((s,d)=>s+Number(pagosHechos[d.id].monto),0)
  const libre        = totalCobrado - totalGastos - pagosEfect
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
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
              {hoy.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})}
            </div>
          </div>
          <button onClick={()=>onNavigate('quincena_resumen')} style={{ fontSize:11, fontWeight:700, color:'#6c63ff', background:'#f5f3ff', border:'1.5px solid #c4b5fd', borderRadius:8, padding:'6px 12px' }}>
            📊 Ver detalle
          </button>
        </div>

        {/* Selector período — scroll horizontal en mobile */}
        <div style={{ display:'flex', background:'var(--bg)', borderRadius:12, border:'1.5px solid var(--border)', overflow:'hidden', alignSelf:'flex-start' }}>
          {[{v:'q1',l:'🌓 1ª quincena'},{v:'q2',l:'🌕 2ª quincena'}].map(p=>(
            <div key={p.v} onClick={()=>setPeriodo(p.v)} style={{ flex:1, padding:'9px 16px', cursor:'pointer', fontSize:12, fontWeight:700, textAlign:'center', background:periodo===p.v?'#6c63ff':'transparent', color:periodo===p.v?'white':'var(--text2)', transition:'all 0.13s', whiteSpace:'nowrap' }}>
              {p.l}
              {periodo===p.v && diaHoy<=(p.v==='q1'?15:31) && diaHoy>(p.v==='q1'?0:15) && (
                <span style={{ marginLeft:5, fontSize:9, background:'#ffffff30', padding:'1px 5px', borderRadius:20 }}>HOY</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ══ BANNER COBRAR ════════════════════════════════════ */}
      {recPer.length>0 && !todosCobraron && (
        <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'2px solid #fbbf24', borderRadius:14, padding:'13px 16px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:24 }}>💰</span>
            <div>
              <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, color:'#92400e' }}>¿Ya cobraste tu {esQ1?'primera':'segunda'} quincena?</div>
              <div style={{ fontSize:11, color:'#b45309' }}>Pendiente: <strong>{S0(totalEsperado-totalCobrado)}</strong></div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {recPer.filter(r=>!cobrosPer.some(c=>c.ingreso_recurrente_id===r.id)).map(r=>(
              <div key={r.id}>
                {cobrandoRec===r.id ? (
                  <div style={{ display:'flex', gap:6, alignItems:'center', background:'white', borderRadius:10, padding:'7px 10px', border:'1.5px solid #fbbf24' }}>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', fontSize:11, fontWeight:700, color:'#16a34a' }}>S/.</span>
                      <input type="number" value={montoCobro} onChange={e=>setMontoCobro(e.target.value)} autoFocus
                        style={{ width:90, padding:'6px 6px 6px 28px', border:'1.5px solid #86efac', borderRadius:8, fontWeight:700, color:'#16a34a', outline:'none' }}/>
                    </div>
                    <button onClick={()=>confirmarCobro(r)} disabled={loadingCob}
                      style={{ padding:'6px 12px', background:'#16a34a', color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:700 }}>
                      {loadingCob?'…':'✓'}
                    </button>
                    <button onClick={()=>setCobrandoRec(null)}
                      style={{ padding:'6px 9px', background:'white', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12 }}>✕</button>
                  </div>
                ) : (
                  <button onClick={()=>{
                    setCobrandoRec(r.id)
                    setMontoCobro(String(esQ1?Number(r.monto_pago_1||r.monto_total):Number(r.monto_pago_2||r.monto_total)))
                  }} style={{ padding:'8px 16px', background:'#d97706', color:'white', border:'none', borderRadius:9, fontSize:12, fontWeight:700, boxShadow:'0 2px 8px rgba(217,119,6,0.35)' }}>
                    💸 Cobrar {r.nombre}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ KPIs ═════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>

        {/* Cobrado */}
        <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #86efac', borderRadius:14, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#166534', textTransform:'uppercase', letterSpacing:'0.4px' }}>💰 Cobrado</span>
            <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:todosCobraron?'#16a34a':'#d97706', color:'white' }}>
              {todosCobraron ? '✓' : `${cobrosPer.length}/${recPer.length}`}
            </span>
          </div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:'#16a34a', letterSpacing:'-0.5px' }}>{S0(totalCobrado)}</div>
          {totalEsperado>totalCobrado && <div style={{ fontSize:10, color:'#166534', marginTop:3 }}>Falta: {S0(totalEsperado-totalCobrado)}</div>}
          {totalEsperado>0&&<div style={{ marginTop:6, height:3, background:'#bbf7d0', borderRadius:999 }}><div style={{ height:'100%', width:`${Math.min((totalCobrado/totalEsperado)*100,100)}%`, background:'#16a34a', borderRadius:999, transition:'width 0.5s' }}/></div>}
        </div>

        {/* Gastos */}
        <div style={{ background:'linear-gradient(135deg,#fef2f2,#fee2e2)', border:'1.5px solid #fca5a5', borderRadius:14, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#991b1b', textTransform:'uppercase', letterSpacing:'0.4px' }}>💸 Gastos</span>
            <MiniDonut pct={pctGastos} color={pctGastos>=90?'#dc2626':'#f97316'} size={40} stroke={6}/>
          </div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:'#dc2626', letterSpacing:'-0.5px' }}>{S0(totalGastos)}</div>
          <div style={{ fontSize:10, color:'#991b1b', marginTop:3 }}>{pctGastos.toFixed(0)}% del cobrado</div>
        </div>

        {/* Libre */}
        <div style={{ background: libre>=0?'linear-gradient(135deg,#eff6ff,#dbeafe)':'linear-gradient(135deg,#fef2f2,#fee2e2)', border:`1.5px solid ${libre>=0?'#93c5fd':'#fca5a5'}`, borderRadius:14, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:libre>=0?'#1e40af':'#991b1b', textTransform:'uppercase', letterSpacing:'0.4px' }}>{libre>=0?'✨ Libre':'⚠️ Falta'}</span>
            <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:alcanza?'#16a34a':'#dc2626', color:'white' }}>
              {alcanza?'✅':'❌'}
            </span>
          </div>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:libre>=0?'#2563eb':'#dc2626', letterSpacing:'-0.5px' }}>{S0(Math.abs(libre))}</div>
          {/* Ecuación mini */}
          <div style={{ fontSize:9, color:'var(--text3)', marginTop:3, display:'flex', gap:3, flexWrap:'wrap' }}>
            <span style={{color:'#16a34a',fontWeight:700}}>{S0(totalCobrado)}</span><span>−</span>
            <span style={{color:'#dc2626',fontWeight:700}}>{S0(totalGastos)}</span><span>−</span>
            <span style={{color:'#d97706',fontWeight:700}}>{S0(pagosEfect)}</span>
          </div>
        </div>
      </div>

      {/* ══ GRÁFICO + OBLIGACIONES (split responsivo) ════════ */}
      <div className="g2" style={{ marginBottom:14 }}>

        {/* Gráfico */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13 }}>📊 Ingresos vs Gastos</div>
            <button onClick={()=>onNavigate('flujo_dashboard')} style={{ fontSize:10, fontWeight:700, color:'#6c63ff', background:'none', border:'none' }}>Ver →</button>
          </div>
          <BarChart ingreso={totalCobrado} gasto={totalGastos} presupuesto={totalPres||null}/>
          <div style={{ marginTop:10 }}>
            {[
              {label:'Gastos',   v:totalGastos,          color:'#dc2626', pct:totalCobrado>0?(totalGastos/totalCobrado)*100:0},
              {label:'Pagos',    v:pagosEfect,            color:'#d97706', pct:totalCobrado>0?(pagosEfect/totalCobrado)*100:0},
              {label:'Libre',    v:Math.max(0,libre),     color:'#2563eb', pct:totalCobrado>0?(Math.max(0,libre)/totalCobrado)*100:0},
            ].map(r=>(
              <div key={r.label} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                <div style={{ width:3, height:12, background:r.color, borderRadius:2, flexShrink:0 }}/>
                <span style={{ flex:1, fontSize:11, color:'var(--text2)' }}>{r.label}</span>
                <span style={{ fontFamily:'Nunito', fontWeight:700, fontSize:11, color:r.color }}>{S0(r.v)}</span>
                <span style={{ fontSize:10, color:'var(--text3)', width:28, textAlign:'right' }}>{r.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Obligaciones esta quincena */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13 }}>💳 Obligaciones</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:10, color:'var(--text3)' }}>{oblEsta.filter(d=>pagosHechos[d.id]).length}/{oblEsta.length}</span>
              <button onClick={()=>onNavigate('deudas')} style={{ fontSize:10, fontWeight:700, color:'#6c63ff', background:'none', border:'none' }}>Ver →</button>
            </div>
          </div>

          {/* Barra progreso */}
          {oblEsta.length>0&&(
            <div style={{ height:4, background:'var(--bg)', borderRadius:999, marginBottom:10, border:'1px solid var(--border)' }}>
              <div style={{ height:'100%', width:`${oblEsta.length>0?(oblEsta.filter(d=>pagosHechos[d.id]).length/oblEsta.length)*100:0}%`, background:'#16a34a', borderRadius:999, transition:'width 0.5s' }}/>
            </div>
          )}

          {oblEsta.length===0 ? (
            <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:'var(--text3)' }}>✅ Sin obligaciones</div>
          ) : (
            <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
              {oblEsta.map(deuda => {
                const pagado = !!pagosHechos[deuda.id]
                const pago   = pagosHechos[deuda.id]
                const esTarj = pago?.tipo_pago==='tarjeta_credito'
                const dias   = deuda.dia_pago_mes ? deuda.dia_pago_mes-diaHoy : null
                const info   = dias!==null ? labelDias(dias) : null
                const urg    = dias!==null&&dias<=3&&!pagado
                return (
                  <div key={deuda.id}>
                    <div style={{ borderRadius:10, border:`1.5px solid ${pagado?'#86efac':urg?'#fca5a5':'var(--border)'}`, background:pagado?'#f0fdf4':urg?'#fef2f2':'white', padding:'9px 11px', transition:'all 0.13s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <div onClick={()=>!pagado&&setMarcandoPago(marcandoPago===deuda.id?null:deuda.id)}
                          style={{ width:21, height:21, borderRadius:6, flexShrink:0, cursor:pagado?'default':'pointer', border:`2px solid ${pagado?'#16a34a':'#d1d5db'}`, background:pagado?'#16a34a':'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {pagado&&<span style={{fontSize:11,color:'white',fontWeight:900}}>✓</span>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:700, fontSize:12, textDecoration:pagado?'line-through':'', color:pagado?'#94a3b8':'var(--text)' }}>{deuda.nombre}</span>
                            {info&&!pagado&&<span style={{ fontSize:9, fontWeight:700, color:info.color, background:`${info.color}15`, padding:'1px 5px', borderRadius:20 }}>{info.txt}</span>}
                            {esTarj&&<span style={{ fontSize:9, fontWeight:700, color:'#7c3aed', background:'#f5f3ff', padding:'1px 5px', borderRadius:20 }}>💳</span>}
                          </div>
                          {deuda.dia_pago_mes&&<div style={{ fontSize:10, color:'var(--text3)' }}>día {deuda.dia_pago_mes}</div>}
                        </div>
                        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, color:pagado?'#16a34a':'#dc2626', flexShrink:0 }}>
                          {S0(pago?.monto||deuda.monto_cuota||deuda.monto_pendiente)}
                        </div>
                      </div>

                      {/* Panel pago */}
                      {!pagado&&marcandoPago===deuda.id&&(
                        <div style={{ marginTop:8, background:'var(--bg)', borderRadius:9, padding:'9px 10px', border:'1px solid var(--border)' }}>
                          <div className="chips" style={{ marginBottom:7 }}>
                            {[{v:'efectivo',l:'💵 Efectivo'},{v:'transferencia',l:'📲 Transf.'},{v:'tarjeta_debito',l:'💳 Débito'},{v:'tarjeta_credito',l:'💳 Crédito'}].map(t=>(
                              <div key={t.v} onClick={()=>setTipoPago(t.v)} style={{ padding:'4px 9px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:700, flexShrink:0, background:tipoPago===t.v?'#6c63ff':'white', color:tipoPago===t.v?'white':'var(--text2)', border:`1.5px solid ${tipoPago===t.v?'#6c63ff':'var(--border)'}` }}>{t.l}</div>
                            ))}
                          </div>
                          {tipoPago==='tarjeta_credito'&&<div style={{ fontSize:10, color:'#7c3aed', fontWeight:600, marginBottom:7, background:'#f5f3ff', borderRadius:7, padding:'4px 8px' }}>💳 No descuenta del flujo</div>}
                          <div style={{ display:'flex', gap:5 }}>
                            <div style={{ position:'relative', flex:1 }}>
                              <span style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', fontSize:10, fontWeight:700, color:'#dc2626' }}>S/.</span>
                              <input type="number" value={montoPago} onChange={e=>setMontoPago(e.target.value)} placeholder={String(deuda.monto_cuota||'')} autoFocus min="0"
                                style={{ width:'100%', padding:'7px 6px 7px 24px', border:'1.5px solid #fca5a5', borderRadius:7, fontWeight:700, color:'#dc2626', outline:'none', background:'white' }}/>
                            </div>
                            <button onClick={()=>confirmarPago(deuda)} disabled={loadingPago}
                              style={{ padding:'7px 11px', background:'#16a34a', color:'white', border:'none', borderRadius:7, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                              {loadingPago?'…':'✅'}
                            </button>
                            <button onClick={()=>{setMarcandoPago(null);setMontoPago('')}}
                              style={{ padding:'7px 8px', background:'white', border:'1.5px solid var(--border)', borderRadius:7, fontSize:11 }}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Total */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, padding:'7px 10px', background:'var(--bg)', borderRadius:9, border:'1px solid var(--border)' }}>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)' }}>Total obligaciones</span>
            <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#dc2626' }}>{S0(totalOblEsta)}</span>
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
