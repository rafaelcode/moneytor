import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, PERIODOS, MESES,
  proximaFechaCobro, diasHastaCobro,
  periodoDeObligacion, rangoPeriodo,
  TIPOS_INGRESO_REC,
} from '../lib/flujoRecurrenteUtils'
import IngresoRecurrenteForm from '../components/IngresoRecurrenteForm'

export default function FlujoCaja({ usuarioId }) {
  const hoy   = new Date()
  const [mes,  setMes]  = useState(hoy.getMonth()+1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  // Datos
  const [recurrentes,  setRecurrentes]  = useState([])
  const [cobros,       setCobros]       = useState([])
  const [deudas,       setDeudas]       = useState([])
  const [cargando,     setCargando]     = useState(true)

  // Modales
  const [modalRec,     setModalRec]     = useState(false)
  const [editandoRec,  setEditandoRec]  = useState(null)
  const [cobrandoId,   setCobrandoId]   = useState(null)   // id ingreso recurrente
  const [cobrandoPeriodo, setCobrandoPeriodo] = useState(null)
  const [montoCobro,   setMontoCobro]   = useState('')
  const [notasCobro,   setNotasCobro]   = useState('')
  const [loadingCobro, setLoadingCobro] = useState(false)

  const periodoActual = hoy.getDate()<=15 ? 'quincena_1' : 'quincena_2'

  useEffect(()=>{ cargar() },[mes,anio])

  async function cargar() {
    setCargando(true)
    const m = String(mes).padStart(2,'0')
    const ult = new Date(anio,mes,0).getDate()
    const desde = `${anio}-${m}-01`
    const hasta = `${anio}-${m}-${ult}`

    const [recRes, cobrosRes, deudasRes] = await Promise.all([
      supabase.from('ingresos_recurrentes').select('*').eq('usuario_id',usuarioId).eq('activo',true),
      supabase.from('cobros').select('*').eq('usuario_id',usuarioId).gte('fecha_cobro',desde).lte('fecha_cobro',hasta).order('fecha_cobro',{ascending:false}),
      supabase.from('deudas').select('*').eq('usuario_id',usuarioId).eq('estado','activa'),
    ])
    setRecurrentes(recRes.data||[])
    setCobros(cobrosRes.data||[])
    setDeudas(deudasRes.data||[])
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

  // ── Calcular estado por período ───────────────────────────
  function estadoPeriodo(periodo) {
    const { desde, hasta } = rangoPeriodo(mes, anio, periodo)
    const cobradoPeriodo = cobros
      .filter(c=>c.periodo===periodo||(!c.periodo&&periodo==='mes_completo'))
      .reduce((s,c)=>s+Number(c.monto),0)

    // Obligaciones del período
    const obligaciones = deudas.filter(d=>{
      const p = periodoDeObligacion(d.dia_pago_mes)
      return p===periodo||periodo==='mes_completo'
    })
    const totalObligaciones = obligaciones.reduce((s,d)=>s+Number(d.monto_cuota||d.monto_pendiente||0),0)
    const sobrante = cobradoPeriodo - totalObligaciones

    return { cobradoPeriodo, obligaciones, totalObligaciones, sobrante }
  }

  // ── Resumen mes ───────────────────────────────────────────
  const totalCobrado = cobros.reduce((s,c)=>s+Number(c.monto),0)
  const totalEsperado= recurrentes.reduce((s,r)=>s+Number(r.monto_total),0)
  const q1 = estadoPeriodo('quincena_1')
  const q2 = estadoPeriodo('quincena_2')

  const cobroDeRec = (recId, periodo) =>
    cobros.find(c=>c.ingreso_recurrente_id===recId && c.periodo===periodo)

  return (
    <div style={{padding:28}}>

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

      {/* ── Ingresos recurrentes configurados ── */}
      <div style={{background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'18px 20px',marginBottom:22,boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:15}}>💼 Mis ingresos fijos</div>
          <button onClick={()=>setModalRec(true)} style={btnPrimario('#16a34a')}>
            + Agregar ingreso fijo
          </button>
        </div>

        {recurrentes.length===0 ? (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:36,marginBottom:8}}>💼</div>
            <div style={{fontSize:13,color:'var(--text3)',marginBottom:12}}>
              Configura tus ingresos fijos (sueldo, honorarios) para gestionar tus quincenas.
            </div>
            <button onClick={()=>setModalRec(true)} style={btnPrimario('#16a34a')}>
              💰 Configurar primer ingreso
            </button>
          </div>
        ) : recurrentes.map(rec=>{
          const tipoInfo = TIPOS_INGRESO_REC.find(t=>t.valor===rec.tipo)||{emoji:'💰',color:'#16a34a'}
          const proxFecha= proximaFechaCobro(rec)
          const diasRest = diasHastaCobro(proxFecha)
          const esHoy    = diasRest===0
          const esMañana = diasRest===1
          const cobQ1    = cobroDeRec(rec.id,'quincena_1')
          const cobQ2    = cobroDeRec(rec.id,'quincena_2')
          const cobMes   = cobroDeRec(rec.id,'mes_completo')

          return (
            <div key={rec.id} style={{
              borderRadius:14,border:'1.5px solid var(--border)',
              padding:'14px 16px',marginBottom:12,
              background: esHoy?'#f0fdf4':'var(--bg)',
              borderColor: esHoy?'#86efac':'var(--border)',
            }}>
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                <div style={{
                  width:44,height:44,borderRadius:12,flexShrink:0,
                  background:`${tipoInfo.color}15`,display:'flex',
                  alignItems:'center',justifyContent:'center',fontSize:20,
                  border:`1.5px solid ${tipoInfo.color}30`,
                }}>{tipoInfo.emoji}</div>

                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                    <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:15}}>{rec.nombre}</span>
                    {rec.empleador&&<span style={{fontSize:11,color:'var(--text3)'}}>🏢 {rec.empleador}</span>}
                    {esHoy&&<span style={{fontSize:11,fontWeight:800,color:'#16a34a',background:'#f0fdf4',padding:'2px 8px',borderRadius:20,border:'1.5px solid #86efac'}}>⚡ HOY ES DÍA DE COBRO</span>}
                    {esMañana&&<span style={{fontSize:11,fontWeight:700,color:'#d97706',background:'#fffbeb',padding:'2px 8px',borderRadius:20}}>⏰ Mañana cobras</span>}
                  </div>

                  <div style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>
                    {rec.frecuencia==='quincenal'
                      ? `Quincenal: día ${rec.dia_pago_1} y día ${rec.dia_pago_2||30} · Total ${fmt(rec.monto_total)}/mes`
                      : `${rec.frecuencia==='mensual'?'Mensual':'Irregular'} · ${fmt(rec.monto_total)}/mes`
                    }
                  </div>

                  {/* Quincenas */}
                  {rec.frecuencia==='quincenal' ? (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {[
                        {periodo:'quincena_1',label:'1ª quincena',monto:rec.monto_pago_1,dia:rec.dia_pago_1,color:'#0891b2',cobrado:cobQ1},
                        {periodo:'quincena_2',label:'2ª quincena',monto:rec.monto_pago_2,dia:rec.dia_pago_2,color:'#7c3aed',cobrado:cobQ2},
                      ].map(q=>(
                        <div key={q.periodo} style={{
                          background:'white',borderRadius:11,padding:'10px 12px',
                          border:`1.5px solid ${q.cobrado?q.color+'50':'var(--border)'}`,
                        }}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                            <span style={{fontSize:11,fontWeight:700,color:q.color}}>{q.label} (día {q.dia})</span>
                            {q.cobrado && <span style={{fontSize:10,fontWeight:700,color:'#16a34a',background:'#f0fdf4',padding:'1px 6px',borderRadius:20}}>✓ Cobrado</span>}
                          </div>
                          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:16,color:q.cobrado?'#16a34a':q.color,marginBottom:6}}>
                            {fmt(q.monto||0)}
                          </div>
                          {q.cobrado ? (
                            <div style={{fontSize:11,color:'var(--text3)'}}>
                              {fmtFecha(q.cobrado.fecha_cobro)}
                              {q.cobrado.notas&&<> · {q.cobrado.notas}</>}
                            </div>
                          ) : (
                            <button
                              onClick={()=>abrirCobro(rec,q.periodo)}
                              style={{
                                width:'100%',padding:'6px',borderRadius:8,border:'none',
                                background:q.color,color:'white',
                                fontFamily:'Poppins',fontWeight:700,fontSize:11,cursor:'pointer',
                              }}>
                              💸 Cobrar {q.label.toLowerCase()}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {cobMes ? (
                        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:10,padding:'7px 12px'}}>
                          <span style={{fontSize:13,fontWeight:700,color:'#16a34a'}}>✓ Cobrado el {fmtFecha(cobMes.fecha_cobro)}</span>
                          <span style={{fontSize:13,fontFamily:'Nunito',fontWeight:900,color:'#16a34a'}}>{fmt(cobMes.monto)}</span>
                        </div>
                      ) : (
                        <button onClick={()=>abrirCobro(rec,'mes_completo')} style={btnPrimario(tipoInfo.color)}>
                          💸 Registrar cobro
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:18,color:tipoInfo.color}}>{fmt(rec.monto_total)}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>/mes</div>
                  {proxFecha&&<div style={{fontSize:11,fontWeight:600,color:diasRest<=3?'#dc2626':diasRest<=7?'#d97706':'var(--text3)',marginTop:4}}>
                    {diasRest===0?'⚡ Hoy':diasRest===1?'⏰ Mañana':`${diasRest}d`}
                  </div>}
                  <div style={{display:'flex',gap:5,marginTop:8,justifyContent:'flex-end'}}>
                    <button onClick={()=>setEditandoRec(rec)} style={btnIcono('#7c3aed')}>✏️</button>
                    <button onClick={()=>eliminarRecurrente(rec.id)} style={btnIcono('#dc2626')}>🗑️</button>
                  </div>
                </div>
              </div>

              {/* Panel cobro */}
              {cobrandoId===rec.id && (
                <div style={{marginTop:14,background:'white',borderRadius:12,padding:'14px 16px',border:'1.5px solid #86efac'}}>
                  <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:14,color:'#16a34a',marginBottom:12}}>
                    💸 Registrar cobro — {PERIODOS[cobrandoPeriodo]?.label||cobrandoPeriodo}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'flex-end'}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:6}}>Monto cobrado</div>
                      <div style={{position:'relative'}}>
                        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontFamily:'Nunito',fontWeight:900,fontSize:13,color:'#16a34a'}}>S/.</span>
                        <input type="number" value={montoCobro} onChange={e=>setMontoCobro(e.target.value)}
                          min="0" step="0.01" autoFocus
                          style={{width:'100%',padding:'9px 10px 9px 36px',background:'var(--bg)',border:'1.5px solid #86efac',borderRadius:10,fontSize:15,fontWeight:700,color:'#16a34a',fontFamily:'Poppins',outline:'none',boxSizing:'border-box'}}/>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:6}}>Notas (opcional)</div>
                      <input value={notasCobro} onChange={e=>setNotasCobro(e.target.value)}
                        placeholder="Ej: con descuentos de ley"
                        style={{width:'100%',padding:'9px 10px',background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:10,fontSize:12,fontFamily:'Poppins',outline:'none',boxSizing:'border-box'}}/>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={confirmarCobro} disabled={loadingCobro} style={{padding:'9px 14px',background:'#16a34a',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                        {loadingCobro?'...':'✅ Confirmar'}
                      </button>
                      <button onClick={()=>{setCobrandoId(null);setCobrandoPeriodo(null)}} style={{padding:'9px 10px',background:'white',border:'1.5px solid var(--border)',borderRadius:10,fontSize:13,cursor:'pointer'}}>✕</button>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:8}}>
                    💡 Esto creará una transacción de ingreso y quedará en tu historial.
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Panel de obligaciones por quincena ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:22}}>
        {['quincena_1','quincena_2'].map(p=>{
          const info = PERIODOS[p]
          const est  = estadoPeriodo(p)
          const cobradoEstePeriodo = cobros.filter(c=>c.periodo===p).reduce((s,c)=>s+Number(c.monto),0)
          return (
            <div key={p} style={{background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'18px 20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{fontSize:20}}>{info.emoji}</span>
                <div>
                  <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:14,color:info.color}}>{info.label}</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>Días {info.rango} del mes</div>
                </div>
              </div>

              {/* Balance */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                <div style={{background:'#f0fdf4',borderRadius:10,padding:10,border:'1.5px solid #86efac'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#166534',marginBottom:2}}>COBRADO</div>
                  <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:16,color:'#16a34a'}}>{fmt(cobradoEstePeriodo)}</div>
                </div>
                <div style={{background:'#fef2f2',borderRadius:10,padding:10,border:'1.5px solid #fecaca'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#991b1b',marginBottom:2}}>OBLIGACIONES</div>
                  <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:16,color:'#dc2626'}}>{fmt(est.totalObligaciones)}</div>
                </div>
              </div>

              {/* Sobrante */}
              <div style={{
                background:est.sobrante>=0?'#f0fdf4':'#fef2f2',
                border:`1.5px solid ${est.sobrante>=0?'#86efac':'#fca5a5'}`,
                borderRadius:10,padding:'8px 12px',marginBottom:14,
                display:'flex',alignItems:'center',justifyContent:'space-between',
              }}>
                <span style={{fontSize:12,fontWeight:700,color:est.sobrante>=0?'#166534':'#991b1b'}}>
                  {est.sobrante>=0?'✅ Sobrante':'⚠️ Falta'}
                </span>
                <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:16,color:est.sobrante>=0?'#16a34a':'#dc2626'}}>
                  {fmt(Math.abs(est.sobrante))}
                </span>
              </div>

              {/* Obligaciones del período */}
              {est.obligaciones.length===0 ? (
                <div style={{fontSize:12,color:'var(--text3)',textAlign:'center',padding:'8px 0'}}>Sin obligaciones en este período</div>
              ) : est.obligaciones.map(d=>(
                <div key={d.id} style={{
                  display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'8px 10px',borderRadius:9,marginBottom:6,
                  background:'var(--bg)',border:'1px solid var(--border)',
                }}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700}}>{d.nombre}</div>
                    <div style={{fontSize:10,color:'var(--text3)'}}>
                      Día {d.dia_pago_mes} · {d.tipo?.replace('_',' ')}
                    </div>
                  </div>
                  <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:14,color:'#dc2626'}}>
                    {fmt(d.monto_cuota||d.monto_pendiente)}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* ── Historial de cobros del mes ── */}
      {cobros.length>0&&(
        <div style={{background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'18px 20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:15,marginBottom:14}}>
            📋 Historial de cobros — {MESES[mes-1]} {anio}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {cobros.map(c=>{
              const p=PERIODOS[c.periodo]||{emoji:'📅',label:c.periodo,color:'#16a34a'}
              return (
                <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 12px',borderRadius:10,background:'var(--bg)',border:'1px solid var(--border)'}}>
                  <span style={{fontSize:16}}>{p.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700}}>{c.nombre}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>
                      {p.label} · {fmtFecha(c.fecha_cobro)}
                      {c.notas&&<> · {c.notas}</>}
                    </div>
                  </div>
                  <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:16,color:'#16a34a'}}>
                    +{fmt(c.monto)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modales */}
      {modalRec&&<IngresoRecurrenteForm usuarioId={usuarioId} onClose={()=>setModalRec(false)} onGuardado={cargar}/>}
      {editandoRec&&<IngresoRecurrenteForm usuarioId={usuarioId} registro={editandoRec} onClose={()=>setEditandoRec(null)} onGuardado={cargar}/>}
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
