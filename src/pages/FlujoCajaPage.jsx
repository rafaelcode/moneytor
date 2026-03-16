import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, PERIODOS, MESES,
  proximaFechaCobro, diasHastaCobro,
  periodoDeObligacion, rangoPeriodo,
  TIPOS_INGRESO_REC,
} from '../lib/flujoRecurrenteUtils'
import { fmt as fmtDeuda, TIPOS_DEUDA_REC, proximaFechaPago, diasHastaPago } from '../lib/deudaRecurrenteUtils'
import IngresoRecurrenteForm from '../components/IngresoRecurrenteForm'
import DeudaRecurrenteForm from '../components/DeudaRecurrenteForm'

export default function FlujoCaja({ usuarioId }) {
  const hoy   = new Date()
  const [mes,  setMes]  = useState(hoy.getMonth()+1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  // Datos
  const [recurrentes,  setRecurrentes]  = useState([])
  const [cobros,       setCobros]       = useState([])
  const [deudas,       setDeudas]       = useState([])
  const [deudasRec,    setDeudasRec]    = useState([])
  const [pagosRec,     setPagosRec]     = useState([])
  const [cargando,     setCargando]    = useState(true)

  // Modales
  const [modalRec,     setModalRec]     = useState(false)
  const [editandoRec,  setEditandoRec]  = useState(null)
  const [cobrandoId,   setCobrandoId]   = useState(null)   // id ingreso recurrente
  const [cobrandoPeriodo, setCobrandoPeriodo] = useState(null)
  const [montoCobro,   setMontoCobro]   = useState('')
  const [notasCobro,   setNotasCobro]   = useState('')
  const [loadingCobro, setLoadingCobro] = useState(false)
  
  // Deudas recurrentes
  const [modalDeudaRec, setModalDeudaRec] = useState(false)
  const [editandoDeudaRec, setEditandoDeudaRec] = useState(null)

  const periodoActual = hoy.getDate()<=15 ? 'quincena_1' : 'quincena_2'

  useEffect(()=>{ cargar() },[mes,anio])

  async function cargar() {
    setCargando(true)
    const m = String(mes).padStart(2,'0')
    const ult = new Date(anio,mes,0).getDate()
    const desde = `${anio}-${m}-01`
    const hasta = `${anio}-${m}-${ult}`

    const [recRes, cobrosRes, deudasRes, deudasRecRes, pagosRecRes] = await Promise.all([
      supabase.from('ingresos_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
      supabase.from('cobros').select('*').eq('usuario_id',usuarioId).gte('fecha_cobro',desde).lte('fecha_cobro',hasta).order('fecha_cobro',{ascending:false}),
      supabase.from('deudas').select('*').eq('usuario_id',usuarioId).eq('estado','activa'),
      supabase.from('deudas_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
      supabase.from('pagos_deuda').select('*').eq('usuario_id',usuarioId).gte('fecha',desde).lte('fecha',hasta).order('fecha',{ascending:false}),
    ])
    setRecurrentes(recRes.data||[])
    setCobros(cobrosRes.data||[])
    setDeudas(deudasRes.data||[])
    setDeudasRec(deudasRecRes.data||[])
    setPagosRec(pagosRecRes.data||[])
    setCargando(false)
  }

  // ── Cobrar quincena / ingreso ─────────────────────────────
  function abrirCobro(rec, periodo) {
    setCobrandoId(rec.id)
    setCobrandoPeriodo(periodo)
    // Pre-rellenar monto según período
    if (periodo==='quincena_1') setMontoCobro(rec.monto_pago_1||rec.monto_total||'')
    else if (periodo==='quincena_2') setMontoCobro(rec.monto_pago_2||rec.monto_total||'')
    else setMontoCobro(rec.monto_total||'')
    setNotasCobro('')
  }

  async function confirmarCobro() {
    if (!montoCobro||Number(montoCobro)<=0) return
    setLoadingCobro(true)
    const rec = recurrentes.find(r=>r.id===cobrandoId)
    if (!rec) return

    const fechaCobro = hoy.toISOString().split('T')[0]

    // 1. Crear transacción de ingreso
    const { data: tx } = await supabase.from('transacciones').insert({
      usuario_id:  usuarioId,
      tipo:        'ingreso',
      monto:       Number(montoCobro),
      categoria:   rec.tipo==='sueldo'?'sueldo':rec.tipo==='honorarios'?'honorarios':'otro_ingreso',
      descripcion: `${rec.nombre}${cobrandoPeriodo==='quincena_1'?' – 1ª quincena':cobrandoPeriodo==='quincena_2'?' – 2ª quincena':''}`,
      fecha:       fechaCobro,
    }).select().single()

    // 2. Registrar cobro
    await supabase.from('cobros').insert({
      usuario_id:            usuarioId,
      ingreso_recurrente_id: rec.id,
      nombre:                rec.nombre,
      monto:                 Number(montoCobro),
      moneda:                rec.moneda||'PEN',
      fecha_cobro:           fechaCobro,
      periodo:               cobrandoPeriodo,
      notas:                 notasCobro||null,
      transaccion_id:        tx?.id||null,
    })

    setCobrandoId(null); setCobrandoPeriodo(null)
    setMontoCobro(''); setNotasCobro('')
    setLoadingCobro(false)
    cargar()
  }

  async function eliminarRecurrente(id) {
    if (!confirm('¿Eliminar este ingreso recurrente?')) return
    await supabase.from('ingresos_recurrentes').update({activo:false}).eq('id',id)
    cargar()
  }

  async function eliminarDeudaRec(id) {
    if (!confirm('¿Eliminar esta obligación recurrente?')) return
    await supabase.from('deudas_recurrentes').update({activo:false}).eq('id',id)
    cargar()
  }

  async function anularCobro(cobro) {
    if (cobro.transaccion_id) {
      await supabase.from('transacciones').delete().eq('id', cobro.transaccion_id)
    } else {
      const { data: txs } = await supabase.from('transacciones')
        .select('*').eq('usuario_id', usuarioId).eq('tipo', 'ingreso')
        .eq('monto', cobro.monto).eq('fecha', cobro.fecha_cobro).ilike('descripcion', `%${cobro.nombre}%`)
      if (txs?.length > 0) await supabase.from('transacciones').delete().eq('id', txs[0].id)
    }
    await supabase.from('cobros').delete().eq('id', cobro.id)
    cargar()
  }

  async function marcarPagoRec(deudaRec, monto, quincena) {
    const montoNum = Number(monto || 0)
    let fecha = hoy.toISOString().split('T')[0]
    if (quincena) {
      const m = String(mes).padStart(2,'0')
      const ultDia = new Date(anio, mes, 0).getDate()
      const diaFecha = quincena === 'q1'
        ? Math.min(deudaRec.dia_pago_1||15, 15)
        : Math.max(deudaRec.dia_pago_2||16, 16)
      fecha = `${anio}-${m}-${String(Math.min(diaFecha, quincena==='q1'?15:ultDia)).padStart(2,'0')}`
    }
    const desc = quincena
      ? `Pago ${deudaRec.nombre} ${quincena==='q1'?'1ª quincena':'2ª quincena'}`
      : `Pago ${deudaRec.nombre}`
    const { error: txErr } = await supabase.from('transacciones').insert({
      usuario_id: usuarioId, tipo: 'gasto', monto: montoNum, fecha, categoria: 'otro_gasto', descripcion: desc,
    })
    if (txErr) { console.error(txErr); return }
    await supabase.from('pagos_deuda').insert({
      usuario_id: usuarioId, deuda_recurrente_id: deudaRec.id, monto: montoNum, fecha,
    })
    cargar()
  }

  async function anularPagoRec(pago) {
    if (!pago?.id) return
    const { data: txs } = await supabase.from('transacciones')
      .select('*').eq('usuario_id', usuarioId).eq('tipo', 'gasto')
      .eq('monto', pago.monto).eq('fecha', pago.fecha).ilike('descripcion', '%Pago%')
    if (txs?.length > 0) await supabase.from('transacciones').delete().eq('id', txs[0].id)
    await supabase.from('pagos_deuda').delete().eq('id', pago.id)
    cargar()
  }

  // ── Build flat items lists ────────────────────────────────
  function buildCobroItems() {
    const items = []
    recurrentes.forEach(rec => {
      const tipoInfo = TIPOS_INGRESO_REC.find(t=>t.valor===rec.tipo)||{emoji:'💰',color:'#16a34a'}
      if (rec.frecuencia === 'quincenal') {
        const cQ1 = cobros.find(c=>c.ingreso_recurrente_id===rec.id && c.periodo==='quincena_1')
        const cQ2 = cobros.find(c=>c.ingreso_recurrente_id===rec.id && c.periodo==='quincena_2')
        items.push({ id:`${rec.id}_q1`, rec, tipoInfo, cobrado:!!cQ1, cobroObj:cQ1||null, monto:Number(rec.monto_pago_1||rec.monto_total||0), label:`${rec.nombre} · 1ª quinc.`, periodo:'quincena_1', dia:rec.dia_pago_1||15 })
        items.push({ id:`${rec.id}_q2`, rec, tipoInfo, cobrado:!!cQ2, cobroObj:cQ2||null, monto:Number(rec.monto_pago_2||rec.monto_total||0), label:`${rec.nombre} · 2ª quinc.`, periodo:'quincena_2', dia:rec.dia_pago_2||30 })
      } else {
        const cMes = cobros.find(c=>c.ingreso_recurrente_id===rec.id)
        items.push({ id:`${rec.id}_mes`, rec, tipoInfo, cobrado:!!cMes, cobroObj:cMes||null, monto:Number(rec.monto_total||0), label:rec.nombre, periodo:'mes_completo', dia:rec.dia_pago_1||30 })
      }
    })
    return items
  }

  function buildPagoItems() {
    const items = []
    deudasRec.forEach(dr => {
      const tipoInfo = TIPOS_DEUDA_REC.find(t=>t.valor===dr.tipo)||{emoji:'💳',color:'#7c3aed'}
      if (dr.frecuencia === 'quincenal') {
        const pQ1 = pagosRec.find(p=>p.deuda_recurrente_id===dr.id && new Date(p.fecha+'T00:00:00').getDate()<=15)
        const pQ2 = pagosRec.find(p=>p.deuda_recurrente_id===dr.id && new Date(p.fecha+'T00:00:00').getDate()>15)
        items.push({ id:`${dr.id}_q1`, dr, tipoInfo, pagado:!!pQ1, pagoObj:pQ1||null, monto:Number(dr.monto_pago_1||dr.monto_total||0), label:`${dr.nombre} · 1ª quinc.`, quincena:'q1', dia:dr.dia_pago_1||15 })
        items.push({ id:`${dr.id}_q2`, dr, tipoInfo, pagado:!!pQ2, pagoObj:pQ2||null, monto:Number(dr.monto_pago_2||dr.monto_total||0), label:`${dr.nombre} · 2ª quinc.`, quincena:'q2', dia:dr.dia_pago_2||30 })
      } else {
        const pMes = pagosRec.find(p=>p.deuda_recurrente_id===dr.id)
        items.push({ id:`${dr.id}_mes`, dr, tipoInfo, pagado:!!pMes, pagoObj:pMes||null, monto:Number(dr.monto_total||0), label:dr.nombre, quincena:null, dia:dr.dia_pago_mes||dr.dia_pago_1||1 })
      }
    })
    return items
  }

  // ── Resumen mes ──────────────────────────────────────────
  function estadoPeriodo(periodo) {
    const cobradoPeriodo = cobros
      .filter(c=>c.periodo===periodo||(!c.periodo&&periodo==='mes_completo'))
      .reduce((s,c)=>s+Number(c.monto),0)
    const obligaciones = deudas.filter(d=>{
      const p = periodoDeObligacion(d.dia_pago_mes)
      return p===periodo||periodo==='mes_completo'
    })
    const totalObligaciones = obligaciones.reduce((s,d)=>s+Number(d.monto_cuota||d.monto_pendiente||0),0)
    const sobrante = cobradoPeriodo - totalObligaciones
    return { cobradoPeriodo, obligaciones, totalObligaciones, sobrante }
  }
  const totalCobrado  = cobros.reduce((s,c)=>s+Number(c.monto),0)
  const totalEsperado = recurrentes.reduce((s,r)=>s+Number(r.monto_total),0)
  const q1 = estadoPeriodo('quincena_1')
  const q2 = estadoPeriodo('quincena_2')

  return (
    <div style={{padding:28}}>

      {/* ── Selector de mes ── */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <button onClick={()=>{ if(mes===1){setMes(12);setAnio(a=>a-1)}else setMes(m=>m-1) }} style={btnIcono('#6c63ff')}>‹</button>
        <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:18,color:'var(--text)',minWidth:140,textAlign:'center'}}>{MESES[mes-1]} {anio}</span>
        <button onClick={()=>{ if(mes===12){setMes(1);setAnio(a=>a+1)}else setMes(m=>m+1) }} style={btnIcono('#6c63ff')}>›</button>
      </div>

      {/* ── KPIs del mes ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        <KpiCard emoji="💰" label="Cobrado este mes" value={fmt(totalCobrado)} color="#16a34a" bg="#f0fdf4"
          sub={`de ${fmt(totalEsperado)} esperado`}/>
        <KpiCard emoji="🌓" label="1ª quincena"
          value={fmt(q1.cobradoPeriodo)} color="#0891b2" bg="#ecfeff"
          sub={q1.cobradoPeriodo>0?`Sobrante: ${fmt(q1.sobrante)}`:'Sin cobrar aún'}/>
        <KpiCard emoji="🌕" label="2ª quincena"
          value={fmt(q2.cobradoPeriodo)} color="#7c3aed" bg="#f5f3ff"
          sub={q2.cobradoPeriodo>0?`Sobrante: ${fmt(q2.sobrante)}`:'Sin cobrar aún'}/>
        <KpiCard emoji="📆" label="Obligaciones mes"
          value={fmt(q1.totalObligaciones+q2.totalObligaciones)} color="#ef4444" bg="#fef2f2"
          sub={`${q1.obligaciones.length+q2.obligaciones.length} pagos comprometidos`}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:22}}>

        {/* ── INGRESOS ── */}
        <FlujoCajaPanel
          titulo="💰 Ingresos por cobrar"
          items={buildCobroItems()}
          colorPend="#16a34a"
          colorPag="#16a34a"
          bgPend="#f0fdf4"
          borderPag="#86efac"
          renderPendiente={(item) => (
            <div key={item.id}>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,background:'white',border:'1.5px solid var(--border)'}}>
                <div style={{width:16,height:16,borderRadius:4,flexShrink:0,border:'1.5px solid #86efac',background:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:8,color:'#86efac'}}>○</span>
                </div>
                <span style={{fontSize:12,flexShrink:0}}>{item.tipoInfo.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</div>
                  <div style={{fontSize:9,color:'var(--text3)'}}>día {item.dia}</div>
                </div>
                <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:12,color:item.tipoInfo.color,flexShrink:0,marginRight:6}}>{fmt(item.monto)}</div>
                <button onClick={()=>abrirCobro(item.rec, item.periodo)}
                  style={{fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:6,border:'none',background:'#16a34a',color:'white',cursor:'pointer',whiteSpace:'nowrap'}}>
                  Cobrar
                </button>
              </div>
              {cobrandoId===item.rec.id && cobrandoPeriodo===item.periodo && (
                <div style={{marginTop:6,background:'white',borderRadius:10,padding:'12px 14px',border:'1.5px solid #86efac'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'flex-end'}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--text2)',marginBottom:4}}>Monto cobrado</div>
                      <div style={{position:'relative'}}>
                        <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontFamily:'Nunito',fontWeight:900,fontSize:12,color:'#16a34a'}}>S/.</span>
                        <input type="number" value={montoCobro} onChange={e=>setMontoCobro(e.target.value)} autoFocus min="0" step="0.01"
                          style={{width:'100%',padding:'7px 8px 7px 30px',background:'var(--bg)',border:'1.5px solid #86efac',borderRadius:8,fontSize:13,fontWeight:700,color:'#16a34a',fontFamily:'Poppins',outline:'none',boxSizing:'border-box'}}/>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:5}}>
                      <button onClick={confirmarCobro} disabled={loadingCobro}
                        style={{padding:'7px 12px',background:'#16a34a',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        {loadingCobro?'...':'✅'}
                      </button>
                      <button onClick={()=>{setCobrandoId(null);setCobrandoPeriodo(null)}}
                        style={{padding:'7px 9px',background:'white',border:'1.5px solid var(--border)',borderRadius:8,fontSize:12,cursor:'pointer'}}>✕</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          renderPagado={(item) => (
            <div key={item.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:8,background:'#f0fdf4',border:'1px solid #86efac'}}>
              <span style={{fontSize:11}}>✅</span>
              <span style={{fontSize:12,flexShrink:0}}>{item.tipoInfo.emoji}</span>
              <div style={{flex:1,fontSize:11,fontWeight:600,color:'#166534',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</div>
              <div style={{fontFamily:'Nunito',fontWeight:700,fontSize:11,color:'#16a34a',flexShrink:0}}>{fmt(item.monto)}</div>
              <button onClick={()=>anularCobro(item.cobroObj)}
                style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:6,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',cursor:'pointer',whiteSpace:'nowrap'}}>
                Anular
              </button>
            </div>
          )}
          headerExtra={<button onClick={()=>setModalRec(true)} style={btnPrimario('#16a34a')}>+ Agregar</button>}
        />

        {/* ── PAGOS ── */}
        <FlujoCajaPanel
          titulo="💳 Pagos recurrentes"
          items={buildPagoItems()}
          colorPend="#dc2626"
          colorPag="#16a34a"
          bgPend="#fef2f2"
          borderPag="#86efac"
          renderPendiente={(item) => (
            <div key={item.id} onClick={()=>marcarPagoRec(item.dr, item.monto, item.quincena)}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,background:'white',border:'1.5px solid var(--border)',cursor:'pointer'}}>
              <div style={{width:16,height:16,borderRadius:4,flexShrink:0,border:'1.5px solid #fca5a5',background:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:8,color:'#fca5a5'}}>○</span>
              </div>
              <span style={{fontSize:12,flexShrink:0}}>{item.tipoInfo.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</div>
                <div style={{fontSize:9,color:'var(--text3)'}}>día {item.dia}</div>
              </div>
              <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:12,color:item.tipoInfo.color,flexShrink:0}}>{fmt(item.monto)}</div>
            </div>
          )}
          renderPagado={(item) => (
            <div key={item.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:8,background:'#f0fdf4',border:'1px solid #86efac'}}>
              <span style={{fontSize:11}}>✅</span>
              <span style={{fontSize:12,flexShrink:0}}>{item.tipoInfo.emoji}</span>
              <div style={{flex:1,fontSize:11,fontWeight:600,color:'#166534',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</div>
              <div style={{fontFamily:'Nunito',fontWeight:700,fontSize:11,color:'#16a34a',flexShrink:0}}>{fmt(item.monto)}</div>
              <button onClick={()=>anularPagoRec(item.pagoObj)}
                style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:6,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',cursor:'pointer',whiteSpace:'nowrap'}}>
                Anular
              </button>
            </div>
          )}
          headerExtra={<button onClick={()=>setModalDeudaRec(true)} style={btnPrimario('#dc2626')}>+ Agregar</button>}
        />

      </div>

      {/* ── Configuración: ingresos y obligaciones ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <ConfigPanel titulo="⚙️ Ingresos configurados" onAdd={()=>setModalRec(true)} labelAdd="+ Ingreso fijo">
          {recurrentes.map(rec => {
            const tipoInfo = TIPOS_INGRESO_REC.find(t=>t.valor===rec.tipo)||{emoji:'💰',color:'#16a34a'}
            return (
              <div key={rec.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:'var(--bg)',border:'1px solid var(--border)'}}>
                <span style={{fontSize:13}}>{tipoInfo.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{rec.nombre}</div>
                  <div style={{fontSize:9,color:'var(--text3)'}}>{rec.frecuencia==='quincenal'?`Quincenal · día ${rec.dia_pago_1} y ${rec.dia_pago_2||30}`:`Mensual · día ${rec.dia_pago_1||30}`} · {fmt(rec.monto_total)}</div>
                </div>
                <button onClick={()=>setEditandoRec(rec)} style={btnIcono('#7c3aed')}>✏️</button>
                <button onClick={()=>eliminarRecurrente(rec.id)} style={btnIcono('#dc2626')}>🗑️</button>
              </div>
            )
          })}
        </ConfigPanel>
        <ConfigPanel titulo="⚙️ Pagos configurados" onAdd={()=>setModalDeudaRec(true)} labelAdd="+ Obligación">
          {deudasRec.map(deuda => {
            const tipoInfo = TIPOS_DEUDA_REC.find(t=>t.valor===deuda.tipo)||{emoji:'💳',color:'#7c3aed'}
            return (
              <div key={deuda.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:'var(--bg)',border:'1px solid var(--border)'}}>
                <span style={{fontSize:13}}>{tipoInfo.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{deuda.nombre}</div>
                  <div style={{fontSize:9,color:'var(--text3)'}}>{deuda.frecuencia==='quincenal'?`Quincenal · día ${deuda.dia_pago_1} y ${deuda.dia_pago_2||30}`:`Mensual · día ${deuda.dia_pago_1||1}`} · {fmtDeuda(deuda.monto_total)}</div>
                </div>
                <button onClick={()=>setEditandoDeudaRec(deuda)} style={btnIcono('#7c3aed')}>✏️</button>
                <button onClick={()=>eliminarDeudaRec(deuda.id)} style={btnIcono('#dc2626')}>🗑️</button>
              </div>
            )
          })}
        </ConfigPanel>
      </div>

      {/* Modales */}
      {modalRec&&<IngresoRecurrenteForm usuarioId={usuarioId} onClose={()=>setModalRec(false)} onGuardado={cargar}/>}
      {editandoRec&&<IngresoRecurrenteForm usuarioId={usuarioId} registro={editandoRec} onClose={()=>setEditandoRec(null)} onGuardado={cargar}/>}
      {modalDeudaRec&&<DeudaRecurrenteForm usuarioId={usuarioId} onClose={()=>setModalDeudaRec(false)} onGuardado={cargar}/>}
      {editandoDeudaRec&&<DeudaRecurrenteForm usuarioId={usuarioId} registro={editandoDeudaRec} onClose={()=>setEditandoDeudaRec(null)} onGuardado={cargar}/>}
    </div>
  )
}

