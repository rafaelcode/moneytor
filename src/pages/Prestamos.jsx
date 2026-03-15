import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, diasHastaProximoPago, urgencia,
  pctPagado, TIPO_MAP,
} from '../lib/deudasUtils'
import DeudaForm from '../components/DeudaForm'
import PagoForm  from '../components/PagoForm'

// Tipos de préstamo (quién te debe)
const TIPOS_PRESTAMO = [
  { valor: 'prestamo_personal', emoji: '🤝', label: 'Préstamo a persona',  color: '#14b8a6' },
  { valor: 'deuda_amigo',       emoji: '👤', label: 'Deuda de amigo/fam.', color: '#0891b2' },
  { valor: 'prestamo_banco',    emoji: '🏦', label: 'Préstamo a empresa',   color: '#7c3aed' },
  { valor: 'cuotas_tienda',     emoji: '🛒', label: 'Cuotas pendientes',    color: '#d97706' },
  { valor: 'otro',              emoji: '📌', label: 'Otro',                  color: '#64748b' },
]
const TIPO_P_MAP = Object.fromEntries(TIPOS_PRESTAMO.map(t => [t.valor, t]))

export default function Prestamos({ usuarioId }) {
  const [prestamos,      setPrestamos]      = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [filtro,         setFiltro]         = useState('activa')
  const [modalNuevo,     setModalNuevo]     = useState(false)
  const [editando,       setEditando]       = useState(null)
  const [cobrando,       setCobrando]       = useState(null)
  const [detalleId,      setDetalleId]      = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('deudas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('direccion', 'me_deben')
      .order('creado_en', { ascending: false })
    setPrestamos(data || [])
    setCargando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este préstamo y su historial?')) return
    await supabase.from('deudas').delete().eq('id', id)
    cargar()
  }

  async function marcarCobrado(p) {
    await supabase.from('deudas').update({
      estado:          p.estado === 'pagada' ? 'activa' : 'pagada',
      monto_pendiente: p.estado === 'pagada' ? p.monto_total : 0,
      actualizado_en:  new Date().toISOString(),
    }).eq('id', p.id)
    cargar()
  }

  // ── Totales ───────────────────────────────────────────────
  const activos   = prestamos.filter(p => p.estado === 'activa')
  const cobrados  = prestamos.filter(p => p.estado === 'pagada')
  const vencidos  = activos.filter(p => {
    const d = diasHastaProximoPago(p)
    return d !== null && d < 0
  })

  const totalPorCobrar  = activos.reduce((s, p) => s + Number(p.monto_pendiente), 0)
  const totalPrestado   = prestamos.reduce((s, p) => s + Number(p.monto_total), 0)
  const totalCobrado    = cobrados.reduce((s, p) => s + Number(p.monto_total), 0)

  const lista = filtro === 'activa' ? activos : cobrados

  return (
    <div style={{ padding: 28 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard emoji="📥" label="Por cobrar" value={fmt(totalPorCobrar)}
          color="#14b8a6" bg="#f0fdfa"
          sub={`${activos.length} préstamo${activos.length !== 1 ? 's' : ''} activo${activos.length !== 1 ? 's' : ''}`} />
        <KpiCard emoji="💸" label="Total prestado" value={fmt(totalPrestado)}
          color="#0891b2" bg="#ecfeff"
          sub="Suma histórica de préstamos" />
        <KpiCard emoji="✅" label="Ya cobrado" value={fmt(totalCobrado)}
          color="#16a34a" bg="#f0fdf4"
          sub={`${cobrados.length} préstamo${cobrados.length !== 1 ? 's' : ''} saldado${cobrados.length !== 1 ? 's' : ''}`} />
        <KpiCard emoji="⚠️" label="Vencidos" value={vencidos.length}
          color={vencidos.length > 0 ? '#dc2626' : '#64748b'}
          bg={vencidos.length > 0 ? '#fef2f2' : '#f8fafc'}
          sub={vencidos.length > 0 ? 'Pendientes de cobro' : 'Sin vencidos'} />
      </div>

      {/* ── Alerta vencidos ── */}
      {vencidos.length > 0 && (
        <div style={{
          marginBottom: 18, padding: '12px 16px',
          background: '#fef2f2', border: '1.5px solid #fecaca',
          borderRadius: 12, fontSize: 13, color: '#991b1b', fontWeight: 600,
        }}>
          ⚠️ Tienes {vencidos.length} préstamo{vencidos.length !== 1 ? 's' : ''} con fecha de cobro vencida.
          Revísalos y contacta a quien te debe.
        </div>
      )}

      {/* ── Tabs + Botón ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'activa',  label: `📥 Pendientes (${activos.length})` },
            { v: 'pagada',  label: `✅ Cobrados (${cobrados.length})` },
          ].map(t => (
            <div key={t.v} onClick={() => setFiltro(t.v)} style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: filtro === t.v ? '#14b8a6' : 'white',
              color: filtro === t.v ? 'white' : 'var(--text2)',
              border: `1.5px solid ${filtro === t.v ? '#14b8a6' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}>{t.label}</div>
          ))}
        </div>
        <button onClick={() => setModalNuevo(true)} style={{
          background: '#14b8a6', color: 'white', border: 'none',
          borderRadius: 10, padding: '9px 18px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
          boxShadow: '0 3px 10px rgba(20,184,166,0.3)',
        }}>+ Registrar préstamo</button>
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Cargando...</div>
      ) : lista.length === 0 ? (
        <EmptyState filtro={filtro} onNuevo={() => setModalNuevo(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map(p => (
            <PrestamoCard
              key={p.id}
              prestamo={p}
              onEditar={() => setEditando(p)}
              onCobrar={() => setCobrando(p)}
              onEliminar={() => eliminar(p.id)}
              onMarcarCobrado={() => marcarCobrado(p)}
              onDetalle={() => setDetalleId(detalleId === p.id ? null : p.id)}
              mostrarDetalle={detalleId === p.id}
              usuarioId={usuarioId}
            />
          ))}
        </div>
      )}

      {/* ── Modales ── */}
      {modalNuevo && (
        <DeudaForm
          usuarioId={usuarioId}
          deuda={{ direccion: 'me_deben' }}
          onClose={() => setModalNuevo(false)}
          onGuardado={cargar}
        />
      )}
      {editando && (
        <DeudaForm
          usuarioId={usuarioId}
          deuda={editando}
          onClose={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
      {cobrando && (
        <PagoForm
          usuarioId={usuarioId}
          deuda={cobrando}
          onClose={() => setCobrando(null)}
          onGuardado={cargar}
          esCobro
        />
      )}
    </div>
  )
}

// ── Card de préstamo ──────────────────────────────────────
function PrestamoCard({ prestamo: p, onEditar, onCobrar, onEliminar, onMarcarCobrado, onDetalle, mostrarDetalle, usuarioId }) {
  const tipo     = TIPO_P_MAP[p.tipo] || TIPO_MAP[p.tipo] || { emoji: '🤝', label: p.tipo, color: '#14b8a6' }
  const dias     = diasHastaProximoPago(p)
  const urg      = urgencia(dias)
  const pct      = pctPagado(p)
  const esCobrado = p.estado === 'pagada'

  const [historial, setHistorial] = useState([])
  const [loadHist,  setLoadHist]  = useState(false)

  useEffect(() => {
    if (mostrarDetalle) cargarHistorial()
  }, [mostrarDetalle])

  async function cargarHistorial() {
    setLoadHist(true)
    const { data } = await supabase.from('pagos_deuda')
      .select('*').eq('deuda_id', p.id)
      .order('fecha', { ascending: false })
    setHistorial(data || [])
    setLoadHist(false)
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: `1.5px solid ${esCobrado ? '#bbf7d0' : 'var(--border)'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      opacity: esCobrado ? 0.85 : 1,
    }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

          {/* Ícono */}
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `${tipo.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>{tipo.emoji}</div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 15 }}>{p.nombre}</div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: `${tipo.color}15`, color: tipo.color,
              }}>{tipo.label}</span>
              {esCobrado && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✅ Cobrado</span>}
              {p.contacto_nombre && (
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
                  👤 {p.contacto_nombre}
                </span>
              )}
            </div>

            {/* Cuotas */}
            {p.es_en_cuotas && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, fontWeight: 500 }}>
                Cobro {(p.cuotas_pagadas || 0) + 1} de {p.total_cuotas}
                {p.monto_cuota && ` · ${fmt(p.monto_cuota)}/mes`}
              </div>
            )}

            {/* Barra progreso cobro */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>
                  Cobrado: {fmt(p.monto_total - p.monto_pendiente)}
                </span>
                <span style={{ fontWeight: 700, color: tipo.color }}>{pct}%</span>
              </div>
              <div style={{ height: 7, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{
                  height: '100%', borderRadius: 999, transition: 'width 0.5s',
                  width: `${pct}%`,
                  background: esCobrado ? '#22c55e' : tipo.color,
                }} />
              </div>
            </div>
          </div>

          {/* Monto */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: 'Nunito', fontWeight: 900, fontSize: 18,
              color: esCobrado ? '#22c55e' : '#14b8a6',
            }}>
              {fmt(p.monto_pendiente)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              de {fmt(p.monto_total)}
            </div>
            {!esCobrado && dias !== null && (
              <div style={{
                marginTop: 6, fontSize: 11, fontWeight: 700, padding: '3px 8px',
                borderRadius: 20, background: urg.bg, color: urg.color, display: 'inline-block',
              }}>
                {dias < 0 ? '⚠️ Vencido' : `${urg.emoji} En ${urg.label}`}
              </div>
            )}
            {!esCobrado && p.fecha_vencimiento && !p.es_en_cuotas && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                Cobrar el {fmtFecha(p.fecha_vencimiento)}
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {!esCobrado && (
            <button onClick={onCobrar} style={{
              ...btnSmall, background: tipo.color, color: 'white', border: 'none',
              boxShadow: `0 2px 8px ${tipo.color}40`,
            }}>📥 Registrar cobro</button>
          )}
          <button onClick={onEditar} style={{ ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)' }}>
            ✏️ Editar
          </button>
          <button onClick={onDetalle} style={{ ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)' }}>
            {mostrarDetalle ? '▲ Ocultar' : '▼ Historial'}
          </button>
          <button onClick={onMarcarCobrado} style={{
            ...btnSmall,
            background: esCobrado ? '#dcfce7' : 'var(--bg)',
            color: esCobrado ? '#16a34a' : 'var(--text3)',
            border: `1.5px solid ${esCobrado ? '#bbf7d0' : 'var(--border)'}`,
          }}>
            {esCobrado ? '↩ Reactivar' : '🏁 Marcar cobrado'}
          </button>
          <button onClick={onEliminar} style={{ ...btnSmall, background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', marginLeft: 'auto' }}>
            🗑️
          </button>
        </div>
      </div>

      {/* Historial */}
      {mostrarDetalle && (
        <div style={{ borderTop: '1.5px solid var(--border)', background: 'var(--bg)', padding: '14px 18px' }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
            📋 Historial de cobros
          </div>
          {loadHist ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Cargando...</div>
          ) : historial.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Aún no hay cobros registrados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historial.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'white', borderRadius: 8, padding: '8px 12px',
                  border: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text3)', fontWeight: 600 }}>
                    {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ color: 'var(--text2)', fontSize: 12 }}>{c.notas || '—'}</span>
                  <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: '#14b8a6', fontSize: 14 }}>
                    +{fmt(c.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────
function EmptyState({ filtro, onNuevo }) {
  const msgs = {
    activa: { emoji: '🎉', title: 'Nadie te debe', sub: 'Si le prestaste dinero a alguien, regístralo aquí para no olvidarlo.' },
    pagada: { emoji: '✅', title: 'Sin cobros registrados', sub: 'Los préstamos que cobres completamente aparecerán aquí.' },
  }
  const m = msgs[filtro] || msgs.activa
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>{m.emoji}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, marginBottom: 6 }}>{m.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>{m.sub}</div>
      {filtro !== 'pagada' && (
        <button onClick={onNuevo} style={{
          background: '#14b8a6', color: 'white', border: 'none',
          borderRadius: 10, padding: '10px 20px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer',
        }}>+ Registrar préstamo</button>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({ emoji, label, value, sub, color, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 16,
      border: `1.5px solid ${color}30`, padding: 18,
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 22, color, letterSpacing: '-0.5px', marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: `${color}99` }}>{sub}</div>
    </div>
  )
}

const btnSmall = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
  transition: 'all 0.15s',
}
