import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtFecha, ICONO_MOV } from '../lib/cuentasUtils'
import CuentaForm from '../components/CuentaForm'
import MovimientoCuentaForm from '../components/MovimientoCuentaForm'

const COLOR = '#16a34a'
const BG    = '#f0fdf4'
const BORDE = '#86efac'

const S0 = n => `S/. ${Number(n||0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`

// ── Card de billetera efectivo ────────────────────────────
function EfectivoCard({ cuenta, onEdit, onMovimiento, onDelete, onToggleDetalle, mostrarDetalle, historial, loadHist }) {
  const color = cuenta.color || COLOR

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: '1.5px solid var(--border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{ height: 5, background: color }} />
      <div style={{ padding: '16px 18px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 17, color: 'var(--text)' }}>
              💵 {cuenta.nombre}
            </div>
            {cuenta.notas && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{cuenta.notas}</div>
            )}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
            background: `${color}15`, color,
          }}>Efectivo</span>
        </div>

        {/* Saldo */}
        <div style={{
          background: cuenta.es_dinero_inmediato ? BG : '#faf5ff',
          borderRadius: 12, padding: '14px 16px', marginBottom: 14,
          border: `1.5px solid ${cuenta.es_dinero_inmediato ? BORDE : '#e9d5ff'}`
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4,
            color: cuenta.es_dinero_inmediato ? '#15803d' : '#7c3aed'
          }}>
            {cuenta.es_dinero_inmediato ? '💰 Saldo disponible' : '🔒 No disponible'}
          </div>
          <div style={{
            fontFamily: 'Nunito', fontWeight: 900, fontSize: 28, letterSpacing: '-1px',
            color: cuenta.es_dinero_inmediato ? COLOR : '#7c3aed'
          }}>
            {fmt(cuenta.saldo_actual, cuenta.moneda || 'PEN')}
          </div>
          <div style={{ fontSize: 10, marginTop: 4,
            color: cuenta.es_dinero_inmediato ? '#15803d' : '#7c3aed'
          }}>
            {cuenta.moneda || 'PEN'} · {cuenta.es_dinero_inmediato ? 'dinero inmediato' : cuenta.clasificacion_saldo || 'no inmediato'}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onMovimiento(cuenta)} style={{
            flex: 2, padding: '8px 12px', borderRadius: 9, border: 'none',
            background: COLOR, color: 'white', fontFamily: 'Poppins',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
            boxShadow: `0 2px 8px ${COLOR}40`,
          }}>
            ↑↓ Movimiento
          </button>
          <button onClick={() => onEdit(cuenta)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 9, fontSize: 12,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
            background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)',
          }}>✏️ Editar</button>
          <button onClick={() => onToggleDetalle(cuenta.id)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 9, fontSize: 12,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
            background: 'var(--bg)', color: 'var(--text2)', border: '1.5px solid var(--border)',
          }}>
            {mostrarDetalle ? '▲' : '▼ Historial'}
          </button>
          <button onClick={() => onDelete(cuenta.id, cuenta.nombre)} style={{
            padding: '8px 10px', borderRadius: 9, fontSize: 12,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
            background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca',
          }}>🗑️</button>
        </div>
      </div>

      {/* Historial expandible */}
      {mostrarDetalle && (
        <div style={{ borderTop: '1.5px solid var(--border)', background: 'var(--bg)', padding: '14px 18px' }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
            📋 Historial de movimientos
          </div>
          {loadHist ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Cargando...</div>
          ) : !historial?.length ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sin movimientos registrados aún.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historial.map(m => {
                const ic = ICONO_MOV[m.tipo] || { e: '·', c: 'var(--text3)', label: m.tipo }
                const esPositivo = ['deposito', 'quincena'].includes(m.tipo)
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'white', borderRadius: 8, padding: '8px 12px',
                    border: '1px solid var(--border)',
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
                      {['retiro', 'transferencia', 'pago'].includes(m.tipo) ? '-' : '+'}
                      {fmt(m.monto, cuenta.moneda || 'PEN')}
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

// ── Página principal ──────────────────────────────────────
export default function Efectivo({ usuarioId }) {
  const [cuentas,    setCuentas]    = useState([])
  const [cargando,   setCargando]   = useState(true)
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
      .eq('tipo', 'efectivo')
      .eq('activa', true)
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
      .limit(30)
    setHistorial(prev => ({ ...prev, [id]: data || [] }))
    setLoadHist(false)
  }

  function toggleDetalle(id) {
    const nuevo = detalleId === id ? null : id
    setDetalleId(nuevo)
    if (nuevo) cargarHistorial(nuevo)
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar la billetera "${nombre}"?`)) return
    setDeletingId(id)
    await supabase.from('cuentas').update({ activa: false }).eq('id', id)
    setCuentas(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  function onGuardado() {
    setHistorial({})
    cargar()
  }

  const totalEfectivo = cuentas.filter(c => c.es_dinero_inmediato !== false).reduce((s, c) => s + Number(c.saldo_actual || 0), 0)

  // Últimos movimientos de todas las billeteras combinados (para la vista consolidada)
  const todosMovimientos = Object.values(historial).flat().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10)

  return (
    <div style={{ padding: 28 }}>

      {/* ── KPI total ── */}
      <div style={{
        background: `linear-gradient(135deg, ${BG}, #dcfce7)`,
        border: `1.5px solid ${BORDE}`,
        borderRadius: 16, padding: '20px 24px',
        marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
            💵 Total en efectivo
          </div>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 32, color: COLOR, letterSpacing: '-1px' }}>
            {fmt(totalEfectivo)}
          </div>
          <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
            {cuentas.length} billetera{cuentas.length !== 1 ? 's' : ''}
            {cuentas.some(c => c.es_dinero_inmediato === false) && ` · ${cuentas.filter(c => c.es_dinero_inmediato === false).length} no disponible`}
          </div>
        </div>
        <button onClick={() => setModalNueva(true)} style={{
          background: COLOR, color: 'white', border: 'none',
          borderRadius: 10, padding: '10px 20px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
          boxShadow: `0 3px 12px ${COLOR}40`,
        }}>
          + Nueva billetera
        </button>
      </div>

      {/* ── Lista de billeteras ── */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Cargando...</div>
      ) : cuentas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>💵</div>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            Sin billeteras registradas
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>
            Crea una billetera para llevar el control del efectivo que manejas día a día.
            Registra depósitos cuando recibes billetes y retiros cuando los gastas.
          </div>
          <button onClick={() => setModalNueva(true)} style={{
            background: COLOR, color: 'white', border: 'none',
            borderRadius: 10, padding: '10px 22px', fontSize: 13,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
          }}>
            + Nueva billetera
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {cuentas.map(cuenta => (
            <div key={cuenta.id} style={{
              opacity: deletingId === cuenta.id ? 0.4 : 1,
              pointerEvents: deletingId === cuenta.id ? 'none' : 'auto',
              transition: 'opacity 0.2s',
            }}>
              <EfectivoCard
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
          tipoForzado="efectivo"
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
