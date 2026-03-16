import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, fmtCCI, TIPO_MAP, TIPOS_CUENTA, ICONO_MOV,
  CLASIFICACION_MAP, calcularSaldoRealCuentas, calcularPatrimonioIntangible,
} from '../lib/cuentasUtils'
import CuentaForm from '../components/CuentaForm'
import MovimientoCuentaForm from '../components/MovimientoCuentaForm'

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

// ── Badge de clasificación ────────────────────────────────
function ClasifBadge({ clasificacion }) {
  const c = CLASIFICACION_MAP[clasificacion] || CLASIFICACION_MAP['disponible']
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: c.bg, color: c.color,
    }}>
      {c.emoji} {c.label}
    </span>
  )
}

// ── Card de cuenta ────────────────────────────────────────
function CuentaCard({ cuenta, onEdit, onMovimiento, onDelete, onToggleDetalle, mostrarDetalle, historial, loadHist }) {
  const tipo  = TIPO_MAP[cuenta.tipo] || { emoji: '🏦', label: cuenta.tipo, color: '#2563eb' }
  const color = cuenta.color || tipo.color
  const esCredito = cuenta.tipo === 'credito_entidad'
  const esSueldo  = cuenta.tipo === 'sueldo'

  const pct = esCredito && cuenta.limite_credito > 0
    ? Math.min((cuenta.deuda_actual / cuenta.limite_credito) * 100, 100)
    : null
  const colorBarra = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : '#22c55e'

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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Nunito', fontWeight: 900, fontSize: 16,
              color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {tipo.emoji} {cuenta.nombre}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {cuenta.banco && <span>{cuenta.banco}</span>}
              {cuenta.plataforma && <span>{cuenta.plataforma}</span>}
              {cuenta.numero_cuenta && <span style={{ marginLeft: 6, fontFamily: 'monospace' }}>···{cuenta.numero_cuenta.slice(-4)}</span>}
              {cuenta.numero_telefono && <span style={{ marginLeft: 6 }}>{cuenta.numero_telefono}</span>}
            </div>
            {/* CCI si existe */}
            {cuenta.cci && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace' }}>
                CCI: {fmtCCI(cuenta.cci)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: `${color}15`, color,
            }}>
              {tipo.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>
              {cuenta.moneda}
            </span>
            {/* Badge de clasificación */}
            {cuenta.clasificacion_saldo && cuenta.clasificacion_saldo !== 'disponible' && (
              <ClasifBadge clasificacion={cuenta.clasificacion_saldo} />
            )}
          </div>
        </div>

        {/* Saldo principal */}
        <div style={{ display: 'grid', gridTemplateColumns: esCredito ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>
              {esCredito ? 'Saldo disponible' : 'Saldo actual'}
            </div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, color }}>
              {fmt(cuenta.saldo_actual, cuenta.moneda)}
            </div>
            {/* Indicador si NO es dinero inmediato */}
            {cuenta.es_dinero_inmediato === false && (
              <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, marginTop: 2 }}>
                🔒 No suma al saldo disponible
              </div>
            )}
          </div>
          {esCredito && (
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginBottom: 3 }}>Deuda actual</div>
              <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, color: '#ef4444' }}>
                {fmt(cuenta.deuda_actual, cuenta.moneda)}
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
              Límite: {fmt(cuenta.limite_credito, cuenta.moneda)}
            </div>
          </div>
        )}

        {/* Info sueldo */}
        {esSueldo && (cuenta.entidad_pagadora || cuenta.dia_pago) && (
          <div style={{
            marginBottom: 14, padding: '8px 12px', borderRadius: 8,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            fontSize: 12, fontWeight: 600, color: '#15803d',
          }}>
            💼 {cuenta.entidad_pagadora || 'Empleador'}
            {cuenta.dia_pago && <span style={{ marginLeft: 8 }}>· Pago día {cuenta.dia_pago}</span>}
          </div>
        )}

        {/* Tasa interés / ahorro */}
        {cuenta.tasa_anual > 0 && (
          <div style={{
            marginBottom: 14, padding: '7px 11px', borderRadius: 8,
            background: esCredito ? '#fff7ed' : '#eff6ff',
            border: `1px solid ${esCredito ? '#fed7aa' : '#bfdbfe'}`,
            fontSize: 12, fontWeight: 600, color: esCredito ? '#c2410c' : '#1d4ed8',
          }}>
            {esCredito ? '🔥' : '📈'} Tasa anual: <strong>{cuenta.tasa_anual}%</strong>
          </div>
        )}

        {/* Fecha vencimiento crédito */}
        {esCredito && cuenta.fecha_vencimiento && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
            📅 Vence: <strong style={{ color: 'var(--text2)' }}>{fmtFecha(cuenta.fecha_vencimiento)}</strong>
          </div>
        )}

        {/* Notas */}
        {cuenta.notas && (
          <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 12 }}>
            {cuenta.notas}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, borderTop: '1.5px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          <button onClick={() => onMovimiento(cuenta)} style={{
            ...btnSmall, background: color, color: 'white', border: 'none',
            boxShadow: `0 2px 8px ${color}40`,
          }}>
            {esSueldo ? '💼 Cobrar / Mover' : esCredito ? '💸 Pago / Uso' : '↑↓ Mover dinero'}
          </button>
          <button onClick={() => onEdit(cuenta)} style={{
            ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)',
          }}>✏️ Editar</button>
          <button onClick={() => onToggleDetalle(cuenta.id)} style={{
            ...btnSmall, background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)',
          }}>
            {mostrarDetalle ? '▲ Ocultar' : '▼ Historial'}
          </button>
          <button onClick={() => onDelete(cuenta.id, cuenta.nombre)} style={{
            ...btnSmall, background: '#fef2f2', color: '#dc2626',
            border: '1.5px solid #fecaca', marginLeft: 'auto',
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
                const ic = ICONO_MOV[m.tipo] || { e: '·', c: 'var(--text3)', label: m.tipo }
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'white', borderRadius: 8, padding: '8px 12px',
                    border: '1px solid var(--border)', fontSize: 13,
                  }}>
                    <span style={{ fontSize: 15, color: ic.c, fontWeight: 800, flexShrink: 0 }}>{ic.e}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.descripcion || ic.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: ic.c, fontSize: 14, flexShrink: 0 }}>
                      {['retiro', 'transferencia', 'pago_cuota'].includes(m.tipo) ? '-' : '+'}
                      {fmt(m.monto, cuenta.moneda)}
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
  const t = TIPO_MAP[filtro]
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>{t?.emoji || '🏦'}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
        No hay {t?.label?.toLowerCase() || 'cuentas'} registradas
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        {t?.desc || 'Agrega tu primera cuenta para llevar el control de tus saldos'}
      </div>
      <button onClick={onNueva} style={{
        background: t?.color || '#2563eb', color: 'white', border: 'none',
        borderRadius: 10, padding: '10px 20px', fontSize: 13,
        fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
      }}>
        + Agregar cuenta
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────
export default function Cuentas({ usuarioId }) {
  const [cuentas,    setCuentas]    = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [filtro,     setFiltro]     = useState('todas')
  const [modalNueva, setModalNueva] = useState(false)
  const [editando,   setEditando]   = useState(null)
  const [moviendo,   setMoviendo]   = useState(null)
  const [detalleId,  setDetalleId]  = useState(null)
  const [historial,  setHistorial]  = useState({})
  const [loadHist,   setLoadHist]   = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('cuentas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('activa', true)
      .neq('tipo', 'efectivo')
      .order('creado_en', { ascending: true })
    setCuentas(data || [])
    setCargando(false)
  }

  async function cargarHistorial(id) {
    if (historial[id]) return
    setLoadHist(true)
    const { data } = await supabase
      .from('movimientos_cuenta')
      .select('*')
      .eq('cuenta_id', id)
      .order('fecha', { ascending: false })
      .limit(20)
    setHistorial(prev => ({ ...prev, [id]: data || [] }))
    setLoadHist(false)
  }

  function toggleDetalle(id) {
    const nuevo = detalleId === id ? null : id
    setDetalleId(nuevo)
    if (nuevo) cargarHistorial(nuevo)
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar la cuenta "${nombre}"? Se eliminará también el historial.`)) return
    setDeletingId(id)
    await supabase.from('cuentas').update({ activa: false }).eq('id', id)
    setCuentas(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  function onGuardado() {
    setHistorial({})
    cargar()
  }

  // ── Cálculos KPI ──────────────────────────────────────
  const sueldo   = cuentas.filter(c => c.tipo === 'sueldo')
  const ahorro   = cuentas.filter(c => c.tipo === 'ahorro_digital')
  const billeter = cuentas.filter(c => c.tipo === 'billetera_digital')
  const efectivo = cuentas.filter(c => c.tipo === 'efectivo')
  const corrient = cuentas.filter(c => c.tipo === 'corriente')
  const creditos = cuentas.filter(c => c.tipo === 'credito_entidad')

  // Saldo real = solo cuentas con es_dinero_inmediato = true (o null, retrocompatible)
  const saldoReal         = calcularSaldoRealCuentas(cuentas)
  // Patrimonio intangible = cuentas marcadas como NO dinero inmediato
  const patrimonioIntang  = calcularPatrimonioIntangible(cuentas)
  const totalDeuda        = creditos.reduce((s, c) => s + Number(c.deuda_actual || 0), 0)
  const totalBilleteras   = billeter.reduce((s, c) => s + Number(c.saldo_actual || 0), 0)

  const FILTROS = [
    { v: 'todas',            label: `Todas (${cuentas.length})` },
    { v: 'sueldo',           label: `💼 Sueldo (${sueldo.length})` },
    { v: 'ahorro_digital',   label: `🏦 Ahorro (${ahorro.length})` },
    { v: 'billetera_digital',label: `📱 Billeteras (${billeter.length})` },
    { v: 'corriente',        label: `🔄 Corriente (${corrient.length})` },
    { v: 'credito_entidad',  label: `🏛️ Crédito (${creditos.length})` },
  ].filter(f => f.v === 'todas' || cuentas.some(c => c.tipo === f.v))

  const lista = filtro === 'todas' ? cuentas : cuentas.filter(c => c.tipo === filtro)

  // Distribución por tipo para la barra (solo cuentas con dinero inmediato)
  const COLORES_TIPO = { sueldo: '#16a34a', ahorro_digital: '#2563eb', billetera_digital: '#7c3aed', efectivo: '#15803d', corriente: '#0891b2' }
  const distribucion = TIPOS_CUENTA
    .filter(t => t.valor !== 'credito_entidad')
    .map(t => ({
      ...t,
      total: cuentas
        .filter(c => c.tipo === t.valor && c.es_dinero_inmediato !== false)
        .reduce((s, c) => s + Number(c.saldo_actual || 0), 0),
      count: cuentas.filter(c => c.tipo === t.valor).length,
    }))
    .filter(t => t.count > 0 && t.total > 0)

  return (
    <div style={{ padding: 28 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {/* KPI 1: Saldo real disponible (solo dinero inmediato) */}
        <KpiCard emoji="💰" label="Saldo real disponible" value={fmt(saldoReal)}
          color="#16a34a" bg="#f0fdf4"
          sub={`${cuentas.filter(c => c.es_dinero_inmediato !== false && c.tipo !== 'credito_entidad').length} cuenta(s) activas`} />

        {/* KPI 2: Patrimonio intangible/bloqueado */}
        <KpiCard emoji="🔒" label="Ahorros / Reservas" value={fmt(patrimonioIntang)}
          color="#7c3aed" bg="#f5f3ff"
          sub="CTS, plazo fijo, fondos reservados" />

        {/* KPI 3: Billeteras digitales */}
        <KpiCard emoji="📱" label="En billeteras" value={fmt(totalBilleteras)}
          color="#7c3aed" bg="#f5f3ff"
          sub="Yape, Plin y otros" />

        {/* KPI 4: Deuda en créditos */}
        <KpiCard emoji="🏛️" label="Deuda entidades" value={fmt(totalDeuda)}
          color={totalDeuda > 0 ? '#dc2626' : '#16a34a'}
          bg={totalDeuda > 0 ? '#fef2f2' : '#f0fdf4'}
          sub={`${creditos.length} línea${creditos.length !== 1 ? 's' : ''} de crédito`} />
      </div>

      {/* ── Distribución de saldo real ── */}
      {distribucion.length > 1 && (
        <div style={{
          background: 'white', borderRadius: 16,
          border: '1.5px solid var(--border)',
          padding: '16px 20px', marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 14, marginBottom: 12 }}>
            📊 Distribución de saldo disponible
          </div>
          <div style={{ display: 'flex', gap: 0, height: 10, borderRadius: 999, overflow: 'hidden', marginBottom: 12, background: 'var(--bg)' }}>
            {distribucion.map(t => {
              const pct = saldoReal > 0 ? (t.total / saldoReal) * 100 : 0
              return pct > 0 ? (
                <div key={t.valor} style={{ width: `${pct}%`, background: COLORES_TIPO[t.valor] || t.color, minWidth: 4, transition: 'width 0.5s' }} />
              ) : null
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
            {distribucion.map(t => (
              <div key={t.valor} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORES_TIPO[t.valor] || t.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text2)' }}>{t.emoji} {t.label}</span>
                <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: COLORES_TIPO[t.valor] || t.color }}>{fmt(t.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filtros + Botón ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS.map(f => (
            <div key={f.v} onClick={() => setFiltro(f.v)} style={{
              padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: filtro === f.v ? '#2563eb' : 'white',
              color: filtro === f.v ? 'white' : 'var(--text2)',
              border: `1.5px solid ${filtro === f.v ? '#2563eb' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}>{f.label}</div>
          ))}
        </div>
        <button onClick={() => setModalNueva(true)} style={{
          background: '#2563eb', color: 'white', border: 'none',
          borderRadius: 10, padding: '9px 18px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
          boxShadow: '0 3px 10px rgba(37,99,235,0.3)',
        }}>
          + Nueva cuenta
        </button>
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Cargando...</div>
      ) : lista.length === 0 ? (
        <EmptyState filtro={filtro === 'todas' ? 'ahorro_digital' : filtro} onNueva={() => setModalNueva(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {lista.map(cuenta => (
            <div key={cuenta.id} style={{
              opacity: deletingId === cuenta.id ? 0.5 : 1,
              pointerEvents: deletingId === cuenta.id ? 'none' : 'auto',
              transition: 'opacity 0.2s',
            }}>
              <CuentaCard
                cuenta={cuenta}
                onEdit={c => setEditando(c)}
                onMovimiento={c => setMoviendo(c)}
                onDelete={eliminar}
                onToggleDetalle={toggleDetalle}
                mostrarDetalle={detalleId === cuenta.id}
                historial={historial[cuenta.id]}
                loadHist={loadHist}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Modales ── */}
      {modalNueva && (
        <CuentaForm
          usuarioId={usuarioId}
          onClose={() => setModalNueva(false)}
          onGuardado={onGuardado}
        />
      )}
      {editando && (
        <CuentaForm
          usuarioId={usuarioId}
          cuenta={editando}
          onClose={() => setEditando(null)}
          onGuardado={onGuardado}
        />
      )}
      {moviendo && (
        <MovimientoCuentaForm
          usuarioId={usuarioId}
          cuenta={moviendo}
          todasLasCuentas={cuentas}
          onClose={() => setMoviendo(null)}
          onGuardado={() => { setHistorial({}); setMoviendo(null); cargar() }}
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
