import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { diasHastaProximoPago, urgencia, fmt as fmtDeuda, TIPO_MAP } from '../lib/deudasUtils'

const CATEGORIA_INFO = {
  sueldo:       { emoji: '🏢', label: 'Sueldo' },
  freelance:    { emoji: '💻', label: 'Freelance' },
  bono:         { emoji: '🎁', label: 'Bono' },
  alquiler:     { emoji: '🏠', label: 'Alquiler ingreso' },
  dividendos:   { emoji: '💹', label: 'Dividendos' },
  otro_ingreso: { emoji: '➕', label: 'Otro ingreso' },
  casa:         { emoji: '🏘️', label: 'Casa' },
  comida:       { emoji: '🍔', label: 'Comida' },
  transporte:   { emoji: '🚗', label: 'Transporte' },
  salud:        { emoji: '💊', label: 'Salud' },
  educacion:    { emoji: '📚', label: 'Educación' },
  ropa:         { emoji: '👗', label: 'Ropa' },
  ocio:         { emoji: '🎮', label: 'Ocio' },
  suscripciones:{ emoji: '📱', label: 'Suscripciones' },
  seguros:      { emoji: '🛡️', label: 'Seguros' },
  imprevisto:   { emoji: '⚡', label: 'Imprevisto' },
  otro_gasto:   { emoji: '➕', label: 'Otro gasto' },
}

