import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const S  = n => `S/. ${Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2})}`
const S0 = n => `S/. ${Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:0})}`
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CAT_META = {
  casa:          {emoji:'🏠', label:'Casa / Vivienda',  color:'#0891b2'},
  comida:        {emoji:'🍽️', label:'Comida',           color:'#16a34a'},
  transporte:    {emoji:'🚗', label:'Transporte',        color:'#d97706'},
  salud:         {emoji:'💊', label:'Salud',             color:'#db2777'},
  educacion:     {emoji:'📚', label:'Educación',         color:'#7c3aed'},
  ropa:          {emoji:'👕', label:'Ropa',              color:'#f97316'},
  ocio:          {emoji:'🎬', label:'Ocio',              color:'#06b6d4'},
  suscripciones: {emoji:'📱', label:'Suscripciones',     color:'#8b5cf6'},
  seguros:       {emoji:'🛡️', label:'Seguros',           color:'#0d9488'},
  mantenimiento: {emoji:'🔧', label:'Mantenimiento',     color:'#78716c'},
  imprevisto:    {emoji:'⚡', label:'Imprevisto',         color:'#dc2626'},
  otro_gasto:    {emoji:'📌', label:'Otros gastos',      color:'#64748b'},
}

/* ─────────────────────────────────────────────────────────
   DONUT SVG
───────────────────────────────────────────────────────── */
function Donut({ segs, size=200, stroke=32, center }) {
  const r    = (size-stroke)/2
  const circ = 2*Math.PI*r
  const total= segs.reduce((s,g)=>s+g.v,0)
  let cum    = 0

  if (total===0) return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize="12" fill="#94a3b8" fontFamily="Poppins">Sin datos</text>
    </svg>
  )

  return (
    <svg width={size} height={size} style={{filter:'drop-shadow(0 4px 16px rgba(0,0,0,0.10))'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke}/>
      {segs.map((seg,i)=>{
        const pct  = seg.v/total
        const dash = pct*circ
        const off  = circ*0.25 - cum*circ
        const el   = <circle key={i} cx={size/2} cy={size/2} r={r}
          fill="none" stroke={seg.color} strokeWidth={stroke-2} strokeLinecap="butt"
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={off}
          style={{transition:'stroke-dasharray 0.7s ease'}}/>
        cum += pct
        return el
      })}
      {center && <>
        <text x={size/2} y={size/2-10} textAnchor="middle" fontSize="11"
          fill="#64748b" fontFamily="Poppins" fontWeight="600">{center.label}</text>
        <text x={size/2} y={size/2+10} textAnchor="middle" fontSize="16"
          fill={center.color||'#1e293b'} fontFamily="Nunito,sans-serif" fontWeight="900">{center.value}</text>
        {center.sub&&<text x={size/2} y={size/2+26} textAnchor="middle" fontSize="10"
          fill="#94a3b8" fontFamily="Poppins">{center.sub}</text>}
      </>}
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────────── */
export default function QuincenaResumen({ usuarioId }) {
  const hoy    = new Date()
  const diaHoy = hoy.getDate()
  const mesAct  = hoy.getMonth()+1
  const anioAct = hoy.getFullYear()

  // Período activo: se puede cambiar manualmente
  const periodoAuto = diaHoy<=15 ? 'q1' : 'q2'
  const [periodo,  setPeriodo]  = useState(periodoAuto)
  const [mes,      setMes]      = useState(mesAct)
  const [anio,     setAnio]     = useState(anioAct)
  const [hover,    setHover]    = useState(null)

  // Datos cargados
  const [recurrentes, setRecurrentes] = useState([])
  const [cobros,      setCobros]      = useState([])
  const [lineasPres,  setLineasPres]  = useState([])   // presupuesto_mes_lineas
  const [gastosTx,    setGastosTx]    = useState([])   // transacciones del período
  const [deudas,      setDeudas]      = useState([])
  const [pagosHechos, setPagosHechos] = useState({})   // {deudaId: pago}
  const [cargando,    setCargando]    = useState(true)

  // UI cobro inline
  const [cobrandoId,  setCobrandoId]  = useState(null)
  const [cobPeriodo,  setCobPeriodo]  = useState(null)
  const [montoCobro,  setMontoCobro]  = useState('')
  const [loadingCob,  setLoadingCob]  = useState(false)

  // UI pago inline
  const [marcandoPago, setMarcandoPago] = useState(null)
  const [montoPago,    setMontoPago]    = useState('')
  const [tipoPago,     setTipoPago]     = useState('efectivo')
  const [loadingPago,  setLoadingPago]  = useState(false)

  useEffect(()=>{ cargar() },[mes,anio,periodo])

  /* ── Cargar datos ─────────────────────────────────────── */
  async function cargar() {
    setCargando(true)
    const m   = String(mes).padStart(2,'0')
    const ult = new Date(anio,mes,0).getDate()
    const desde = `${anio}-${m}-${periodo==='q1'?'01':'16'}`
    const hasta = `${anio}-${m}-${periodo==='q1'?'15':String(ult).padStart(2,'0')}`
    const desdeMes = `${anio}-${m}-01`
    const hastaMes = `${anio}-${m}-${ult}`

    const [rRes,cRes,pmRes,txRes,dRes,pRes] = await Promise.all([
      supabase.from('ingresos_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
      supabase.from('cobros').select('*').eq('usuario_id',usuarioId)
        .gte('fecha_cobro',desdeMes).lte('fecha_cobro',hastaMes),
      supabase.from('presupuesto_mes').select('*,presupuesto_mes_lineas(*)')
        .eq('usuario_id',usuarioId).eq('mes',mes).eq('anio',anio).single(),
      supabase.from('transacciones').select('*').eq('usuario_id',usuarioId).eq('tipo','gasto')
        .gte('fecha',desde).lte('fecha',hasta),
      supabase.from('deudas').select('*').eq('usuario_id',usuarioId).eq('estado','activa'),
      supabase.from('pagos_deuda').select('*').eq('usuario_id',usuarioId)
        .gte('fecha_pago',desdeMes).lte('fecha_pago',hastaMes),
    ])

    setRecurrentes(rRes.data||[])
    setCobros(cRes.data||[])
    setLineasPres(pmRes.data?.presupuesto_mes_lineas||[])
    setGastosTx(txRes.data||[])
    setDeudas(dRes.data||[])

    const ph = {}
    ;(pRes.data||[]).forEach(p=>{ ph[p.deuda_id]=p })
    setPagosHechos(ph)
    setCargando(false)
  }

  /* ── COBRAR ───────────────────────────────────────────── */
  async function confirmarCobro(rec) {
    if (!montoCobro||Number(montoCobro)<=0) return
    setLoadingCob(true)
    const fecha = hoy.toISOString().split('T')[0]
    const desc  = `${rec.nombre}${cobPeriodo==='quincena_1'?' – 1ª quincena':cobPeriodo==='quincena_2'?' – 2ª quincena':''}`

    const {data:tx} = await supabase.from('transacciones').insert({
      usuario_id:  usuarioId, tipo:'ingreso', monto:Number(montoCobro),
      categoria:   rec.tipo==='sueldo'?'sueldo':rec.tipo==='honorarios'?'honorarios':'otro_ingreso',
      descripcion: desc, fecha,
    }).select().single()

    await supabase.from('cobros').insert({
      usuario_id:usuarioId, ingreso_recurrente_id:rec.id,
      nombre:rec.nombre, monto:Number(montoCobro),
      fecha_cobro:fecha, periodo:cobPeriodo, transaccion_id:tx?.id||null,
    })

    setCobrandoId(null); setCobPeriodo(null); setMontoCobro('')
    setLoadingCob(false)
    cargar()
  }

  /* ── PAGAR OBLIGACIÓN ─────────────────────────────────── */
  async function confirmarPago(deuda) {
    if (!montoPago||Number(montoPago)<=0) return
    setLoadingPago(true)
    const fecha = hoy.toISOString().split('T')[0]

    await supabase.from('pagos_deuda').insert({
      deuda_id:usuarioId, usuario_id:usuarioId,
      deuda_id:deuda.id, monto:Number(montoPago),
      fecha_pago:fecha, tipo_pago:tipoPago,
      notas:`Pago ${MESES[mes-1]} ${anio}`,
    })

    if (tipoPago!=='tarjeta_credito') {
      await supabase.from('transacciones').insert({
        usuario_id:usuarioId, tipo:'gasto', monto:Number(montoPago),
        categoria:'otro_gasto', descripcion:`Pago ${deuda.nombre}`, fecha,
      })
    }

    await supabase.from('deudas').update({
      monto_pendiente:Math.max(0,Number(deuda.monto_pendiente)-Number(montoPago)),
    }).eq('id',deuda.id)

    setMarcandoPago(null); setMontoPago(''); setTipoPago('efectivo')
    setLoadingPago(false)
    cargar()
  }

  async function desmarcarPago(deuda) {
    const p = pagosHechos[deuda.id]
    if (!p) return
    await supabase.from('pagos_deuda').delete().eq('id',p.id)
    await supabase.from('deudas').update({
      monto_pendiente:Number(deuda.monto_pendiente)+Number(p.monto),
      estado:'activa',
    }).eq('id',deuda.id)
    cargar()
  }

  /* ── CALCULAR DATOS ───────────────────────────────────── */
  const periodoKey  = periodo==='q1' ? 'quincena_1' : 'quincena_2'
  const esQ1        = periodo==='q1'
  const labelPer    = esQ1 ? '1ª quincena (1–15)' : '2ª quincena (16–fin)'

  // Ingresos del período
  const cobrosPeriodo = cobros.filter(c=>c.periodo===periodoKey)
  const totalCobrado  = cobrosPeriodo.reduce((s,c)=>s+Number(c.monto),0)

  // Recurrentes que aplican a este período
  const recsAplicables = recurrentes.filter(r=>{
    if (r.frecuencia==='quincenal') return true
    if (r.frecuencia==='mensual')   return esQ1   // convención: mensual se cobra en q1
    return true
  })

  const totalEsperado = recsAplicables.reduce((s,r)=>{
    if (r.frecuencia==='quincenal') return s+(esQ1?Number(r.monto_pago_1||0):Number(r.monto_pago_2||0))
    return s+Number(r.monto_total||0)
  },0)

  // Gastos reales del período por categoría
  const gastosXCat = {}
  gastosTx.forEach(t=>{ gastosXCat[t.categoria]=(gastosXCat[t.categoria]||0)+Number(t.monto) })
  const totalGastosTx = gastosTx.reduce((s,t)=>s+Number(t.monto),0)

  // Deudas de la quincena (por dia_pago_mes)
  const deudasPeriodo = deudas.filter(d=>{
    if (!d.dia_pago_mes) return false
    return esQ1 ? d.dia_pago_mes<=15 : d.dia_pago_mes>15
  })
  const totalObligaciones = deudasPeriodo.reduce((s,d)=>s+Number(d.monto_cuota||0),0)
  const totalPagosMarcados= deudasPeriodo.filter(d=>pagosHechos[d.id]).reduce((s,d)=>s+Number(pagosHechos[d.id]?.monto||0),0)
  const totalPagosTC      = deudasPeriodo.filter(d=>pagosHechos[d.id]?.tipo_pago==='tarjeta_credito').reduce((s,d)=>s+Number(pagosHechos[d.id]?.monto||0),0)

  // Libre real = cobrado - gastos de transacciones - pagos en efectivo/débito
  const pagosSinTC = totalPagosMarcados - totalPagosTC
  const libre      = totalCobrado - totalGastosTx - pagosSinTC

  // ── Presupuesto split: cuánto corresponde en esta quincena ──
  const totalPresupuesto = lineasPres.reduce((s,l)=>s+Number(l.monto_limite),0)
  const lineasConSplit   = lineasPres.map(l=>{
    const pct    = totalPresupuesto>0?(Number(l.monto_limite)/totalPresupuesto)*100:0
    const split  = totalEsperado>0 ? (pct/100)*totalEsperado : 0
    const gastado= gastosXCat[l.categoria]||0
    const meta   = CAT_META[l.categoria]||{emoji:'📌',label:l.categoria,color:'#64748b'}
    return { ...l, pct, split, gastado, ...meta, limite:Number(l.monto_limite) }
  }).sort((a,b)=>b.limite-a.limite)

  // Segmentos donut: gasto real por categoría + libre
  const segsGastado = lineasConSplit.filter(l=>l.gastado>0).map(l=>({v:l.gastado,color:l.color}))
  if (libre>0) segsGastado.push({v:libre,color:'#e2e8f0'})
  const hoverData = hover!==null ? lineasConSplit[hover] : null

  if (cargando) return (
    <div style={{padding:32,display:'flex',alignItems:'center',justifyContent:'center',minHeight:400}}>
      <div style={{textAlign:'center',color:'var(--text3)',fontSize:13}}>Cargando resumen...</div>
    </div>
  )

  return (
    <div style={{padding:28,maxWidth:1100,margin:'0 auto'}}>

      {/* ── HEADER ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:22}}>
            📅 Resumen de quincena
          </div>
          <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
            Seguimiento de ingresos, gastos fijos y flujo disponible
          </div>
        </div>

        {/* Navegación mes + período */}
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>{let m=mes-1,a=anio;if(m<1){m=12;a--}setMes(m);setAnio(a)}} style={btnNav}>‹</button>
          <span style={{fontFamily:'Nunito',fontWeight:800,fontSize:15,minWidth:130,textAlign:'center'}}>
            {MESES[mes-1]} {anio}
          </span>
          <button onClick={()=>{let m=mes+1,a=anio;if(m>12){m=1;a++}setMes(m);setAnio(a)}} style={btnNav}>›</button>

          <div style={{display:'flex',background:'var(--bg)',borderRadius:10,border:'1.5px solid var(--border)',overflow:'hidden',marginLeft:6}}>
            {[{v:'q1',l:'1ª quincena'},{v:'q2',l:'2ª quincena'}].map(p=>(
              <div key={p.v} onClick={()=>setPeriodo(p.v)} style={{
                padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,
                background:periodo===p.v?'#6c63ff':'transparent',
                color:periodo===p.v?'white':'var(--text2)',
                transition:'all 0.13s',
              }}>{p.l}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ECUACIÓN FLUJO ── */}
      <div style={{background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'16px 20px',marginBottom:22,boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr auto 1fr auto 1fr',gap:8,alignItems:'center'}}>
          {[
            {label:'Cobrado',      v:S0(totalCobrado),       color:'#16a34a',  bg:'#f0fdf4',   border:'#86efac'},
            {op:'−'},
            {label:'Gastos',       v:S0(totalGastosTx),      color:'#dc2626',  bg:'#fef2f2',   border:'#fca5a5'},
            {op:'−'},
            {label:'Pagos (efect)',v:S0(pagosSinTC),         color:'#d97706',  bg:'#fffbeb',   border:'#fde68a'},
            {op:'='},
            {label:'Libre',        v:S0(libre),               color:libre>=0?'#2563eb':'#dc2626', bg:libre>=0?'#eff6ff':'#fef2f2', border:libre>=0?'#93c5fd':'#fca5a5', big:true},
          ].map((item,i)=>item.op
            ? <div key={i} style={{textAlign:'center',fontSize:20,fontWeight:700,color:'var(--text3)'}}>{item.op}</div>
            : <div key={i} style={{textAlign:'center',background:item.bg,border:`1.5px solid ${item.border}`,borderRadius:12,padding:'12px 8px'}}>
                <div style={{fontSize:10,fontWeight:700,color:item.color,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{item.label}</div>
                <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:item.big?22:16,color:item.color,letterSpacing:'-0.5px'}}>{item.v}</div>
              </div>
          )}
        </div>
        {totalPagosTC>0&&(
          <div style={{marginTop:10,fontSize:11,color:'#7c3aed',fontWeight:600,textAlign:'center'}}>
            💳 +{S0(totalPagosTC)} pagados con tarjeta de crédito (no descuentan del flujo)
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,alignItems:'start'}}>

        {/* ── COL IZQUIERDA ── */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          {/* ── INGRESOS: check cobrado ── */}
          <div style={card}>
            <SecHeader emoji="💰" title="Ingresos del período" sub={labelPer}/>

            {recsAplicables.length===0 ? (
              <div style={emptyMsg}>Sin ingresos fijos configurados</div>
            ) : recsAplicables.map(rec=>{
              const pKey = rec.frecuencia==='quincenal' ? periodoKey : 'mes_completo'
              const cob  = cobros.find(c=>c.ingreso_recurrente_id===rec.id&&c.periodo===pKey)
              const mExp = rec.frecuencia==='quincenal'
                ? (esQ1?Number(rec.monto_pago_1||0):Number(rec.monto_pago_2||0))
                : Number(rec.monto_total||0)

              return (
                <div key={rec.id} style={{
                  borderRadius:12,border:`1.5px solid ${cob?'#86efac':'var(--border)'}`,
                  background:cob?'#f0fdf4':'white',padding:'11px 14px',marginBottom:8,
                  transition:'all 0.15s',
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:11}}>
                    {/* Checkbox cobro */}
                    <div onClick={()=>{
                      if(cob) return  // no se puede desmarcar cobro fácilmente
                      setCobrandoId(rec.id); setCobPeriodo(pKey); setMontoCobro(String(mExp))
                    }} style={{
                      width:24,height:24,borderRadius:7,flexShrink:0,cursor:cob?'default':'pointer',
                      border:`2px solid ${cob?'#16a34a':'#d1d5db'}`,background:cob?'#16a34a':'white',
                      display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',
                    }}>
                      {cob&&<span style={{fontSize:13,color:'white',fontWeight:900}}>✓</span>}
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                        {rec.nombre}
                        {rec.frecuencia==='quincenal'&&(
                          <span style={{fontSize:10,fontWeight:600,color:'#0891b2',background:'#ecfeff',padding:'1px 6px',borderRadius:20}}>Quincenal</span>
                        )}
                      </div>
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                        {cob
                          ? `Cobrado el ${new Date(cob.fecha_cobro+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})}`
                          : `Esperado: día ${esQ1?rec.dia_pago_1:rec.dia_pago_2||rec.dia_pago_1}`
                        }
                      </div>
                    </div>

                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:17,color:cob?'#16a34a':'var(--text2)'}}>{S0(cob?cob.monto:mExp)}</div>
                      {!cob&&<div style={{fontSize:10,color:'var(--text3)'}}>esperado</div>}
                    </div>
                  </div>

                  {/* Panel cobro inline */}
                  {cobrandoId===rec.id&&!cob&&(
                    <div style={{marginTop:10,background:'var(--bg)',borderRadius:10,padding:'10px 12px',border:'1px solid var(--border)'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#16a34a',marginBottom:8}}>
                        ✅ Confirmar cobro — ajusta si hubo descuentos
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{position:'relative',flex:1}}>
                          <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:12,fontWeight:800,color:'#16a34a'}}>S/.</span>
                          <input type="number" value={montoCobro} onChange={e=>setMontoCobro(e.target.value)}
                            autoFocus min="0" step="0.01"
                            style={{width:'100%',padding:'8px 8px 8px 34px',border:'1.5px solid #86efac',borderRadius:9,fontSize:14,fontWeight:800,color:'#16a34a',fontFamily:'Poppins',outline:'none',background:'white',boxSizing:'border-box'}}/>
                        </div>
                        <button onClick={()=>confirmarCobro(rec)} disabled={loadingCob}
                          style={{padding:'8px 14px',background:'#16a34a',color:'white',border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                          {loadingCob?'…':'✓ Cobré'}
                        </button>
                        <button onClick={()=>{setCobrandoId(null);setMontoCobro('')}}
                          style={{padding:'8px 10px',background:'white',border:'1.5px solid var(--border)',borderRadius:9,fontSize:12,cursor:'pointer'}}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Totales ingresos */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4,padding:'9px 12px',background:'var(--bg)',borderRadius:10,border:'1px solid var(--border)'}}>
              <span style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>Total cobrado</span>
              <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:16,color:totalCobrado>=totalEsperado?'#16a34a':'#d97706'}}>
                {S0(totalCobrado)} <span style={{fontSize:11,fontWeight:500,color:'var(--text3)'}}>de {S0(totalEsperado)}</span>
              </span>
            </div>
          </div>

          {/* ── GASTOS FIJOS: check pagado ── */}
          <div style={card}>
            <SecHeader emoji="🏦" title="Gastos fijos y obligaciones" sub={labelPer}/>

            {deudasPeriodo.length===0 ? (
              <div style={emptyMsg}>Sin obligaciones para esta quincena</div>
            ) : deudasPeriodo.map(deuda=>{
              const pagado = !!pagosHechos[deuda.id]
              const pago   = pagosHechos[deuda.id]
              const esTarj = pago?.tipo_pago==='tarjeta_credito'
              const hoyD   = hoy.getDate()
              const enRango= deuda.dia_pago_mes&&(esQ1?deuda.dia_pago_mes<=15:deuda.dia_pago_mes>15)
              const diasRest= deuda.dia_pago_mes ? deuda.dia_pago_mes-hoyD : null
              const urgente = diasRest!==null&&diasRest<=3&&!pagado

              return (
                <div key={deuda.id}>
                  <div style={{
                    borderRadius:12,border:`1.5px solid ${pagado?'#86efac':urgente?'#fca5a5':'var(--border)'}`,
                    background:pagado?'#f0fdf4':urgente?'#fef2f2':'white',
                    padding:'11px 14px',marginBottom:7,transition:'all 0.15s',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:11}}>
                      {/* Checkbox pago */}
                      <div onClick={()=>pagado?desmarcarPago(deuda):setMarcandoPago(marcandoPago===deuda.id?null:deuda.id)}
                        style={{
                          width:24,height:24,borderRadius:7,flexShrink:0,cursor:'pointer',
                          border:`2px solid ${pagado?'#16a34a':'#d1d5db'}`,background:pagado?'#16a34a':'white',
                          display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',
                        }}>
                        {pagado&&<span style={{fontSize:13,color:'white',fontWeight:900}}>✓</span>}
                      </div>

                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <span style={{fontWeight:700,fontSize:13,textDecoration:pagado?'line-through':'',color:pagado?'var(--text3)':'var(--text)'}}>{deuda.nombre}</span>
                          {urgente&&<span style={{fontSize:10,fontWeight:700,color:'#dc2626',background:'#fef2f2',padding:'1px 6px',borderRadius:20}}>⚠️ {diasRest===0?'Hoy':diasRest<0?'Venció':`${diasRest}d`}</span>}
                          {esTarj&&<span style={{fontSize:10,fontWeight:700,color:'#7c3aed',background:'#f5f3ff',padding:'1px 6px',borderRadius:20}}>💳 TC</span>}
                        </div>
                        <div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                          {deuda.tipo?.replace(/_/g,' ')}
                          {deuda.dia_pago_mes&&` · día ${deuda.dia_pago_mes}`}
                          {pagado&&` · pagado ${new Date(pago.fecha_pago+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})}`}
                        </div>
                      </div>

                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:16,color:pagado?'#16a34a':'#dc2626'}}>
                          {S0(pago?.monto||deuda.monto_cuota||deuda.monto_pendiente)}
                        </div>
                        {esTarj&&<div style={{fontSize:9,color:'#7c3aed',fontWeight:600}}>no resta flujo</div>}
                      </div>
                    </div>

                    {/* Panel pago inline */}
                    {!pagado&&marcandoPago===deuda.id&&(
                      <div style={{marginTop:10,background:'var(--bg)',borderRadius:10,padding:'11px 12px',border:'1px solid var(--border)'}}>
                        <div style={{display:'flex',gap:5,marginBottom:9,flexWrap:'wrap'}}>
                          {[
                            {v:'efectivo',      l:'💵 Efectivo'},
                            {v:'transferencia', l:'📲 Transf.'},
                            {v:'tarjeta_debito',l:'💳 Débito'},
                            {v:'tarjeta_credito',l:'💳 Crédito'},
                          ].map(t=>(
                            <div key={t.v} onClick={()=>setTipoPago(t.v)} style={{
                              padding:'4px 9px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700,
                              background:tipoPago===t.v?'#6c63ff':'white',
                              color:tipoPago===t.v?'white':'var(--text2)',
                              border:`1.5px solid ${tipoPago===t.v?'#6c63ff':'var(--border)'}`,
                              transition:'all 0.12s',
                            }}>{t.l}</div>
                          ))}
                        </div>
                        {tipoPago==='tarjeta_credito'&&(
                          <div style={{background:'#f5f3ff',borderRadius:8,padding:'6px 10px',marginBottom:8,fontSize:10,color:'#7c3aed',fontWeight:600}}>
                            💳 No descuenta del flujo de caja disponible
                          </div>
                        )}
                        <div style={{display:'flex',gap:7,alignItems:'center'}}>
                          <div style={{position:'relative',flex:1}}>
                            <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:11,fontWeight:700,color:'#dc2626'}}>S/.</span>
                            <input type="number" value={montoPago}
                              onChange={e=>setMontoPago(e.target.value)}
                              placeholder={String(deuda.monto_cuota||'')} min="0" step="0.01"
                              style={{width:'100%',padding:'7px 7px 7px 28px',border:'1.5px solid #fca5a5',borderRadius:8,fontSize:13,fontWeight:700,color:'#dc2626',fontFamily:'Poppins',outline:'none',background:'white',boxSizing:'border-box'}}/>
                          </div>
                          <button onClick={()=>confirmarPago(deuda)} disabled={loadingPago}
                            style={{padding:'7px 13px',background:'#16a34a',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                            {loadingPago?'…':'✅ Pagar'}
                          </button>
                          <button onClick={()=>{setMarcandoPago(null);setMontoPago('')}}
                            style={{padding:'7px 9px',background:'white',border:'1.5px solid var(--border)',borderRadius:8,fontSize:12,cursor:'pointer'}}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Totales obligaciones */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4,padding:'9px 12px',background:'var(--bg)',borderRadius:10,border:'1px solid var(--border)'}}>
              <span style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>
                {Object.keys(pagosHechos).filter(id=>deudasPeriodo.some(d=>d.id===id)).length} de {deudasPeriodo.length} pagados
              </span>
              <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:15,color:'#dc2626'}}>
                {S0(totalObligaciones)}
              </span>
            </div>
          </div>
        </div>

        {/* ── COL DERECHA ── */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          {/* ── DONUT + DISTRIBUCIÓN PRESUPUESTO ── */}
          <div style={card}>
            <SecHeader emoji="🥧" title="Distribución del presupuesto" sub={`Gasto real vs límite — ${labelPer}`}/>

            {lineasConSplit.length===0 ? (
              <div style={emptyMsg}>Sin presupuesto asignado este mes</div>
            ) : (
              <>
                {/* Donut centrado */}
                <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
                  <Donut
                    segs={segsGastado}
                    size={190} stroke={30}
                    center={hoverData ? {
                      label:hoverData.label,
                      value:S0(hoverData.gastado),
                      sub:`de ${S0(hoverData.limite)}`,
                      color:hoverData.color,
                    } : {
                      label:'Gastado',
                      value:S0(totalGastosTx),
                      sub:`${totalPresupuesto>0?((totalGastosTx/totalPresupuesto)*100).toFixed(0):'0'}%`,
                      color:totalGastosTx>totalPresupuesto?'#dc2626':'#6c63ff',
                    }}
                  />
                </div>

                {/* Lista de categorías con split quincena */}
                <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:340,overflowY:'auto'}}>
                  {lineasConSplit.map((l,i)=>{
                    const pctGastado = l.limite>0?(l.gastado/l.limite)*100:0
                    const excede     = l.gastado>l.limite
                    const resto      = Math.max(0,l.limite-l.gastado)
                    return (
                      <div key={i}
                        onMouseEnter={()=>setHover(i)}
                        onMouseLeave={()=>setHover(null)}
                        style={{
                          padding:'8px 10px',borderRadius:10,cursor:'default',
                          border:`1.5px solid ${hover===i?l.color+'50':'var(--border)'}`,
                          background:hover===i?`${l.color}08`:'white',
                          transition:'all 0.12s',
                        }}>
                        {/* Fila principal */}
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            <span style={{fontSize:15}}>{l.emoji}</span>
                            <span style={{fontSize:12,fontWeight:700,color:'var(--text2)'}}>{l.label}</span>
                          </div>
                          <div style={{textAlign:'right',fontSize:12}}>
                            <span style={{fontFamily:'Nunito',fontWeight:800,color:excede?'#dc2626':l.color}}>{S0(l.gastado)}</span>
                            <span style={{color:'var(--text3)',marginLeft:3}}>/ {S0(l.limite)}</span>
                          </div>
                        </div>

                        {/* Barra progreso */}
                        <div style={{height:5,background:'var(--bg)',borderRadius:999,overflow:'hidden',border:'1px solid var(--border)',marginBottom:5}}>
                          <div style={{height:'100%',width:`${Math.min(pctGastado,100)}%`,background:excede?'#dc2626':pctGastado>=80?'#d97706':l.color,borderRadius:999,transition:'width 0.5s'}}/>
                        </div>

                        {/* Detalle quincena */}
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text3)'}}>
                          <span>
                            {excede
                              ? <span style={{color:'#dc2626',fontWeight:700}}>⚠️ excede {S0(l.gastado-l.limite)}</span>
                              : <span style={{color:'#16a34a',fontWeight:600}}>resta {S0(resto)}</span>
                            }
                          </span>
                          <span style={{color:'#7c3aed',fontWeight:600}}>
                            🌓 Sep. quincena: <strong>{S0(l.split)}</strong>
                            <span style={{color:'var(--text3)',fontWeight:400}}> ({l.pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Resumen split quincena */}
                <div style={{marginTop:12,background:'#f5f3ff',borderRadius:12,padding:'12px 14px',border:'1.5px solid #c4b5fd'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#7c3aed',marginBottom:8}}>
                    🌓 ¿Cuánto separar de {S0(totalEsperado)} cobrados esta quincena?
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {lineasConSplit.slice(0,5).map((l,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:12,display:'flex',alignItems:'center',gap:5}}>
                          <span>{l.emoji}</span>
                          <span style={{color:'var(--text2)'}}>{l.label}</span>
                        </span>
                        <span style={{fontFamily:'Nunito',fontWeight:800,fontSize:13,color:'#7c3aed'}}>{S0(l.split)}</span>
                      </div>
                    ))}
                    {lineasConSplit.length>5&&(
                      <div style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:3}}>
                        +{lineasConSplit.length-5} categorías más
                      </div>
                    )}
                    <div style={{borderTop:'1px solid #c4b5fd',paddingTop:7,marginTop:4,display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'#7c3aed'}}>Total a distribuir</span>
                      <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:15,color:'#7c3aed'}}>{S0(totalEsperado)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── RESUMEN RÁPIDO ── */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[
              {emoji:'💰',label:'Cobrado',   v:S0(totalCobrado),  color:'#16a34a',bg:'#f0fdf4', border:'#86efac'},
              {emoji:'💸',label:'Gastado',   v:S0(totalGastosTx), color:'#dc2626',bg:'#fef2f2', border:'#fca5a5'},
              {emoji:'🏦',label:'Obligaciones',v:S0(totalObligaciones),color:'#d97706',bg:'#fffbeb',border:'#fde68a'},
              {emoji:'✨',label:'Libre',     v:S0(libre),         color:libre>=0?'#2563eb':'#dc2626',bg:libre>=0?'#eff6ff':'#fef2f2',border:libre>=0?'#93c5fd':'#fca5a5'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,border:`1.5px solid ${k.border}`,borderRadius:13,padding:'13px 14px'}}>
                <div style={{fontSize:18,marginBottom:5}}>{k.emoji}</div>
                <div style={{fontSize:10,fontWeight:700,color:k.color,textTransform:'uppercase',marginBottom:3}}>{k.label}</div>
                <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:18,color:k.color}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Sub-componentes */
function SecHeader({emoji,title,sub}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
      <div style={{width:34,height:34,borderRadius:9,background:'var(--bg)',border:'1.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>{emoji}</div>
      <div>
        <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:14}}>{title}</div>
        {sub&&<div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>{sub}</div>}
      </div>
    </div>
  )
}

const card     = {background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'18px 20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}
const btnNav   = {padding:'6px 12px',background:'white',border:'1.5px solid var(--border)',borderRadius:8,fontSize:15,cursor:'pointer',fontWeight:700}
const emptyMsg = {textAlign:'center',padding:'18px 0',fontSize:12,color:'var(--text3)'}
