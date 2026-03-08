import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, diasHastaProximoPago, urgencia,
  pctPagado, interesMensualEstimado, TIPO_MAP,
} from '../lib/deudasUtils'
import DeudaForm from '../components/DeudaForm'
import PagoForm  from '../components/PagoForm'

export default function Deudas({ usuarioId }) {
  const [deudas,         setDeudas]         = useState([])
  const [cargando,       setCargando]        = useState(true)
  const [filtro,         setFiltro]          = useState('activa')   // activa | pagada | me_deben
  const [modalNueva,     setModalNueva]      = useState(false)
  const [deudaEditar,    setDeudaEditar]     = useState(null)
  const [deudaPagar,     setDeudaPagar]      = useState(null)
  const [deudaDetalle,   setDeudaDetalle]    = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('deudas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false })
    setDeudas(data || [])
    setCargando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta deuda y su historial de pagos?')) return
    await supabase.from('deudas').delete().eq('id', id)
    cargar()
  }

  async function marcarPagada(deuda) {
    await supabase.from('deudas').update({
      estado: deuda.estado === 'pagada' ? 'activa' : 'pagada',
      monto_pendiente: deuda.estado === 'pagada' ? deuda.monto_total : 0,
      actualizado_en: new Date().toISOString(),
    }).eq('id', deuda.id)
    cargar()
  }

  // ── Totales ───────────────────────────────────────────────
  const activas   = deudas.filter(d => d.estado === 'activa'  && d.direccion === 'debo')
  const pagadas   = deudas.filter(d => d.estado === 'pagada')
  const meDeben   = deudas.filter(d => d.direccion === 'me_deben' && d.estado === 'activa')

  const totalPendiente    = activas.reduce((s, d) => s + Number(d.monto_pendiente), 0)
  const totalMeDeben      = meDeben.reduce((s, d) => s + Number(d.monto_pendiente), 0)
  const pagoMensualTotal  = activas.reduce((s, d) => s + (d.monto_cuota ? Number(d.monto_cuota) : 0), 0)
  const interesTotal      = activas.reduce((s, d) => s + interesMensualEstimado(d), 0)

  const listaMostrada = filtro === 'activa'   ? activas
                      : filtro === 'pagada'   ? pagadas
                      : meDeben

  return (
    <div style={{ padding: 28 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <KpiDeuda emoji="💳" label="Total que debes" value={fmt(totalPendiente)}
          color="#ef4444" colorLight="#fee2e2"
          sub={`${activas.length} deuda${activas.length !== 1 ? 's' : ''} activa${activas.length !== 1 ? 's' : ''}`} />
        <KpiDeuda emoji="📅" label="Pago mensual" value={fmt(pagoMensualTotal)}
          color="#f97316" colorLight="#ffedd5" sub="Comprometido este mes" />
        <KpiDeuda emoji="🔥" label="Interés mensual" value={fmt(interesTotal)}
          color="#dc2626" colorLight="#fef2f2"
          sub={interesTotal > 0 ? '⚠️ Dinero que pierdes' : '✅ Sin intereses'} />
        <KpiDeuda emoji="📥" label="Te deben a ti" value={fmt(totalMeDeben)}
          color="#14b8a6" colorLight="#ccfbf1"
          sub={`${meDeben.length} deuda${meDeben.length !== 1 ? 's' : ''} por cobrar`} />
      </div>

      {/* ── Tabs + Botón ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'activa',   label: `💳 Debo (${activas.length})` },
            { v: 'me_deben', label: `📥 Me deben (${meDeben.length})` },
            { v: 'pagada',   label: `✅ Pagadas (${pagadas.length})` },
          ].map(t => (
            <div key={t.v} onClick={() => setFiltro(t.v)} style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: filtro === t.v ? '#ef4444' : 'white',
              color: filtro === t.v ? 'white' : 'var(--text2)',
              border: `1.5px solid ${filtro === t.v ? '#ef4444' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}>{t.label}</div>
          ))}
        </div>
        <button onClick={() => setModalNueva(true)} style={{
          background: '#ef4444', color: 'white', border: 'none',
          borderRadius: 10, padding: '9px 18px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
          boxShadow: '0 3px 10px rgba(239,68,68,0.3)',
        }}>+ Nueva deuda</button>
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Cargando...</div>
      ) : listaMostrada.length === 0 ? (
        <EmptyState filtro={filtro} onNueva={() => setModalNueva(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {listaMostrada.map(deuda => (
            <DeudaCard
              key={deuda.id}
              deuda={deuda}
              onEditar={() => setDeudaEditar(deuda)}
              onPagar={() => setDeudaPagar(deuda)}
              onEliminar={() => eliminar(deuda.id)}
              onMarcarPagada={() => marcarPagada(deuda)}
              onDetalle={() => setDeudaDetalle(deudaDetalle?.id === deuda.id ? null : deuda)}
              mostrarDetalle={deudaDetalle?.id === deuda.id}
              usuarioId={usuarioId}
            />
          ))}
        </div>
      )}

      {/* ── Modales ── */}
      {modalNueva && (
        <DeudaForm usuarioId={usuarioId}
          onClose={() => setModalNueva(false)}
          onGuardado={cargar} />
      )}
      {deudaEditar && (
        <DeudaForm usuarioId={usuarioId} deuda={deudaEditar}
          onClose={() => setDeudaEditar(null)}
          onGuardado={cargar} />
      )}
      {deudaPagar && (
        <PagoForm usuarioId={usuarioId} deuda={deudaPagar}
          onClose={() => setDeudaPagar(null)}
          onGuardado={cargar} />
      )}
    </div>
  )
}

// ── Tarjeta de deuda ──────────────────────────────────────
function DeudaCard({ deuda, onEditar, onPagar, onEliminar, onMarcarPagada, onDetalle, mostrarDetalle, usuarioId }) {
  const tipo    = TIPO_MAP[deuda.tipo] || { emoji: '📌', label: deuda.tipo, color: '#64748b' }
  const dias    = diasHastaProximoPago(deuda)
  const urg     = urgencia(dias)
  const pct     = pctPagado(deuda)
  const interes = interesMensualEstimado(deuda)
  const esPagada = deuda.estado === 'pagada'

  const [historial, setHistorial] = useState([])
  const [loadHist,  setLoadHist]  = useState(false)

  useEffect(() => {
    if (mostrarDetalle) cargarHistorial()
  }, [mostrarDetalle])

  async function cargarHistorial() {
    setLoadHist(true)
    const { data } = await supabase.from('pagos_deuda')
      .select('*').eq('deuda_id', deuda.id)
      .order('fecha', { ascending: false })
    setHistorial(data || [])
    setLoadHist(false)
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: `1.5px solid ${esPagada ? '#bbf7d0' : 'var(--border)'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      opacity: esPagada ? 0.8 : 1,
    }}>
      {/* Fila principal */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

          {/* Ícono tipo */}
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `${tipo.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>{tipo.emoji}</div>

          {/* Info principal */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 15 }}>
                {deuda.nombre}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: `${tipo.color}15`, color: tipo.color,
              }}>{tipo.label}</span>
              {deuda.tiene_interes && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: '#fef2f2', color: '#dc2626',
                }}>🔥 {deuda.tasa_anual ? `TEA ${deuda.tasa_anual}%` : `TEM ${deuda.tasa_mensual}%`}</span>
              )}
              {esPagada && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✅ Pagada</span>}
              {deuda.contacto_nombre && (
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
                  👤 {deuda.contacto_nombre}
                </span>
              )}
            </div>

            {/* Detalles cuotas */}
            {deuda.es_en_cuotas && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, fontWeight: 500 }}>
                Cuota {(deuda.cuotas_pagadas || 0) + 1} de {deuda.total_cuotas}
                {deuda.monto_cuota && ` · ${fmt(deuda.monto_cuota)}/mes`}
              </div>
            )}

            {/* Barra de progreso */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>
                  Pagado: {fmt(deuda.monto_total - deuda.monto_pendiente)}
                </span>
                <span style={{ fontWeight: 700, color: tipo.color }}>
                  {pct}%
                </span>
              </div>
              <div style={{ height: 7, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{
                  height: '100%', borderRadius: 999, transition: 'width 0.5s',
                  width: `${pct}%`,
                  background: esPagada ? '#22c55e' : tipo.color,
                }} />
              </div>
            </div>
          </div>

          {/* Monto + Vencimiento */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: 'Nunito', fontWeight: 900, fontSize: 18,
              color: esPagada ? '#22c55e' : '#ef4444',
            }}>
              {fmt(deuda.monto_pendiente)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              de {fmt(deuda.monto_total)}
            </div>

            {/* Badge urgencia */}
            {!esPagada && dias !== null && (
              <div style={{
                marginTop: 6, fontSize: 11, fontWeight: 700, padding: '3px 8px',
                borderRadius: 20, background: urg.bg, color: urg.color, display: 'inline-block',
              }}>
                {urg.emoji} Paga en {urg.label}
              </div>
            )}
            {!esPagada && deuda.fecha_vencimiento && !deuda.es_en_cuotas && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                Vence {fmtFecha(deuda.fecha_vencimiento)}
              </div>
            )}
            {!esPagada && deuda.dia_pago_mes && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                Cada día {deuda.dia_pago_mes}
              </div>
            )}
          </div>
        </div>

        {/* Interés mensual estimado */}
        {interes > 0 && !esPagada && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fecaca',
            fontSize: 12, fontWeight: 600, color: '#dc2626',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            🔥 Esta deuda te cuesta aproximadamente <strong>{fmt(interes)}</strong> en intereses este mes
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {!esPagada && (
            <button onClick={onPagar} style={{
              ...btnSmall, background: tipo.color, color: 'white', border: 'none',
              boxShadow: `0 2px 8px ${tipo.color}40`,
            }}>✅ Registrar pago</button>
          )}
          <button onClick={onEditar} style={{ ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)' }}>
            ✏️ Editar
          </button>
          <button onClick={onDetalle} style={{ ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)' }}>
            {mostrarDetalle ? '▲ Ocultar' : '▼ Historial'}
          </button>
          <button onClick={onMarcarPagada} style={{ ...btnSmall, background: esPagada ? '#dcfce7' : 'var(--bg)', color: esPagada ? '#16a34a' : 'var(--text3)', border: `1.5px solid ${esPagada ? '#bbf7d0' : 'var(--border)'}` }}>
            {esPagada ? '↩ Reactivar' : '🏁 Marcar pagada'}
          </button>
          <button onClick={onEliminar} style={{ ...btnSmall, background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', marginLeft: 'auto' }}>
            🗑️
          </button>
        </div>
      </div>

      {/* Historial de pagos */}
      {mostrarDetalle && (
        <div style={{ borderTop: '1.5px solid var(--border)', background: 'var(--bg)', padding: '14px 18px' }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
            📋 Historial de pagos
          </div>
          {loadHist ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Cargando...</div>
          ) : historial.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Aún no hay pagos registrados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historial.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'white', borderRadius: 8, padding: '8px 12px',
                  border: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text3)', fontWeight: 600 }}>
                    {new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })}
                  </span>
                  <span style={{ color: 'var(--text2)', fontSize: 12 }}>{p.notas || '—'}</span>
                  <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: '#22c55e', fontSize: 14 }}>
                    -{fmt(p.monto)}
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

// ── Empty state ───────────────────────────────────────────
function EmptyState({ filtro, onNueva }) {
  const msgs = {
    activa:   { emoji: '🎉', title: '¡Sin deudas activas!', sub: 'Genial. Si tienes alguna, regístrala para no perderla de vista.' },
    pagada:   { emoji: '✅', title: 'Aún no has saldado deudas', sub: 'Cuando pagues una deuda completamente aparecerá aquí.' },
    me_deben: { emoji: '📥', title: 'Nadie te debe', sub: 'Si le prestaste dinero a alguien, regístralo aquí.' },
  }
  const m = msgs[filtro]
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>{m.emoji}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, marginBottom: 6 }}>{m.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>{m.sub}</div>
      {filtro !== 'pagada' && (
        <button onClick={onNueva} style={{
          background: '#ef4444', color: 'white', border: 'none',
          borderRadius: 10, padding: '10px 20px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer',
        }}>+ Agregar deuda</button>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────
function KpiDeuda({ emoji, label, value, sub, color, colorLight }) {
  return (
    <div style={{
      background: colorLight, borderRadius: 16,
      border: `1.5px solid ${color}30`, padding: 18,
      position: 'relative', overflow: 'hidden',
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
