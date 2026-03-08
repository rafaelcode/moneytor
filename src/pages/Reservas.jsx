import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, pctMeta, colorMeta,
  diasDevolucion, TIPO_MAP, TIPOS_RESERVA,
} from '../lib/reservasUtils'
import ReservaForm    from '../components/ReservaForm'
import MovimientoForm from '../components/MovimientoForm'

const FILTROS = [
  { v: 'todas',                label: 'Todas' },
  { v: 'cuenta_ahorros',       label: '🏦 Cuentas ahorros' },
  { v: 'cuenta_corriente',     label: '💳 Cuentas corrientes' },
  { v: 'efectivo',             label: '💵 Efectivo' },
  { v: 'fondo_emergencia',     label: '🛡️ Fondo emergencia' },
  { v: 'reserva_administrada', label: '🤝 Administradas' },
]

export default function Reservas({ usuarioId }) {
  const [reservas,       setReservas]       = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [filtro,         setFiltro]         = useState('todas')
  const [modalNueva,     setModalNueva]     = useState(false)
  const [editando,       setEditando]       = useState(null)
  const [moviendo,       setMoviendo]       = useState(null)
  const [detalleId,      setDetalleId]      = useState(null)
  const [historial,      setHistorial]      = useState({})
  const [loadHist,       setLoadHist]       = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('reservas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('activa', true)
      .order('creado_en', { ascending: true })
    setReservas(data || [])
    setCargando(false)
  }

  async function cargarHistorial(reservaId) {
    if (historial[reservaId]) return
    setLoadHist(true)
    const { data } = await supabase
      .from('movimientos_reserva')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('fecha', { ascending: false })
      .limit(20)
    setHistorial(prev => ({ ...prev, [reservaId]: data || [] }))
    setLoadHist(false)
  }

  function toggleDetalle(id) {
    const nuevo = detalleId === id ? null : id
    setDetalleId(nuevo)
    if (nuevo) cargarHistorial(nuevo)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta reserva y su historial de movimientos?')) return
    await supabase.from('reservas').update({ activa: false }).eq('id', id)
    cargar()
  }

  // ── Totales por tipo ─────────────────────────────────────
  const activas     = reservas.filter(r => r.activa !== false)
  const totalGeneral = activas.reduce((s, r) => s + Number(r.saldo_actual), 0)

  const totalesPorTipo = TIPOS_RESERVA.map(t => ({
    ...t,
    total: activas.filter(r => r.tipo === t.valor).reduce((s, r) => s + Number(r.saldo_actual), 0),
    count: activas.filter(r => r.tipo === t.valor).length,
  })).filter(t => t.count > 0)

  const administradas = activas.filter(r => r.tipo === 'reserva_administrada')
  const totalAdmin    = administradas.reduce((s, r) => s + Number(r.saldo_actual), 0)

  const fondoEmerg    = activas.filter(r => r.tipo === 'fondo_emergencia')
  const pctFondo      = fondoEmerg.length > 0 && fondoEmerg[0].meta_monto
    ? pctMeta(fondoEmerg[0]) : null

  // ── Lista filtrada ────────────────────────────────────────
  const lista = filtro === 'todas' ? activas : activas.filter(r => r.tipo === filtro)

  return (
    <div style={{ padding:28 }}>

      {/* ══ KPIs principales ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>

        <KpiCard
          emoji="🏦" label="Total en reservas"
          value={fmt(totalGeneral)}
          color="#2563eb" bg="#eff6ff"
          sub={`${activas.length} cuenta${activas.length !== 1 ? 's' : ''} activa${activas.length !== 1 ? 's' : ''}`}
          grande
        />

        <KpiCard
          emoji="💵" label="Disponible hoy"
          value={fmt(totalGeneral - totalAdmin)}
          color="#16a34a" bg="#f0fdf4"
          sub="Excluyendo administradas"
        />

        <KpiCard
          emoji="🤝" label="Administrado"
          value={fmt(totalAdmin)}
          color="#d97706" bg="#fffbeb"
          sub={`${administradas.length} persona${administradas.length !== 1 ? 's' : ''}`}
        />

        {pctFondo !== null ? (
          <KpiCard
            emoji="🛡️" label="Fondo emergencia"
            value={`${pctFondo}%`}
            color={colorMeta(pctFondo)} bg={`${colorMeta(pctFondo)}12`}
            sub={pctFondo >= 100 ? '✅ Meta alcanzada' : `Meta: ${fmt(fondoEmerg[0].meta_monto)}`}
          />
        ) : (
          <div
            onClick={() => setModalNueva(true)}
            style={{
              background:'#f0fdf4', borderRadius:14,
              border:'1.5px dashed #86efac', padding:18,
              display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', cursor:'pointer', gap:6,
              transition:'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='#dcfce7'}
            onMouseLeave={e => e.currentTarget.style.background='#f0fdf4'}
          >
            <span style={{ fontSize:24 }}>🛡️</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#16a34a', textAlign:'center' }}>
              Crear fondo de emergencia
            </span>
            <span style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>
              Se recomienda 3-6 meses de gastos
            </span>
          </div>
        )}
      </div>

      {/* ══ Distribución por tipo ══ */}
      {totalesPorTipo.length > 0 && (
        <div style={{
          background:'white', borderRadius:16,
          border:'1.5px solid var(--border)',
          padding:'16px 20px', marginBottom:22,
          boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, marginBottom:14, color:'var(--text)' }}>
            📊 Distribución de reservas
          </div>
          <div style={{ display:'flex', gap:0, height:12, borderRadius:999, overflow:'hidden', marginBottom:14, background:'var(--bg)' }}>
            {totalesPorTipo.map(t => {
              const pct = totalGeneral > 0 ? (t.total / totalGeneral) * 100 : 0
              return pct > 0 ? (
                <div key={t.valor} title={`${t.label}: ${fmt(t.total)} (${pct.toFixed(1)}%)`} style={{
                  width:`${pct}%`, background:t.color,
                  transition:'width 0.5s', minWidth:4,
                }} />
              ) : null
            })}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 20px' }}>
            {totalesPorTipo.map(t => (
              <div key={t.valor} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:t.color, flexShrink:0 }} />
                <span style={{ color:'var(--text2)', fontWeight:500 }}>
                  {t.emoji} {t.label}
                </span>
                <span style={{ fontFamily:'Nunito', fontWeight:800, color:t.color }}>
                  {fmt(t.total)}
                </span>
                <span style={{ color:'var(--text3)', fontSize:11 }}>
                  ({totalGeneral > 0 ? ((t.total/totalGeneral)*100).toFixed(1) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ Filtros + botón ══ */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {FILTROS.filter(f => f.v === 'todas' || activas.some(r => r.tipo === f.v)).map(f => (
            <div key={f.v} onClick={() => setFiltro(f.v)} style={{
              padding:'6px 13px', borderRadius:20, cursor:'pointer',
              fontSize:12, fontWeight:700,
              background: filtro === f.v ? '#2563eb' : 'white',
              color:       filtro === f.v ? 'white'   : 'var(--text2)',
              border:`1.5px solid ${filtro === f.v ? '#2563eb' : 'var(--border)'}`,
              transition:'all 0.14s',
            }}>{f.label}</div>
          ))}
        </div>
        <button onClick={() => setModalNueva(true)} style={{
          background:'#2563eb', color:'white', border:'none',
          borderRadius:10, padding:'9px 18px', fontSize:13,
          fontWeight:700, cursor:'pointer', fontFamily:'Poppins',
          boxShadow:'0 3px 10px rgba(37,99,235,0.3)',
        }}>+ Nueva reserva</button>
      </div>

      {/* ══ Lista de reservas ══ */}
      {cargando ? (
        <CargandoPlaceholder />
      ) : lista.length === 0 ? (
        <EmptyState onNueva={() => setModalNueva(true)} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {lista.map(r => (
            <ReservaCard
              key={r.id}
              reserva={r}
              onMover={()  => setMoviendo(r)}
              onEditar={()  => setEditando(r)}
              onEliminar={()=> eliminar(r.id)}
              onDetalle={()  => toggleDetalle(r.id)}
              abierto={detalleId === r.id}
              historial={historial[r.id] || []}
              loadHist={loadHist && detalleId === r.id}
            />
          ))}
        </div>
      )}

      {/* ══ Alerta reservas administradas por vencer ══ */}
      {administradas.filter(r => {
        const d = diasDevolucion(r.fecha_devolucion)
        return d !== null && d <= 15
      }).length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#92400e', marginBottom:10 }}>
            ⏰ Reservas administradas por vencer
          </div>
          {administradas
            .filter(r => { const d = diasDevolucion(r.fecha_devolucion); return d !== null && d <= 15 })
            .map(r => {
              const dias = diasDevolucion(r.fecha_devolucion)
              return (
                <div key={r.id} style={{
                  background:'#fffbeb', border:'1.5px solid #fde68a',
                  borderLeft:'4px solid #d97706',
                  borderRadius:12, padding:'12px 16px', marginBottom:8,
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                }}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:13 }}>🤝 {r.nombre}</span>
                    <span style={{ fontSize:12, color:'#92400e', marginLeft:8 }}>
                      {r.contacto_nombre && `· ${r.contacto_nombre}`}
                    </span>
                    <div style={{ fontSize:11, color:'#92400e', marginTop:3 }}>
                      {dias < 0
                        ? `⚠️ Vencida hace ${Math.abs(dias)} días`
                        : dias === 0
                          ? '⚡ Vence HOY'
                          : `Devolución en ${dias} día${dias !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, color:'#d97706' }}>
                    {fmt(r.saldo_actual, r.moneda)}
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* ══ Modales ══ */}
      {modalNueva && (
        <ReservaForm
          usuarioId={usuarioId}
          onClose={() => setModalNueva(false)}
          onGuardado={cargar}
        />
      )}
      {editando && (
        <ReservaForm
          usuarioId={usuarioId}
          reserva={editando}
          onClose={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
      {moviendo && (
        <MovimientoForm
          usuarioId={usuarioId}
          reserva={moviendo}
          onClose={() => setMoviendo(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}

// ── Tarjeta de reserva ────────────────────────────────────
function ReservaCard({ reserva: r, onMover, onEditar, onEliminar, onDetalle, abierto, historial, loadHist }) {
  const tipo = TIPO_MAP[r.tipo] || { emoji:'🏦', label: r.tipo, color:'#2563eb' }
  const pct  = pctMeta(r)
  const dias = r.tipo === 'reserva_administrada' ? diasDevolucion(r.fecha_devolucion) : null

  return (
    <div style={{
      background:'white', borderRadius:16,
      border:`1.5px solid ${abierto ? tipo.color+'50' : 'var(--border)'}`,
      boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
      overflow:'hidden', transition:'border-color 0.2s',
    }}>
      {/* Fila principal */}
      <div style={{ padding:'16px 18px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>

          {/* Ícono */}
          <div style={{
            width:44, height:44, borderRadius:13, flexShrink:0,
            background:`${tipo.color}15`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, border:`1.5px solid ${tipo.color}30`,
          }}>{tipo.emoji}</div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
              <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:15 }}>{r.nombre}</span>
              <span style={{
                fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                background:`${tipo.color}12`, color: tipo.color,
              }}>{tipo.label}</span>
              {r.banco && (
                <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>
                  🏦 {r.banco}
                </span>
              )}
              {r.tasa_anual && (
                <span style={{ fontSize:11, fontWeight:700, color:'#16a34a',
                  background:'#f0fdf4', padding:'2px 7px', borderRadius:20 }}>
                  ✦ {r.tasa_anual}% TEA
                </span>
              )}
            </div>

            {/* Campos específicos por tipo */}
            {r.tipo === 'reserva_administrada' && r.contacto_nombre && (
              <div style={{ fontSize:12, color:'var(--text2)', marginBottom:4, fontWeight:500 }}>
                👤 {r.contacto_nombre}
                {r.contacto_email && <span style={{ color:'var(--text3)', marginLeft:6 }}>{r.contacto_email}</span>}
                {r.fecha_devolucion && (
                  <span style={{
                    marginLeft:8, fontSize:11, fontWeight:700,
                    color: dias !== null && dias <= 7 ? '#dc2626' : '#d97706',
                  }}>
                    📅 Dev. {fmtFecha(r.fecha_devolucion)}
                    {dias !== null && dias <= 15 && ` (${dias}d)`}
                  </span>
                )}
              </div>
            )}

            {/* Barra de progreso fondo emergencia */}
            {r.tipo === 'fondo_emergencia' && pct !== null && (
              <div style={{ marginTop:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ color:'var(--text3)', fontWeight:600 }}>
                    Meta: {fmt(r.meta_monto, r.moneda)}
                  </span>
                  <span style={{ fontWeight:700, color:colorMeta(pct) }}>{pct}%</span>
                </div>
                <div style={{ height:7, background:'var(--bg)', borderRadius:999, overflow:'hidden', border:'1px solid var(--border)' }}>
                  <div style={{
                    height:'100%', borderRadius:999,
                    width:`${pct}%`, background:colorMeta(pct),
                    transition:'width 0.5s',
                  }} />
                </div>
                {pct < 100 && (
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>
                    Faltan {fmt(r.meta_monto - r.saldo_actual, r.moneda)} para alcanzar la meta
                  </div>
                )}
              </div>
            )}

            {r.notas && (
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, fontStyle:'italic' }}>
                {r.notas}
              </div>
            )}
          </div>

          {/* Saldo */}
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{
              fontFamily:'Nunito', fontWeight:900, fontSize:22,
              color: tipo.color, letterSpacing:'-0.5px',
            }}>
              {fmt(r.saldo_actual, r.moneda)}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>
              {r.moneda} · actualizado {new Date(r.actualizado_en).toLocaleDateString('es-PE')}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display:'flex', gap:7, marginTop:12, flexWrap:'wrap' }}>
          <button onClick={onMover} style={btnPrimario(tipo.color)}>
            ↕ Depósito / Retiro
          </button>
          <button onClick={onEditar} style={btnSec}>✏️ Editar</button>
          <button onClick={onDetalle} style={btnSec}>
            {abierto ? '▲ Ocultar' : '▼ Movimientos'}
          </button>
          <button onClick={onEliminar} style={btnDanger}>🗑️</button>
        </div>
      </div>

      {/* Historial de movimientos */}
      {abierto && (
        <div style={{
          borderTop:'1.5px solid var(--border)',
          background:'var(--bg)', padding:'14px 18px',
          animation:'fadeIn 0.2s ease',
        }}>
          <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13, marginBottom:10 }}>
            📋 Últimos movimientos
          </div>

          {loadHist ? (
            <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>Cargando...</div>
          ) : historial.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>
              Sin movimientos registrados aún.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {historial.map(m => {
                const esDeposito = m.tipo === 'deposito'
                const esAjuste   = m.tipo === 'ajuste'
                return (
                  <div key={m.id} style={{
                    display:'flex', alignItems:'center',
                    background:'white', borderRadius:8,
                    padding:'8px 12px', border:'1px solid var(--border)',
                    gap:10, fontSize:13,
                  }}>
                    <span style={{
                      fontSize:16,
                      color: esAjuste ? '#d97706' : esDeposito ? '#16a34a' : '#dc2626',
                    }}>
                      {esAjuste ? '⟳' : esDeposito ? '↑' : '↓'}
                    </span>
                    <span style={{ color:'var(--text3)', fontWeight:600, fontSize:12, minWidth:80 }}>
                      {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})}
                    </span>
                    <span style={{ flex:1, color:'var(--text2)', fontSize:12 }}>
                      {m.descripcion || (esAjuste ? 'Ajuste de saldo' : esDeposito ? 'Depósito' : 'Retiro')}
                    </span>
                    <span style={{
                      fontFamily:'Nunito', fontWeight:800, fontSize:14,
                      color: esAjuste ? '#d97706' : esDeposito ? '#16a34a' : '#dc2626',
                    }}>
                      {esAjuste ? '⟳' : esDeposito ? '+' : '-'}
                      {fmt(m.monto, r.moneda)}
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

// ── Helpers de UI ─────────────────────────────────────────
function KpiCard({ emoji, label, value, color, bg, sub, grande, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: bg, borderRadius:14,
      border:`1.5px solid ${color}30`, padding: grande ? 20 : 16,
      cursor: onClick ? 'pointer' : 'default',
      transition:'transform 0.15s',
    }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.transform='translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform='none' }}
    >
      <div style={{ fontSize: grande ? 26 : 22, marginBottom:6 }}>{emoji}</div>
      <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>
        {label}
      </div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize: grande ? 22 : 18, color, letterSpacing:'-0.5px', marginBottom:2 }}>
        {value}
      </div>
      <div style={{ fontSize:11, fontWeight:600, color:`${color}90` }}>{sub}</div>
    </div>
  )
}

function CargandoPlaceholder() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          background:'white', borderRadius:16, height:90,
          border:'1.5px solid var(--border)',
          animation:'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}

function EmptyState({ onNueva }) {
  return (
    <div style={{
      textAlign:'center', padding:'52px 20px',
      background:'white', borderRadius:18,
      border:'1.5px solid var(--border)',
    }}>
      <div style={{ fontSize:52, marginBottom:12 }}>🏦</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, marginBottom:6 }}>
        Sin reservas registradas
      </div>
      <div style={{ fontSize:13, color:'var(--text3)', marginBottom:20, lineHeight:1.6, maxWidth:380, margin:'0 auto 20px' }}>
        Registra tus cuentas bancarias, efectivo y fondos para tener una foto completa de tu liquidez disponible.
      </div>
      <button onClick={onNueva} style={{
        background:'#2563eb', color:'white', border:'none',
        borderRadius:10, padding:'10px 22px', fontSize:13,
        fontWeight:700, cursor:'pointer',
        boxShadow:'0 3px 10px rgba(37,99,235,0.3)',
      }}>🏦 Crear primera reserva</button>
    </div>
  )
}

const btnPrimario = color => ({
  padding:'6px 13px', borderRadius:8, border:'none',
  background:color, color:'white',
  fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Poppins',
  boxShadow:`0 2px 8px ${color}40`, transition:'all 0.14s',
})
const btnSec = {
  padding:'6px 12px', borderRadius:8,
  background:'var(--bg)', border:'1.5px solid var(--border)',
  fontSize:12, fontWeight:700, cursor:'pointer',
  color:'var(--text2)', fontFamily:'Poppins',
}
const btnDanger = {
  padding:'6px 10px', borderRadius:8,
  background:'#fef2f2', border:'1.5px solid #fecaca',
  fontSize:12, fontWeight:700, cursor:'pointer',
  color:'#dc2626', fontFamily:'Poppins', marginLeft:'auto',
}
