import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, TIPO_MAP, TIPOS_AHORRO, ESTADO_INFO,
  calcularEstado, diasHastaVencer, diasHastaDepositoCTS,
  proximoDepositoCTS, mensajeCTS, TIPOS_MOVIMIENTO,
} from '../lib/ahorroUtils'
import AhorroForm from '../components/AhorroForm'

const FILTROS = [
  { v:'todos',         label:'Todos' },
  { v:'plazo_fijo',    label:'🔒 Plazo fijo' },
  { v:'cts',           label:'🏛️ CTS' },
  { v:'fondo_empresa', label:'🏢 Fondo empresa' },
]

export default function AhorroProgramado({ usuarioId }) {
  const [ahorros,    setAhorros]    = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [filtro,     setFiltro]     = useState('todos')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando,   setEditando]   = useState(null)
  const [detalleId,  setDetalleId]  = useState(null)
  const [historial,  setHistorial]  = useState({})

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('ahorro_programado')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: true })
    // Actualizar estado automático
    const actualizados = (data || []).map(a => ({
      ...a,
      estado: calcularEstado(a),
    }))
    setAhorros(actualizados)
    setCargando(false)
  }

  async function cargarHistorial(id) {
    if (historial[id]) return
    const { data } = await supabase
      .from('movimientos_ahorro')
      .select('*')
      .eq('ahorro_id', id)
      .order('fecha', { ascending: false })
      .limit(20)
    setHistorial(prev => ({ ...prev, [id]: data || [] }))
  }

  function toggleDetalle(id) {
    const nuevo = detalleId === id ? null : id
    setDetalleId(nuevo)
    if (nuevo) cargarHistorial(nuevo)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este ahorro y su historial?')) return
    await supabase.from('ahorro_programado').delete().eq('id', id)
    cargar()
  }

  async function cambiarEstado(ahorro, nuevoEstado) {
    await supabase.from('ahorro_programado').update({
      estado:         nuevoEstado,
      actualizado_en: new Date().toISOString(),
    }).eq('id', ahorro.id)
    cargar()
  }

  async function toggleCTSDisponible(ahorro) {
    await supabase.from('ahorro_programado').update({
      cts_disponible: !ahorro.cts_disponible,
      actualizado_en: new Date().toISOString(),
    }).eq('id', ahorro.id)
    cargar()
  }

  // ── Totales ───────────────────────────────────────────────
  const activos      = ahorros.filter(a => a.estado !== 'cobrado')
  const totalAhorrado = activos.reduce((s, a) => s + Number(a.monto), 0)
  const totalInteresProy = activos.reduce((s, a) => s + Number(a.interes_proyectado || 0), 0)
  const ctsList      = ahorros.filter(a => a.tipo === 'cts')
  const totalCTS     = ctsList.reduce((s, a) => s + Number(a.monto), 0)
  const proximoDepo  = proximoDepositoCTS()
  const diasDepo     = diasHastaDepositoCTS()

  const lista = filtro === 'todos' ? activos : activos.filter(a => a.tipo === filtro)

  // Alertas: por vencer en 7 días
  const porVencer = activos.filter(a => {
    const d = diasHastaVencer(a.fecha_vencimiento)
    return d !== null && d >= 0 && d <= 7
  })

  return (
    <div style={{ padding:28 }}>

      {/* ── Alertas por vencer ── */}
      {porVencer.length > 0 && (
        <div style={{ marginBottom:22 }}>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#92400e', marginBottom:10 }}>
            ⏰ Próximos a vencer (7 días)
          </div>
          {porVencer.map(a => {
            const dias  = diasHastaVencer(a.fecha_vencimiento)
            const tipo  = TIPO_MAP[a.tipo] || { emoji:'📅', color:'#0891b2' }
            return (
              <div key={a.id} style={{
                background:'#fffbeb', border:'1.5px solid #fde68a',
                borderLeft:'4px solid #d97706',
                borderRadius:12, padding:'12px 16px', marginBottom:8,
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <div>
                  <span style={{ fontWeight:700, fontSize:13 }}>{tipo.emoji} {a.nombre}</span>
                  <div style={{ fontSize:11, color:'#92400e', marginTop:3 }}>
                    {dias === 0 ? '⚡ Vence HOY' : `Vence en ${dias} día${dias!==1?'s':''}`}
                    {a.banco && ` · ${a.banco}`}
                    {a.renovacion_auto && <span style={{ marginLeft:8, color:'#0891b2', fontWeight:700 }}>🔄 Renovación auto</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, color:'#d97706' }}>
                    {fmt(a.monto, a.moneda)}
                  </div>
                  {a.interes_proyectado > 0 && (
                    <div style={{ fontSize:11, color:'#16a34a' }}>
                      +{fmt(a.interes_proyectado, a.moneda)} interés
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
        <KpiCard emoji="📅" label="Total ahorrado" value={fmt(totalAhorrado)} color="#0891b2" bg="#ecfeff"
          sub={`${activos.length} depósito${activos.length!==1?'s':''} activo${activos.length!==1?'s':''}`} />
        <KpiCard emoji="💹" label="Interés proyectado" value={fmt(totalInteresProy)} color="#16a34a" bg="#f0fdf4"
          sub="Al vencimiento de todos" />
        <KpiCard emoji="🏛️" label="Total CTS" value={fmt(totalCTS)} color="#7c3aed" bg="#f5f3ff"
          sub={ctsList.length > 0 ? (ctsList[0].cts_disponible ? '✅ Libre disposición' : '🔐 Restringida') : 'Sin CTS registrada'} />
        <KpiCard emoji="📆" label="Próximo depósito CTS"
          value={`${diasDepo}d`} color="#d97706" bg="#fffbeb"
          sub={`${proximoDepo.meses} → ${fmtFecha(proximoDepo.fecha)}`} />
      </div>

      {/* ── Filtros + botón ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {FILTROS.filter(f => f.v==='todos' || activos.some(a => a.tipo===f.v)).map(f => (
            <div key={f.v} onClick={() => setFiltro(f.v)} style={{
              padding:'6px 13px', borderRadius:20, cursor:'pointer',
              fontSize:12, fontWeight:700,
              background: filtro===f.v ? '#0891b2':'white',
              color:       filtro===f.v ? 'white':'var(--text2)',
              border:`1.5px solid ${filtro===f.v ? '#0891b2':'var(--border)'}`,
              transition:'all 0.14s',
            }}>{f.label}</div>
          ))}
        </div>
        <button onClick={() => setModalNuevo(true)} style={{
          background:'#0891b2', color:'white', border:'none',
          borderRadius:10, padding:'9px 18px', fontSize:13,
          fontWeight:700, cursor:'pointer', fontFamily:'Poppins',
          boxShadow:'0 3px 10px rgba(8,145,178,0.3)',
        }}>+ Nuevo ahorro</button>
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <EmptyState onNuevo={() => setModalNuevo(true)} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {lista.map(a => (
            <AhorroCard
              key={a.id}
              ahorro={a}
              onEditar={() => setEditando(a)}
              onEliminar={() => eliminar(a.id)}
              onCambiarEstado={nuevoEstado => cambiarEstado(a, nuevoEstado)}
              onToggleCTS={() => toggleCTSDisponible(a)}
              onDetalle={() => toggleDetalle(a.id)}
              abierto={detalleId === a.id}
              historial={historial[a.id] || []}
            />
          ))}
        </div>
      )}

      {/* Cobrados */}
      {ahorros.filter(a => a.estado === 'cobrado').length > 0 && (
        <details style={{ marginTop:24 }}>
          <summary style={{ cursor:'pointer', fontSize:13, fontWeight:700, color:'var(--text3)', padding:'8px 0' }}>
            ✅ Cobrados / Finalizados ({ahorros.filter(a => a.estado==='cobrado').length})
          </summary>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {ahorros.filter(a => a.estado==='cobrado').map(a => {
              const tipo = TIPO_MAP[a.tipo] || { emoji:'📅', color:'#64748b' }
              return (
                <div key={a.id} style={{ background:'white', borderRadius:12, border:'1.5px solid var(--border)', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', opacity:0.7 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>{tipo.emoji}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{a.nombre}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{a.banco} · cobrado {fmtFecha(a.fecha_vencimiento)}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:14, color:'var(--text3)' }}>
                    {fmt(a.monto, a.moneda)}
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}

      {/* Modales */}
      {modalNuevo && <AhorroForm usuarioId={usuarioId} onClose={() => setModalNuevo(false)} onGuardado={cargar} />}
      {editando   && <AhorroForm usuarioId={usuarioId} ahorro={editando} onClose={() => setEditando(null)} onGuardado={cargar} />}
    </div>
  )
}

// ── Tarjeta de ahorro ─────────────────────────────────────
function AhorroCard({ ahorro: a, onEditar, onEliminar, onCambiarEstado, onToggleCTS, onDetalle, abierto, historial }) {
  const tipo   = TIPO_MAP[a.tipo]    || { emoji:'📅', label:a.tipo, color:'#0891b2' }
  const estado = ESTADO_INFO[a.estado] || ESTADO_INFO.activo
  const dias   = diasHastaVencer(a.fecha_vencimiento)
  const esCTS  = a.tipo === 'cts'
  const ctsMsg = esCTS ? mensajeCTS(a.cts_disponible) : null

  return (
    <div style={{
      background:'white', borderRadius:16,
      border:`1.5px solid ${abierto ? tipo.color+'50' : 'var(--border)'}`,
      boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
      overflow:'hidden',
    }}>
      {/* Fila principal */}
      <div style={{ padding:'16px 18px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>

          {/* Ícono */}
          <div style={{
            width:44, height:44, borderRadius:13, flexShrink:0,
            background:`${tipo.color}15`, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:20, border:`1.5px solid ${tipo.color}30`,
          }}>{tipo.emoji}</div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
              <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:15 }}>{a.nombre}</span>

              {/* Badge estado */}
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:estado.bg, color:estado.color }}>
                {estado.emoji} {estado.label}
              </span>

              {/* Badge banco */}
              {a.banco && (
                <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>🏦 {a.banco}</span>
              )}

              {/* Tasa */}
              {a.tasa_anual && (
                <span style={{ fontSize:11, fontWeight:700, color:'#16a34a', background:'#f0fdf4', padding:'2px 7px', borderRadius:20 }}>
                  ✦ {a.tasa_anual}% TEA
                </span>
              )}

              {/* Renovación auto */}
              {a.renovacion_auto && (
                <span style={{ fontSize:11, fontWeight:700, color:'#0891b2', background:'#ecfeff', padding:'2px 7px', borderRadius:20 }}>
                  🔄 Auto-renova
                </span>
              )}
            </div>

            {/* Detalles plazo fijo */}
            {a.tipo === 'plazo_fijo' && a.fecha_vencimiento && (
              <div style={{ fontSize:12, color:'var(--text2)', fontWeight:500, marginBottom:4 }}>
                📅 {a.dias_plazo ? `${a.dias_plazo} días` : ''} · vence {fmtFecha(a.fecha_vencimiento)}
                {dias !== null && dias >= 0 && dias <= 30 && (
                  <span style={{ marginLeft:8, fontWeight:700, color: dias<=7 ? '#dc2626':'#d97706' }}>
                    ({dias}d restantes)
                  </span>
                )}
              </div>
            )}

            {/* Estado CTS */}
            {esCTS && ctsMsg && (
              <div style={{
                display:'inline-flex', alignItems:'center', gap:6,
                background:ctsMsg.bg, border:`1px solid ${ctsMsg.color}30`,
                borderRadius:8, padding:'4px 10px', marginBottom:4, marginTop:2,
              }}>
                <span style={{ fontSize:12, fontWeight:700, color:ctsMsg.color }}>{ctsMsg.titulo}</span>
              </div>
            )}

            {/* Próximo depósito CTS */}
            {esCTS && a.cts_proximo_deposito && (
              <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>
                📆 Próximo depósito empleador: {fmtFecha(a.cts_proximo_deposito)}
                {a.cts_empleador && ` · ${a.cts_empleador}`}
              </div>
            )}
          </div>

          {/* Monto */}
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:22, color:tipo.color, letterSpacing:'-0.5px' }}>
              {fmt(a.monto, a.moneda)}
            </div>
            {a.interes_proyectado > 0 && (
              <div style={{ fontSize:11, color:'#16a34a', fontWeight:700, marginTop:2 }}>
                +{fmt(a.interes_proyectado, a.moneda)} proyectado
              </div>
            )}
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>
              actualizado {new Date(a.actualizado_en).toLocaleDateString('es-PE')}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display:'flex', gap:7, marginTop:12, flexWrap:'wrap', alignItems:'center' }}>

          {/* Toggle CTS disponible */}
          {esCTS && (
            <button onClick={onToggleCTS} style={{
              padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer',
              background: a.cts_disponible ? '#f0fdf4' : '#f5f3ff',
              color:      a.cts_disponible ? '#16a34a' : '#7c3aed',
              fontSize:12, fontWeight:700, fontFamily:'Poppins',
              border:`1.5px solid ${a.cts_disponible ? '#86efac':'#c4b5fd'}`,
            }}>
              {a.cts_disponible ? '🔓 Bloquear CTS' : '🔓 Liberar CTS'}
            </button>
          )}

          {/* Marcar cobrado / renovado */}
          {(a.estado === 'vencido' || a.estado === 'por_vencer') && !esCTS && (
            <>
              <button onClick={() => onCambiarEstado('cobrado')} style={btnSec}>
                ✅ Marcar cobrado
              </button>
              <button onClick={() => onCambiarEstado('renovado')} style={btnSec}>
                🔄 Renovar manualmente
              </button>
            </>
          )}

          <button onClick={onEditar}  style={btnSec}>✏️ Editar</button>
          <button onClick={onDetalle} style={btnSec}>{abierto ? '▲ Ocultar' : '▼ Historial'}</button>
          <button onClick={onEliminar} style={btnDanger}>🗑️</button>
        </div>
      </div>

      {/* Historial de movimientos */}
      {abierto && (
        <div style={{ borderTop:'1.5px solid var(--border)', background:'var(--bg)', padding:'14px 18px', animation:'fadeIn 0.2s ease' }}>
          <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13, marginBottom:10 }}>
            📋 Historial de movimientos
          </div>
          {historial.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)' }}>Sin movimientos registrados.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {historial.map(m => {
                const mv = TIPOS_MOVIMIENTO[m.tipo] || { emoji:'·', color:'#64748b', label:m.tipo }
                return (
                  <div key={m.id} style={{
                    display:'flex', alignItems:'center', gap:10,
                    background:'white', borderRadius:8, padding:'8px 12px',
                    border:'1px solid var(--border)', fontSize:13,
                  }}>
                    <span style={{ color:mv.color, fontSize:16 }}>{mv.emoji}</span>
                    <span style={{ color:'var(--text3)', fontWeight:600, fontSize:12, minWidth:90 }}>
                      {new Date(m.fecha+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})}
                    </span>
                    <span style={{ flex:1, color:'var(--text2)', fontSize:12 }}>
                      {m.descripcion || mv.label}
                    </span>
                    <span style={{ fontFamily:'Nunito', fontWeight:800, fontSize:14, color:mv.color }}>
                      {fmt(m.monto, a.moneda)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

function KpiCard({ emoji, label, value, color, bg, sub }) {
  return (
    <div style={{ background:bg, borderRadius:14, border:`1.5px solid ${color}30`, padding:18 }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{emoji}</div>
      <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color, letterSpacing:'-0.5px', marginBottom:3 }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:`${color}90` }}>{sub}</div>
    </div>
  )
}

function Cargando() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background:'white', borderRadius:12, height:90, border:'1.5px solid var(--border)', animation:'pulse 1.5s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}

function EmptyState({ onNuevo }) {
  return (
    <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'52px 20px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:12 }}>📅</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, marginBottom:6 }}>Sin ahorros programados</div>
      <div style={{ fontSize:13, color:'var(--text3)', marginBottom:20, maxWidth:380, margin:'0 auto 20px', lineHeight:1.6 }}>
        Registra tus depósitos a plazo fijo, CTS y fondos de ahorro para monitorear su rendimiento y vencimientos.
      </div>
      <button onClick={onNuevo} style={{ background:'#0891b2', color:'white', border:'none', borderRadius:10, padding:'10px 22px', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 3px 10px rgba(8,145,178,0.3)' }}>
        📅 Crear primer ahorro
      </button>
    </div>
  )
}

const btnSec    = { padding:'6px 12px', borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
const btnDanger = { padding:'6px 10px', borderRadius:8, background:'#fef2f2', border:'1.5px solid #fecaca', fontSize:12, fontWeight:700, cursor:'pointer', color:'#dc2626', fontFamily:'Poppins', marginLeft:'auto' }
