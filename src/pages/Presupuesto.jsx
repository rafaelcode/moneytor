import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtDec, MESES, CAT_MAP, CATS_PRESUPUESTO,
  estadoLinea, saludPresupuesto,
} from '../lib/presupuestoUtils'
import PlantillaForm  from '../components/PlantillaForm'
import AsignarMesForm from '../components/AsignarMesForm'

export default function Presupuesto({ usuarioId }) {
  const hoy  = new Date()
  const [tab,   setTab]   = useState('dashboard')   // 'dashboard' | 'plantillas'
  const [mes,   setMes]   = useState(hoy.getMonth() + 1)
  const [anio,  setAnio]  = useState(hoy.getFullYear())

  // Dashboard
  const [presMes,      setPresMes]      = useState(null)   // presupuesto_mes row
  const [lineasMes,    setLineasMes]    = useState([])     // presupuesto_mes_lineas + gastado cruzado
  const [cargandoDash, setCargandoDash] = useState(true)
  const [modalAsignar, setModalAsignar] = useState(false)

  // Plantillas
  const [plantillas,     setPlantillas]     = useState([])
  const [cargandoPlant,  setCargandoPlant]  = useState(true)
  const [modalPlantilla, setModalPlantilla] = useState(false)
  const [editandoPlant,  setEditandoPlant]  = useState(null)

  useEffect(() => { cargarDashboard() }, [mes, anio])
  useEffect(() => { if (tab==='plantillas') cargarPlantillas() }, [tab])

  // ── Cargar dashboard del mes ──────────────────────────────
  async function cargarDashboard() {
    setCargandoDash(true)

    // 1. Presupuesto del mes
    const { data: pm } = await supabase
      .from('presupuesto_mes').select('*, presupuesto_plantillas(nombre)')
      .eq('usuario_id', usuarioId).eq('mes', mes).eq('anio', anio)
      .single()

    if (!pm) {
      setPresMes(null); setLineasMes([]); setCargandoDash(false); return
    }
    setPresMes(pm)

    // 2. Líneas del mes
    const { data: lineas } = await supabase
      .from('presupuesto_mes_lineas').select('*')
      .eq('presupuesto_id', pm.id).order('orden')

    // 3. Gastos reales del mes por categoría
    const m = String(mes).padStart(2,'0')
    const ultimo = new Date(anio, mes, 0).getDate()
    const { data: txs } = await supabase
      .from('transacciones').select('categoria, monto')
      .eq('usuario_id', usuarioId).eq('tipo', 'gasto')
      .gte('fecha', `${anio}-${m}-01`).lte('fecha', `${anio}-${m}-${ultimo}`)

    // 4. Cruzar
    const gastosXCat = {}
    ;(txs || []).forEach(t => {
      gastosXCat[t.categoria] = (gastosXCat[t.categoria] || 0) + Number(t.monto)
    })

    const lineasCruzadas = (lineas || []).map(l => ({
      ...l,
      gastado: gastosXCat[l.categoria] || 0,
    }))

    // 5. Categorías con gasto pero sin línea en el presupuesto
    const catsConGasto = Object.keys(gastosXCat).filter(
      cat => !(lineas || []).some(l => l.categoria === cat)
    )
    const sinPresupuesto = catsConGasto.map(cat => ({
      categoria: cat, monto_limite: 0, gastado: gastosXCat[cat], sinLimite: true,
    }))

    setLineasMes([...lineasCruzadas, ...sinPresupuesto])
    setCargandoDash(false)
  }

  async function cargarPlantillas() {
    setCargandoPlant(true)
    const { data } = await supabase
      .from('presupuesto_plantillas').select('*, presupuesto_lineas(*)')
      .eq('usuario_id', usuarioId).order('creado_en')
    setPlantillas(data || [])
    setCargandoPlant(false)
  }

  async function eliminarPlantilla(id) {
    if (!confirm('¿Eliminar esta plantilla? Los meses que la usen no se verán afectados.')) return
    await supabase.from('presupuesto_plantillas').delete().eq('id', id)
    cargarPlantillas()
  }

  async function eliminarPresMes() {
    if (!confirm(`¿Eliminar el presupuesto de ${MESES[mes-1]}?`)) return
    await supabase.from('presupuesto_mes').delete().eq('id', presMes.id)
    cargarDashboard()
  }

  // ── Salud ────────────────────────────────────────────────
  const salud        = saludPresupuesto(lineasMes.filter(l => !l.sinLimite))
  const totalGastado = lineasMes.reduce((s,l) => s + Number(l.gastado||0), 0)
  const ahorro_mes   = salud.totalLimite - salud.totalGastado

  return (
    <div style={{ padding:28 }}>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:6, marginBottom:22, borderBottom:'2px solid var(--border)', paddingBottom:0 }}>
        {[
          { v:'dashboard', label:'📊 Dashboard del mes' },
          { v:'plantillas', label:'📋 Mis plantillas' },
        ].map(t => (
          <div key={t.v} onClick={() => setTab(t.v)} style={{
            padding:'10px 18px', cursor:'pointer', fontSize:13, fontWeight:700,
            borderBottom:`3px solid ${tab===t.v ? '#6c63ff':'transparent'}`,
            color: tab===t.v ? '#6c63ff' : 'var(--text2)',
            transition:'all 0.15s', marginBottom:-2,
          }}>{t.label}</div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: DASHBOARD DEL MES
      ══════════════════════════════════════════════════════ */}
      {tab === 'dashboard' && (
        <div>
          {/* Navegación mes */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={() => { let m=mes-1,a=anio; if(m<1){m=12;a-=1}; setMes(m);setAnio(a) }} style={btnNav}>‹</button>
              <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, minWidth:150, textAlign:'center' }}>
                {MESES[mes-1]} {anio}
              </div>
              <button onClick={() => { let m=mes+1,a=anio; if(m>12){m=1;a+=1}; setMes(m);setAnio(a) }} style={btnNav}>›</button>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              {presMes && (
                <button onClick={eliminarPresMes} style={{ ...btnSec, color:'#dc2626', borderColor:'#fecaca' }}>
                  🗑️ Quitar presupuesto
                </button>
              )}
              <button onClick={() => setModalAsignar(true)} style={{
                background:'#6c63ff', color:'white', border:'none',
                borderRadius:10, padding:'9px 16px', fontSize:13,
                fontWeight:700, cursor:'pointer', fontFamily:'Poppins',
                boxShadow:'0 3px 10px rgba(108,99,255,0.3)',
              }}>
                {presMes ? '🔄 Cambiar plantilla' : '📅 Asignar plantilla'}
              </button>
            </div>
          </div>

          {cargandoDash ? (
            <Cargando />
          ) : !presMes ? (
            <SinPresupuesto mes={MESES[mes-1]} anio={anio} onAsignar={() => setModalAsignar(true)} onPlantillas={() => setTab('plantillas')} />
          ) : (
            <>
              {/* ── KPIs del mes ── */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
                <KpiCard emoji="📋" label="Plantilla activa"
                  value={presMes.presupuesto_plantillas?.nombre || '—'}
                  color="#6c63ff" bg="#f5f3ff"
                  sub={`${lineasMes.filter(l=>!l.sinLimite).length} categorías presupuestadas`} />
                <KpiCard emoji="💰" label="Presupuesto total"
                  value={fmt(salud.totalLimite)} color="#0891b2" bg="#ecfeff"
                  sub={`Límite para ${MESES[mes-1]}`} />
                <KpiCard emoji="↓" label="Gastado hasta hoy"
                  value={fmt(totalGastado)} color={salud.pct>=100?'#dc2626':salud.pct>=80?'#d97706':'#16a34a'}
                  bg={salud.pct>=100?'#fef2f2':salud.pct>=80?'#fffbeb':'#f0fdf4'}
                  sub={`${salud.pct.toFixed(1)}% del presupuesto`} />
                <KpiCard emoji={ahorro_mes>=0?'💚':'⚠️'} label="Margen restante"
                  value={fmt(Math.abs(ahorro_mes))}
                  color={ahorro_mes>=0?'#16a34a':'#dc2626'}
                  bg={ahorro_mes>=0?'#f0fdf4':'#fef2f2'}
                  sub={ahorro_mes>=0 ? 'Disponible para el resto del mes' : 'Has excedido el presupuesto'} />
              </div>

              {/* ── Barra de progreso global ── */}
              <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'16px 20px', marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontFamily:'Nunito', fontWeight:800, fontSize:14 }}>
                    Progreso global del mes
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color: salud.excedidas>0?'#dc2626':'var(--text3)' }}>
                    {salud.excedidas>0 ? `⚠️ ${salud.excedidas} categoría${salud.excedidas!==1?'s':''} excedida${salud.excedidas!==1?'s':''}` : '✅ Dentro del presupuesto'}
                  </span>
                </div>
                <div style={{ height:14, background:'var(--bg)', borderRadius:999, overflow:'hidden', border:'1px solid var(--border)', marginBottom:8 }}>
                  <div style={{
                    height:'100%',
                    width:`${Math.min(salud.pct, 100)}%`,
                    background: salud.pct>=100?'#dc2626':salud.pct>=80?'#d97706':'#16a34a',
                    borderRadius:999, transition:'width 0.6s',
                    position:'relative',
                  }}>
                    {salud.pct>20 && (
                      <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:10, fontWeight:800, color:'white' }}>
                        {salud.pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text3)' }}>
                  <span>Gastado: <strong style={{ color:'var(--text)' }}>{fmt(totalGastado)}</strong></span>
                  <span>Límite: <strong style={{ color:'var(--text)' }}>{fmt(salud.totalLimite)}</strong></span>
                </div>
              </div>

              {/* ── Líneas por categoría ── */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {/* Categorías presupuestadas */}
                {lineasMes.filter(l => !l.sinLimite).map((l, i) => {
                  const cat    = CAT_MAP[l.categoria] || { emoji:'📌', label:l.categoria, color:'#64748b' }
                  const est    = estadoLinea(l.gastado, l.monto_limite)
                  const resto  = Number(l.monto_limite) - Number(l.gastado)
                  return (
                    <LineaCard key={i} cat={cat} l={l} est={est} resto={resto} />
                  )
                })}

                {/* Gastos sin categoría presupuestada */}
                {lineasMes.filter(l => l.sinLimite).length > 0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#d97706', marginBottom:8 }}>
                      ⚠️ Gastos en categorías sin límite definido
                    </div>
                    {lineasMes.filter(l => l.sinLimite).map((l, i) => {
                      const cat = CAT_MAP[l.categoria] || { emoji:'📌', label:l.categoria, color:'#64748b' }
                      return (
                        <div key={i} style={{
                          background:'#fffbeb', borderRadius:14, border:'1.5px solid #fde68a',
                          padding:'14px 18px', marginBottom:8,
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:20 }}>{cat.emoji}</span>
                            <div>
                              <div style={{ fontWeight:700, fontSize:13 }}>{cat.label}</div>
                              <div style={{ fontSize:11, color:'#92400e' }}>Sin límite en el presupuesto de este mes</div>
                            </div>
                          </div>
                          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, color:'#d97706' }}>
                            {fmt(l.gastado)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: PLANTILLAS
      ══════════════════════════════════════════════════════ */}
      {tab === 'plantillas' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:18 }}>
            <button onClick={() => setModalPlantilla(true)} style={{
              background:'#6c63ff', color:'white', border:'none',
              borderRadius:10, padding:'9px 18px', fontSize:13,
              fontWeight:700, cursor:'pointer', fontFamily:'Poppins',
              boxShadow:'0 3px 10px rgba(108,99,255,0.3)',
            }}>+ Nueva plantilla</button>
          </div>

          {cargandoPlant ? <Cargando /> : plantillas.length===0 ? (
            <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'52px 24px', textAlign:'center' }}>
              <div style={{ fontSize:52, marginBottom:12 }}>📋</div>
              <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, marginBottom:6 }}>Sin plantillas aún</div>
              <div style={{ fontSize:13, color:'var(--text3)', marginBottom:20 }}>
                Crea tu primera plantilla para poder asignarla a los meses y comparar lo presupuestado con lo gastado.
              </div>
              <button onClick={() => setModalPlantilla(true)} style={{ background:'#6c63ff', color:'white', border:'none', borderRadius:10, padding:'10px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                📋 Crear primera plantilla
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {plantillas.map(p => {
                const lineas   = p.presupuesto_lineas || []
                const total    = lineas.reduce((s,l) => s+Number(l.monto_limite),0)
                return (
                  <div key={p.id} style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                      <div>
                        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, marginBottom:4 }}>{p.nombre}</div>
                        {p.descripcion && <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4 }}>{p.descripcion}</div>}
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          Creada {new Date(p.creado_en).toLocaleDateString('es-PE')} · {lineas.length} categorías
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color:'#6c63ff' }}>{fmt(total)}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>/mes</div>
                      </div>
                    </div>

                    {/* Mini-barras de categorías */}
                    <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                      {lineas.sort((a,b)=>b.monto_limite-a.monto_limite).map((l, i) => {
                        const cat = CAT_MAP[l.categoria] || { emoji:'📌', label:l.categoria, color:'#64748b' }
                        const pct = total > 0 ? (l.monto_limite/total*100) : 0
                        return (
                          <div key={i}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                              <span style={{ display:'flex', alignItems:'center', gap:5, fontWeight:600 }}>
                                {cat.emoji} {cat.label}
                              </span>
                              <span style={{ fontFamily:'Nunito', fontWeight:700, color:cat.color }}>
                                {fmt(l.monto_limite)}
                                <span style={{ fontSize:10, color:'var(--text3)', fontWeight:400, marginLeft:4 }}>({pct.toFixed(0)}%)</span>
                              </span>
                            </div>
                            <div style={{ height:5, background:'var(--bg)', borderRadius:999, overflow:'hidden', border:'1px solid var(--border)' }}>
                              <div style={{ height:'100%', width:`${pct}%`, background:cat.color, borderRadius:999 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => setEditandoPlant(p)} style={btnSec}>✏️ Editar</button>
                      <button onClick={() => { setTab('dashboard'); setTimeout(()=>setModalAsignar(true),100) }} style={{ ...btnSec, color:'#6c63ff', borderColor:'#c4b5fd' }}>
                        📅 Usar este mes
                      </button>
                      <button onClick={() => eliminarPlantilla(p.id)} style={{ ...btnSec, color:'#dc2626', borderColor:'#fecaca', marginLeft:'auto' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modalAsignar && (
        <AsignarMesForm
          usuarioId={usuarioId} mes={mes} anio={anio}
          presupuestoExistente={presMes}
          onClose={() => setModalAsignar(false)}
          onGuardado={cargarDashboard}
        />
      )}
      {modalPlantilla && (
        <PlantillaForm
          usuarioId={usuarioId}
          onClose={() => setModalPlantilla(false)}
          onGuardado={cargarPlantillas}
        />
      )}
      {editandoPlant && (
        <PlantillaForm
          usuarioId={usuarioId} plantilla={editandoPlant}
          onClose={() => setEditandoPlant(null)}
          onGuardado={cargarPlantillas}
        />
      )}
    </div>
  )
}

// ── Componente línea de categoría ─────────────────────────
function LineaCard({ cat, l, est, resto }) {
  return (
    <div style={{
      background:'white', borderRadius:14,
      border:`1.5px solid ${est.color}25`,
      padding:'14px 18px',
      boxShadow:'0 2px 6px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{cat.emoji}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontWeight:700, fontSize:14 }}>{cat.label}</span>
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:est.bg, color:est.color }}>
              {est.emoji} {est.label}
            </span>
          </div>
          {/* Barra de progreso */}
          <div style={{ height:10, background:'var(--bg)', borderRadius:999, overflow:'hidden', border:`1px solid ${est.color}20`, marginBottom:6 }}>
            <div style={{
              height:'100%',
              width:`${Math.min(est.pct, 100)}%`,
              background:est.color,
              borderRadius:999,
              transition:'width 0.5s',
              position:'relative',
            }}>
              {est.pct > 20 && (
                <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', fontSize:9, fontWeight:800, color:'white' }}>
                  {est.pct.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
            <span style={{ color:'var(--text2)' }}>
              Gastado: <strong style={{ color:est.color }}>{fmt(l.gastado)}</strong>
            </span>
            <span style={{ color:'var(--text3)' }}>
              Límite: <strong style={{ color:'var(--text2)' }}>{fmt(l.monto_limite)}</strong>
            </span>
            <span style={{ fontWeight:700, color: resto>=0?'#16a34a':'#dc2626' }}>
              {resto>=0 ? `Resta: ${fmt(resto)}` : `Excede en: ${fmt(Math.abs(resto))}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers UI ────────────────────────────────────────────
function KpiCard({ emoji, label, value, color, bg, sub }) {
  return (
    <div style={{ background:bg, borderRadius:14, border:`1.5px solid ${color}30`, padding:18 }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{emoji}</div>
      <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, color, letterSpacing:'-0.5px', marginBottom:3, wordBreak:'break-word' }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:`${color}90` }}>{sub}</div>
    </div>
  )
}

function Cargando() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {[1,2,3].map(i=>(
        <div key={i} style={{ background:'white', borderRadius:12, height:72, border:'1.5px solid var(--border)', animation:'pulse 1.5s ease-in-out infinite' }}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}

function SinPresupuesto({ mes, anio, onAsignar, onPlantillas }) {
  return (
    <div style={{ background:'white', borderRadius:18, border:'2px dashed var(--border)', padding:'52px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:12 }}>📭</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, marginBottom:6 }}>
        Sin presupuesto para {mes} {anio}
      </div>
      <div style={{ fontSize:13, color:'var(--text3)', marginBottom:24, maxWidth:380, margin:'0 auto 24px', lineHeight:1.7 }}>
        Asigna una plantilla para ver cuánto llevas gastado vs lo planificado en cada categoría.
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
        <button onClick={onPlantillas} style={{ padding:'9px 18px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--text2)' }}>
          📋 Ver plantillas
        </button>
        <button onClick={onAsignar} style={{ padding:'9px 20px', background:'#6c63ff', color:'white', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 3px 10px rgba(108,99,255,0.3)' }}>
          📅 Asignar plantilla
        </button>
      </div>
    </div>
  )
}

const btnNav = { padding:'5px 12px', background:'white', border:'1.5px solid var(--border)', borderRadius:8, fontSize:16, cursor:'pointer', fontWeight:700 }
const btnSec = { padding:'7px 13px', borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
