import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TarjetaForm from '../components/TarjetaForm'
import MovimientoTarjetaForm from '../components/MovimientoTarjetaForm'

const fmt = (monto, moneda = 'PEN') =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(monto ?? 0)

const fmtFecha = (fecha) =>
  fecha
    ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—'

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

// ── Card de tarjeta ───────────────────────────────────────
function TarjetaCard({ tarjeta, onEdit, onMovimiento, onDelete, onToggleDetalle, mostrarDetalle, historial, loadHist }) {
  const isCredito  = tarjeta.tipo === 'credito'
  const color      = tarjeta.color || (isCredito ? '#dc2626' : '#2563eb')
  const pct        = isCredito && tarjeta.limite_credito > 0
    ? Math.min((tarjeta.deuda_actual / tarjeta.limite_credito) * 100, 100)
    : null
  const colorBarra = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : '#22c55e'

  const ICONO_MOVIMIENTO = {
    deposito: { e: '↑', c: '#16a34a' },
    retiro:   { e: '↓', c: '#dc2626' },
    pago:     { e: '✅', c: '#16a34a' },
    cargo:    { e: '💸', c: '#dc2626' },
    ajuste:   { e: '⟳', c: '#d97706' },
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: '1.5px solid var(--border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      {/* Franja de color */}
      <div style={{ height: 5, background: color }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>
              {tarjeta.nombre_banco}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace', marginTop: 2 }}>
              •••• {tarjeta.numero}
              {tarjeta.numero_cuenta && (
                <span style={{ marginLeft: 8, fontSize: 11 }}>· cta. {tarjeta.numero_cuenta.slice(-6)}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: isCredito ? '#fef2f2' : '#eff6ff',
              color: isCredito ? '#dc2626' : '#2563eb',
            }}>
              {isCredito ? '💳 Crédito' : '🏦 Débito'}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: `${color}15`, color,
            }}>
              {tarjeta.moneda}
            </span>
          </div>
        </div>

        {/* Montos */}
        <div style={{ display: 'grid', gridTemplateColumns: isCredito ? '1fr 1fr' : '1fr', gap: 10, marginBottom: isCredito || pct !== null ? 14 : 0 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>
              {isCredito ? 'Saldo disponible' : 'Saldo actual'}
            </div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 16, color: '#16a34a' }}>
              {fmt(tarjeta.saldo_actual, tarjeta.moneda)}
            </div>
          </div>
          {isCredito && (
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginBottom: 3 }}>Deuda actual</div>
              <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 16, color: '#ef4444' }}>
                {fmt(tarjeta.deuda_actual, tarjeta.moneda)}
              </div>
            </div>
          )}
        </div>

        {/* Barra uso crédito */}
        {pct !== null && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Uso del crédito</span>
              <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: colorBarra }}>{pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 7, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: colorBarra, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Límite: {fmt(tarjeta.limite_credito, tarjeta.moneda)}
            </div>
          </div>
        )}

        {/* Fechas crédito */}
        {isCredito && (tarjeta.fecha_corte || tarjeta.fecha_limite_pago) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Corte</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginTop: 1 }}>{fmtFecha(tarjeta.fecha_corte)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Límite de pago</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginTop: 1 }}>{fmtFecha(tarjeta.fecha_limite_pago)}</div>
            </div>
          </div>
        )}

        {/* Tasa interés */}
        {isCredito && tarjeta.tasa_interes_anual > 0 && (
          <div style={{
            marginBottom: 14, padding: '7px 11px', borderRadius: 8,
            background: '#fff7ed', border: '1px solid #fed7aa',
            fontSize: 12, fontWeight: 600, color: '#c2410c',
          }}>
            🔥 Tasa anual: <strong>{tarjeta.tasa_interes_anual}%</strong>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, borderTop: '1.5px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          <button onClick={() => onMovimiento(tarjeta)} style={{
            ...btnSmall,
            background: color, color: 'white', border: 'none',
            boxShadow: `0 2px 8px ${color}40`,
          }}>
            {isCredito ? '💰 Pago / Cargo' : '↑↓ Mover dinero'}
          </button>
          <button onClick={() => onEdit(tarjeta)} style={{
            ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)',
          }}>✏️ Editar</button>
          <button onClick={() => onToggleDetalle(tarjeta.id)} style={{
            ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)',
          }}>
            {mostrarDetalle ? '▲ Ocultar' : '▼ Historial'}
          </button>
          <button onClick={() => onDelete(tarjeta.id, tarjeta.nombre_banco)} style={{
            ...btnSmall, background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', marginLeft: 'auto',
          }}>🗑️</button>
        </div>
      </div>

      {/* Historial expandible */}
      {mostrarDetalle && (
        <div style={{ borderTop: '1.5px solid var(--border)', background: 'var(--bg)', padding: '14px 18px' }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
            📋 Últimos movimientos
          </div>
          {loadHist ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Cargando...</div>
          ) : !historial || historial.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Aún no hay movimientos registrados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historial.map(m => {
                const ic = ICONO_MOVIMIENTO[m.tipo] || { e: '·', c: 'var(--text3)' }
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'white', borderRadius: 8, padding: '8px 12px',
                    border: '1px solid var(--border)', fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, color: ic.c, fontSize: 15 }}>{ic.e}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text2)', fontSize: 12 }}>
                          {m.descripcion || m.tipo}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: ic.c, fontSize: 14 }}>
                      {['retiro', 'cargo'].includes(m.tipo) ? '-' : '+'}{fmt(m.monto, tarjeta.moneda)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────
function EmptyState({ filtro, onNueva }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>{filtro === 'credito' ? '💳' : '🏦'}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
        No hay tarjetas {filtro === 'credito' ? 'de crédito' : 'de débito'} registradas
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Agrega tu primera tarjeta para llevar el control de tus {filtro === 'credito' ? 'deudas y pagos' : 'cuentas y saldos'}
      </div>
      <button onClick={onNueva} style={{
        background: filtro === 'credito' ? '#dc2626' : '#2563eb',
        color: 'white', border: 'none', borderRadius: 10,
        padding: '10px 20px', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'Poppins',
      }}>
        + Agregar tarjeta
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────
export default function Tarjetas({ usuarioId }) {
  const [tarjetas,     setTarjetas]     = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [filtro,       setFiltro]       = useState('credito')
  const [modalNueva,   setModalNueva]   = useState(false)
  const [editando,     setEditando]     = useState(null)
  const [moviendo,     setMoviendo]     = useState(null)
  const [detalleId,    setDetalleId]    = useState(null)
  const [historial,    setHistorial]    = useState({})
  const [loadHist,     setLoadHist]     = useState(false)
  const [deletingId,   setDeletingId]   = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('tarjetas_credito')
      .select('*')
      .order('creado_en', { ascending: false })
    setTarjetas(data || [])
    setCargando(false)
  }

  async function cargarHistorial(tarjetaId) {
    if (historial[tarjetaId]) return
    setLoadHist(true)
    const { data } = await supabase
      .from('movimientos_tarjeta')
      .select('*')
      .eq('tarjeta_id', tarjetaId)
      .order('fecha', { ascending: false })
      .limit(20)
    setHistorial(prev => ({ ...prev, [tarjetaId]: data || [] }))
    setLoadHist(false)
  }

  function toggleDetalle(id) {
    const nuevo = detalleId === id ? null : id
    setDetalleId(nuevo)
    if (nuevo) cargarHistorial(nuevo)
  }

  async function handleDelete(id, nombre) {
    if (!confirm(`¿Eliminar la tarjeta de ${nombre}? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    await supabase.from('tarjetas_credito').delete().eq('id', id)
    setTarjetas(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  function onGuardado() {
    setHistorial({}) // limpiar caché de historial
    cargar()
  }

  // ── Datos ─────────────────────────────────────────────
  const credito  = tarjetas.filter(t => t.tipo === 'credito' || !t.tipo) // compatibilidad con registros anteriores
  const debito   = tarjetas.filter(t => t.tipo === 'debito')
  const lista    = filtro === 'credito' ? credito : debito

  const deudaTotal    = credito.reduce((s, t) => s + Number(t.deuda_actual   || 0), 0)
  const limiteTotal   = credito.reduce((s, t) => s + Number(t.limite_credito || 0), 0)
  const saldoCredito  = credito.reduce((s, t) => s + Number(t.saldo_actual   || 0), 0)
  const saldoDebito   = debito.reduce((s,  t) => s + Number(t.saldo_actual   || 0), 0)
  const usoPromedio   = limiteTotal > 0 ? (deudaTotal / limiteTotal) * 100 : 0

  return (
    <div style={{ padding: 28 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard emoji="💳" label="Deuda en crédito" value={fmt(deudaTotal)}
          color="#ef4444" bg="#fef2f2"
          sub={`${credito.length} tarjeta${credito.length !== 1 ? 's' : ''} · ${usoPromedio.toFixed(0)}% uso`} />
        <KpiCard emoji="📊" label="Límite total" value={fmt(limiteTotal)}
          color={usoPromedio >= 80 ? '#ef4444' : '#2563eb'} bg={usoPromedio >= 80 ? '#fef2f2' : '#eff6ff'}
          sub={`Disponible: ${fmt(saldoCredito)}`} />
        <KpiCard emoji="🏦" label="Saldo en débito" value={fmt(saldoDebito)}
          color="#16a34a" bg="#f0fdf4"
          sub={`${debito.length} tarjeta${debito.length !== 1 ? 's' : ''} de débito`} />
        <KpiCard emoji="💰" label="Activos totales" value={fmt(saldoDebito + saldoCredito)}
          color="#7c3aed" bg="#f5f3ff"
          sub={`${tarjetas.length} tarjeta${tarjetas.length !== 1 ? 's' : ''} en total`} />
      </div>

      {/* ── Tabs + Botón ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'credito', label: `💳 Crédito (${credito.length})` },
            { v: 'debito',  label: `🏦 Débito (${debito.length})`  },
          ].map(t => (
            <div key={t.v} onClick={() => setFiltro(t.v)} style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: filtro === t.v ? (t.v === 'credito' ? '#dc2626' : '#2563eb') : 'white',
              color: filtro === t.v ? 'white' : 'var(--text2)',
              border: `1.5px solid ${filtro === t.v ? (t.v === 'credito' ? '#dc2626' : '#2563eb') : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}>{t.label}</div>
          ))}
        </div>
        <button onClick={() => setModalNueva(true)} style={{
          background: filtro === 'credito' ? '#dc2626' : '#2563eb',
          color: 'white', border: 'none',
          borderRadius: 10, padding: '9px 18px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
          boxShadow: `0 3px 10px ${filtro === 'credito' ? 'rgba(220,38,38,0.3)' : 'rgba(37,99,235,0.3)'}`,
        }}>
          + Nueva tarjeta
        </button>
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Cargando...</div>
      ) : lista.length === 0 ? (
        <EmptyState filtro={filtro} onNueva={() => setModalNueva(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {lista.map(tarjeta => (
            <div key={tarjeta.id} style={{
              opacity: deletingId === tarjeta.id ? 0.5 : 1,
              pointerEvents: deletingId === tarjeta.id ? 'none' : 'auto',
              transition: 'opacity 0.2s',
            }}>
              <TarjetaCard
                tarjeta={tarjeta}
                onEdit={t => setEditando(t)}
                onMovimiento={t => setMoviendo(t)}
                onDelete={handleDelete}
                onToggleDetalle={toggleDetalle}
                mostrarDetalle={detalleId === tarjeta.id}
                historial={historial[tarjeta.id]}
                loadHist={loadHist}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Modales ── */}
      {modalNueva && (
        <TarjetaForm
          usuarioId={usuarioId}
          onClose={() => setModalNueva(false)}
          onGuardado={onGuardado}
        />
      )}
      {editando && (
        <TarjetaForm
          usuarioId={usuarioId}
          tarjeta={editando}
          onClose={() => setEditando(null)}
          onGuardado={onGuardado}
        />
      )}
      {moviendo && (
        <MovimientoTarjetaForm
          usuarioId={usuarioId}
          tarjeta={moviendo}
          onClose={() => setMoviendo(null)}
          onGuardado={() => {
            setHistorial({})
            setMoviendo(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}

const btnSmall = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
  transition: 'all 0.15s',
}
