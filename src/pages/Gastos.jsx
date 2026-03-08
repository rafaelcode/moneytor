import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtFecha, MESES, rangoMes, CATEGORIAS_GASTO, CAT_MAP } from '../lib/flujoUtils'
import TransactionForm from '../components/TransactionForm'

export default function Gastos({ usuarioId }) {
  const hoy    = new Date()
  const [mes,  setMes]  = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const [txs,       setTxs]       = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [catFiltro, setCatFiltro] = useState('todas')
  const [editando,  setEditando]  = useState(null)
  const [nuevo,     setNuevo]     = useState(false)

  useEffect(() => { cargar() }, [mes, anio])

  async function cargar() {
    setCargando(true)
    const { desde, hasta } = rangoMes(anio, mes)
    const { data } = await supabase
      .from('transacciones').select('*')
      .eq('usuario_id', usuarioId).eq('tipo', 'gasto')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false })
    setTxs(data || [])
    setCargando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('transacciones').delete().eq('id', id)
    cargar()
  }

  // ── Totales ───────────────────────────────────────────────
  const total      = txs.reduce((s, t) => s + Number(t.monto), 0)
  const mayorGasto = txs.length ? Math.max(...txs.map(t => Number(t.monto))) : 0

  const xCat = {}
  txs.forEach(t => { xCat[t.categoria] = (xCat[t.categoria] || 0) + Number(t.monto) })
  const topCat = Object.entries(xCat).sort((a, b) => b[1] - a[1])[0]
  const lista  = catFiltro === 'todas' ? txs : txs.filter(t => t.categoria === catFiltro)

  return (
    <div style={{ padding: 28 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <Kpi emoji="↓" label="Total gastos" value={fmt(total)} color="#dc2626" bg="#fef2f2"
          sub={`${txs.length} registro${txs.length !== 1 ? 's' : ''}`} />
        <Kpi
          emoji="📊" label="Mayor categoría"
          value={topCat ? ((CAT_MAP[topCat[0]]?.emoji || '') + ' ' + (CAT_MAP[topCat[0]]?.label || topCat[0])) : '—'}
          color="#f97316" bg="#fff7ed"
          sub={topCat ? `${((topCat[1] / total) * 100).toFixed(1)}% del total` : 'Sin registros'}
        />
        <Kpi emoji="🏆" label="Mayor gasto" value={fmt(mayorGasto)} color="#7c3aed" bg="#f5f3ff"
          sub={txs.length ? (txs.find(t => Number(t.monto) === mayorGasto)?.descripcion || '—') : '—'}
        />
        <Kpi
          emoji="📋" label="Categorías usadas"
          value={Object.keys(xCat).length}
          color="#0891b2" bg="#ecfeff"
          sub={`de ${CATEGORIAS_GASTO.length} disponibles`}
        />
      </div>

      {/* ── Desglose por categoría ── */}
      {Object.keys(xCat).length > 0 && (
        <div style={{
          background: 'white', borderRadius: 16,
          border: '1.5px solid var(--border)',
          padding: '16px 20px', marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 14, marginBottom: 14 }}>
            🔥 Desglose por categoría
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(xCat).sort((a, b) => b[1] - a[1]).map(([cat, monto]) => {
              const info = CAT_MAP[cat] || { emoji: '📌', label: cat, color: '#64748b' }
              const pct  = total > 0 ? (monto / total * 100) : 0
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {info.emoji} <span style={{ fontWeight: 600 }}>{info.label}</span>
                    </span>
                    <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: info.color }}>
                      {fmt(monto)}{' '}
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div style={{ height: 7, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: info.color, borderRadius: 999, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Controles: mes + filtros + botón ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>

        {/* Navegación mes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { let m = mes - 1, a = anio; if (m < 1) { m = 12; a -= 1 } setMes(m); setAnio(a) }} style={btnNav}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 700, minWidth: 130, textAlign: 'center' }}>
            {MESES[mes - 1]} {anio}
          </div>
          <button onClick={() => { let m = mes + 1, a = anio; if (m > 12) { m = 1; a += 1 } setMes(m); setAnio(a) }} style={btnNav}>›</button>
        </div>

        {/* Filtros por categoría */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div onClick={() => setCatFiltro('todas')} style={chipFiltro(catFiltro === 'todas', '#dc2626')}>
            Todas
          </div>
          {CATEGORIAS_GASTO.filter(c => txs.some(t => t.categoria === c.valor)).map(c => (
            <div key={c.valor} onClick={() => setCatFiltro(c.valor)}
              style={chipFiltro(catFiltro === c.valor, c.color)}>
              {c.emoji} {c.label}
            </div>
          ))}
        </div>

        <button onClick={() => setNuevo(true)} style={{
          background: '#dc2626', color: 'white', border: 'none',
          borderRadius: 10, padding: '9px 18px', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins',
          boxShadow: '0 3px 10px rgba(220,38,38,0.3)',
        }}>
          ↓ Registrar gasto
        </button>
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <EmptyGasto catFiltro={catFiltro} mes={MESES[mes - 1]} onNuevo={() => setNuevo(true)} />
      ) : (
        <div style={{
          background: 'white', borderRadius: 16,
          border: '1.5px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Fecha', 'Categoría', 'Descripción', 'Monto', ''].map((h, i) => (
                  <th key={i} style={{
                    textAlign: h === 'Monto' ? 'right' : 'left',
                    padding: '9px 16px', fontSize: 11,
                    color: 'var(--text3)', fontWeight: 700,
                    letterSpacing: '0.8px', textTransform: 'uppercase',
                    borderBottom: '1.5px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((t, i) => {
                const cat = CAT_MAP[t.categoria] || { emoji: '📌', label: t.categoria, color: '#64748b' }
                return (
                  <tr key={t.id} style={{ borderBottom: i < lista.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fmtFecha(t.fecha)}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, fontWeight: 600, padding: '3px 9px',
                        borderRadius: 20, background: `${cat.color}12`, color: cat.color,
                        border: `1px solid ${cat.color}30`, whiteSpace: 'nowrap',
                      }}>
                        {cat.emoji} {cat.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.descripcion || '—'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'Nunito', fontWeight: 800, fontSize: 15, color: '#dc2626', whiteSpace: 'nowrap' }}>
                      -{fmt(t.monto)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setEditando(t)} style={btnIcono('#7c3aed')}>✏️</button>
                      <button onClick={() => eliminar(t.id)} style={{ ...btnIcono('#dc2626'), marginLeft: 4 }}>🗑️</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Total al pie */}
          <div style={{
            padding: '12px 16px', borderTop: '1.5px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#fef2f2',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
              Total {MESES[mes - 1]} {anio}
            </span>
            <span style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, color: '#dc2626' }}>
              -{fmt(total)}
            </span>
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      {nuevo && (
        <TransactionForm
          usuarioId={usuarioId}
          tipoInicial="gasto"
          onClose={() => setNuevo(false)}
          onGuardado={cargar}
        />
      )}
      {editando && (
        <TransactionForm
          usuarioId={usuarioId}
          transaccion={editando}
          onClose={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────
function Kpi({ emoji, label, value, color, bg, sub }) {
  return (
    <div style={{ background: bg, borderRadius: 14, border: `1.5px solid ${color}30`, padding: 18 }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, color, letterSpacing: '-0.5px', marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: `${color}90` }}>{sub}</div>
    </div>
  )
}

function Cargando() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: 'white', borderRadius: 12, height: 52, border: '1.5px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )
}

function EmptyGasto({ catFiltro, mes, onNuevo }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border)', padding: '48px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
        Sin gastos{catFiltro !== 'todas' ? ' en esta categoría' : ` en ${mes}`}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        {catFiltro !== 'todas' ? 'Prueba seleccionar otra categoría o registra un nuevo gasto.' : 'Registra tus gastos del mes para ver el análisis.'}
      </div>
      <button onClick={onNuevo} style={{
        background: '#dc2626', color: 'white', border: 'none',
        borderRadius: 10, padding: '10px 20px', fontSize: 13,
        fontWeight: 700, cursor: 'pointer',
      }}>
        ↓ Registrar gasto
      </button>
    </div>
  )
}

const btnNav    = { padding: '5px 12px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 16, cursor: 'pointer', fontWeight: 700 }
const btnIcono  = color => ({ padding: '4px 8px', borderRadius: 6, background: `${color}12`, border: `1px solid ${color}30`, color, cursor: 'pointer', fontSize: 13 })
const chipFiltro = (activo, color) => ({
  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
  fontSize: 11, fontWeight: 700,
  background: activo ? color : 'white',
  color: activo ? 'white' : 'var(--text2)',
  border: `1.5px solid ${activo ? color : 'var(--border)'}`,
  transition: 'all 0.13s', whiteSpace: 'nowrap',
})