function fmt(n) {
  return `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}
function fmtFecha(f) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

export default function Dashboard({ usuarioId, recargar, onRegistrar }) {
  const [transacciones, setTransacciones] = useState([])
  const [deudas,        setDeudas]        = useState([])
  const [cargando,      setCargando]      = useState(true)

  const mesActual  = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  useEffect(() => { cargarTodo() }, [recargar])

  async function cargarTodo() {
    setCargando(true)
    const desde = `${anioActual}-${String(mesActual).padStart(2,'0')}-01`
    const hasta = `${anioActual}-${String(mesActual).padStart(2,'0')}-31`

    const [{ data: txs }, { data: dds }] = await Promise.all([
      supabase.from('transacciones').select('*')
        .eq('usuario_id', usuarioId)
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha', { ascending: false }),
      supabase.from('deudas').select('*')
        .eq('usuario_id', usuarioId)
        .eq('estado', 'activa')
        .eq('direccion', 'debo'),
    ])
    setTransacciones(txs || [])
    setDeudas(dds || [])
    setCargando(false)
  }

  // ── Totales transacciones ─────────────────────────────
  const totalIngresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((s,t) => s + Number(t.monto), 0)
  const totalGastos   = transacciones.filter(t => t.tipo === 'gasto').reduce((s,t) => s + Number(t.monto), 0)
  const balance       = totalIngresos - totalGastos
  const tasaAhorro    = totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(1) : 0

  // ── Alertas de deudas (próximas 15 días o vencidas) ──
  const alertasDeuda = deudas
    .map(d => ({ ...d, dias: diasHastaProximoPago(d) }))
    .filter(d => d.dias !== null && d.dias <= 15)
    .sort((a, b) => a.dias - b.dias)

  return (
    <div style={{ padding: 28 }}>

      {/* ── Alertas de deudas próximas ── */}
      {alertasDeuda.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 14, marginBottom: 10, color: '#991b1b' }}>
            🔔 Pagos próximos o vencidos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alertasDeuda.map(d => {
              const urg  = urgencia(d.dias)
              const tipo = TIPO_MAP[d.tipo] || { emoji: '💳' }
              return (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: urg.bg, border: `1.5px solid ${urg.color}40`,
                  borderLeft: `4px solid ${urg.color}`,
                  borderRadius: 12, padding: '12px 16px',
                  animation: 'slideIn 0.3s ease',
                }}>
                  <span style={{ fontSize: 20 }}>{tipo.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{d.nombre}</span>
                    <span style={{ fontSize: 12, color: urg.color, marginLeft: 8, fontWeight: 600 }}>
                      {d.dias < 0 ? '⚠️ Vencida hace ' + Math.abs(d.dias) + ' días'
                       : d.dias === 0 ? '⚡ Vence HOY'
                       : `Vence en ${d.dias} día${d.dias !== 1 ? 's' : ''}`}
                    </span>
                    {d.dia_pago_mes && <span style={{ fontSize: 11, color: urg.color, marginLeft: 6 }}>(cada día {d.dia_pago_mes})</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 15, color: urg.color }}>
                      {d.monto_cuota ? fmt(d.monto_cuota) : fmt(d.monto_pendiente)}
                    </div>
                    {d.monto_cuota && <div style={{ fontSize: 10, color: urg.color, opacity: 0.7 }}>cuota</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Título ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 20, marginBottom: 2 }}>
            👋 Tu resumen de {meses[mesActual - 1]} {anioActual}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            {transacciones.length === 0
              ? 'Aún no tienes transacciones este mes.'
              : `${transacciones.length} transacciones registradas`}
          </p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard emoji="💰" label="Tu balance" value={fmt(balance)}
          color={balance >= 0 ? '#6c63ff' : '#ef4444'}
          colorLight={balance >= 0 ? '#ede9ff' : '#fee2e2'}
          sub={balance >= 0 ? '¡Vas positivo!' : '⚠️ Gastas más de lo que entra'} />
        <KpiCard emoji="📥" label="Entró este mes" value={fmt(totalIngresos)}
          color="#22c55e" colorLight="#dcfce7"
          sub={`${transacciones.filter(t=>t.tipo==='ingreso').length} ingresos`} />
        <KpiCard emoji="📤" label="Salió este mes" value={fmt(totalGastos)}
          color="#f97316" colorLight="#ffedd5"
          sub={`${transacciones.filter(t=>t.tipo==='gasto').length} gastos`} />
        <KpiCard emoji="🐷" label="Tasa de ahorro" value={`${tasaAhorro}%`}
          color="#3b82f6" colorLight="#dbeafe"
          sub={tasaAhorro >= 20 ? '✅ Por encima del 20%' : 'Meta: llegar al 20%'} />
      </div>

      {/* ── Transacciones + Resumen deudas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>

        {/* Lista transacciones */}
        <div style={{
          background: 'white', borderRadius: 18,
          border: '1.5px solid var(--border)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px', borderBottom: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 15 }}>
              🧾 Últimas transacciones
            </div>
            <button onClick={onRegistrar} style={{
              background: '#6c63ff', color: 'white', border: 'none',
              borderRadius: 8, padding: '7px 14px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
            }}>+ Registrar</button>
          </div>

          {cargando ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Cargando...</div>
          ) : transacciones.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
              <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Sin transacciones</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Registra tu primer movimiento</div>
              <button onClick={onRegistrar} style={{
                background: '#6c63ff', color: 'white', border: 'none',
                borderRadius: 10, padding: '9px 18px', fontSize: 13,
                fontWeight: 700, cursor: 'pointer',
              }}>✨ Empezar</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Fecha','Descripción','Categoría','Monto'].map(h => (
                    <th key={h} style={{
                      textAlign: h === 'Monto' ? 'right' : 'left',
                      padding: '9px 14px', fontSize: 11,
                      color: 'var(--text3)', fontWeight: 700,
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                      borderBottom: '1.5px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transacciones.slice(0, 8).map((t, i) => {
                  const cat  = CATEGORIA_INFO[t.categoria] || { emoji: '📌', label: t.categoria }
                  const esIn = t.tipo === 'ingreso'
                  return (
                    <tr key={t.id} style={{ borderBottom: i < Math.min(transacciones.length, 8) - 1 ? '1.5px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fmtFecha(t.fecha)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.descripcion || cat.label}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600, padding: '3px 8px',
                          borderRadius: 20, background: 'var(--bg)',
                          border: '1.5px solid var(--border)', color: 'var(--text2)',
                          whiteSpace: 'nowrap',
                        }}>
                          {cat.emoji} {cat.label}
                        </span>
                      </td>
                      <td style={{
                        padding: '10px 14px', textAlign: 'right',
                        fontFamily: 'Nunito', fontWeight: 800, fontSize: 14,
                        color: esIn ? '#22c55e' : '#f97316', whiteSpace: 'nowrap',
                      }}>
                        {esIn ? '+' : '-'}{fmt(t.monto)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Resumen deudas activas */}
        <div style={{
          background: 'white', borderRadius: 18,
          border: '1.5px solid var(--border)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border)' }}>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 15 }}>💳 Mis deudas</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              Total pendiente: <strong style={{ color: '#ef4444' }}>{fmt(deudas.reduce((s,d) => s + Number(d.monto_pendiente), 0))}</strong>
            </div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {deudas.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                🎉 Sin deudas activas
              </div>
            ) : deudas.slice(0, 5).map(d => {
              const dias  = diasHastaProximoPago(d)
              const urg   = urgencia(dias)
              const tipo  = TIPO_MAP[d.tipo] || { emoji: '💳' }
              const pct   = Math.min(100, Math.round(((d.monto_total - d.monto_pendiente) / d.monto_total) * 100))
              return (
                <div key={d.id} style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{tipo.emoji}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</span>
                    <span style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 13, color: '#ef4444', whiteSpace: 'nowrap' }}>
                      {fmt(d.monto_pendiente)}
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#ef4444', borderRadius: 999 }} />
                  </div>
                  {dias !== null && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: urg.color }}>
                      {urg.emoji} {dias < 0 ? 'Vencida' : dias === 0 ? 'Vence HOY' : `Paga en ${dias}d`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({ emoji, label, value, sub, color, colorLight }) {
  return (
    <div style={{
      background: colorLight, borderRadius: 16,
      border: `1.5px solid ${color}40`, padding: 20,
      position: 'relative', overflow: 'hidden',
      cursor: 'pointer', transition: 'transform 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >
      <div style={{ fontSize: 26, marginBottom: 8 }}>{emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 22, color, letterSpacing: '-0.5px', marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: `${color}99` }}>{sub}</div>
    </div>
  )
}