// ── Panel flujo: pendientes expandidos, pagados comprimidos ──
function FlujoCajaPanel({ titulo, items, renderPendiente, renderPagado, headerExtra }) {
  const [verPagados, setVerPagados] = useState(false)
  const pendientes = items.filter(i => !(i.cobrado ?? i.pagado))
  const pagados    = items.filter(i =>  (i.cobrado ?? i.pagado))
  return (
    <div style={{background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'16px 18px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:14}}>{titulo}</div>
        {headerExtra}
      </div>
      {items.length === 0
        ? <div style={{textAlign:'center',padding:'20px 0',fontSize:12,color:'var(--text3)'}}>Sin items configurados</div>
        : <>
            {pendientes.length === 0
              ? <div style={{textAlign:'center',padding:'12px 0',fontSize:12,color:'#16a34a',fontWeight:600}}>✅ Todo al día este mes</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:pagados.length?10:0}}>
                  {pendientes.map(item => renderPendiente(item))}
                </div>
            }
            {pagados.length > 0 && (
              <>
                <button onClick={()=>setVerPagados(v=>!v)}
                  style={{width:'100%',padding:'5px 0',fontSize:10,fontWeight:700,color:'#16a34a',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:7,cursor:'pointer',marginBottom:verPagados?8:0}}>
                  {verPagados ? '▲ Ocultar' : `✅ Ver hechos (${pagados.length})`}
                </button>
                {verPagados && (
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {pagados.map(item => renderPagado(item))}
                  </div>
                )}
              </>
            )}
          </>
      }
    </div>
  )
}

function ConfigPanel({ titulo, onAdd, labelAdd, children }) {
  const [open, setOpen] = useState(false)
  const count = Array.isArray(children) ? children.length : (children ? 1 : 0)
  return (
    <div style={{background:'white',borderRadius:14,border:'1.5px solid var(--border)',overflow:'hidden'}}>
      <div onClick={()=>setOpen(v=>!v)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',cursor:'pointer',background:'var(--bg)'}}>
        <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:13}}>{titulo} <span style={{fontSize:11,color:'var(--text3)',fontWeight:600}}>({count})</span></div>
        <span style={{fontSize:12,color:'var(--text3)'}}>{open?'▲':'▼'}</span>
      </div>
      {open && (
        <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:6}}>
          {count===0
            ? <div style={{textAlign:'center',padding:'12px 0',fontSize:12,color:'var(--text3)'}}>Sin items</div>
            : children
          }
          <button onClick={onAdd} style={{...btnPrimario('#6c63ff'),marginTop:4,fontSize:11}}>{labelAdd}</button>
        </div>
      )}
    </div>
  )
}

function KpiCard({emoji,label,value,color,bg,sub}) {
  return (
    <div style={{background:bg,borderRadius:14,border:`1.5px solid ${color}30`,padding:18}}>
      <div style={{fontSize:22,marginBottom:6}}>{emoji}</div>
      <div style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3}}>{label}</div>
      <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:18,color,letterSpacing:'-0.5px',marginBottom:3}}>{value}</div>
      <div style={{fontSize:11,fontWeight:600,color:`${color}90`}}>{sub}</div>
    </div>
  )
}

const btnPrimario=color=>({padding:'8px 16px',borderRadius:9,border:'none',background:color,color:'white',fontFamily:'Poppins',fontWeight:700,fontSize:12,cursor:'pointer',boxShadow:`0 2px 8px ${color}30`})
const btnIcono=color=>({padding:'5px 9px',borderRadius:7,background:`${color}10`,border:`1.5px solid ${color}30`,color,cursor:'pointer',fontSize:12})