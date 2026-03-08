import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_INGRESO, CATEGORIAS_GASTO, fmt } from '../lib/flujoUtils'

export default function TransactionForm({
  usuarioId,
  onClose,
  onGuardado,
  tipoInicial = null,       // 'ingreso' | 'gasto' | null
  transaccion = null,       // para editar
}) {
  const hoy      = new Date().toISOString().split('T')[0]
  const esEdicion = !!transaccion

  const [tipo,        setTipo]        = useState(tipoInicial || transaccion?.tipo || 'ingreso')
  const [categoria,   setCategoria]   = useState(transaccion?.categoria || '')
  const [monto,       setMonto]       = useState(transaccion?.monto     || '')
  const [descripcion, setDescripcion] = useState(transaccion?.descripcion || '')
  const [fecha,       setFecha]       = useState(transaccion?.fecha     || hoy)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  // Si cambia el tipo, resetear categoría
  useEffect(() => {
    if (!esEdicion) setCategoria('')
  }, [tipo])

  const esIngreso = tipo === 'ingreso'
  const color     = esIngreso ? '#16a34a' : '#dc2626'
  const categorias = esIngreso ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO

  async function guardar() {
    setError('')
    if (!monto || Number(monto) <= 0) return setError('Ingresa un monto válido.')
    if (!categoria)                   return setError('Selecciona una categoría.')

    setLoading(true)
    const payload = {
      usuario_id:  usuarioId,
      tipo,
      monto:       Number(monto),
      categoria,
      descripcion: descripcion.trim() || null,
      fecha,
    }

    let err
    if (esEdicion) {
      ;({ error: err } = await supabase.from('transacciones').update(payload).eq('id', transaccion.id))
    } else {
      ;({ error: err } = await supabase.from('transacciones').insert(payload))
    }

    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); console.error(err) }
    else     { onGuardado?.(); onClose() }
    setLoading(false)
  }

  const catSel = categorias.find(c => c.valor === categoria)

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18 }}>
              {esEdicion ? '✏️ Editar movimiento' : '📝 Nuevo movimiento'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Registra un ingreso o gasto
            </div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        {/* Tipo — solo editable si no viene pre-seleccionado */}
        {!tipoInicial && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
            {[
              { v:'ingreso', e:'↑', label:'Ingreso',  c:'#16a34a' },
              { v:'gasto',   e:'↓', label:'Gasto',    c:'#dc2626' },
            ].map(t => (
              <div key={t.v} onClick={() => setTipo(t.v)} style={{
                padding:'12px', borderRadius:12, cursor:'pointer', textAlign:'center',
                border:`2px solid ${tipo===t.v ? t.c : 'var(--border)'}`,
                background: tipo===t.v ? `${t.c}12` : 'var(--bg)',
                transition:'all 0.14s',
              }}>
                <div style={{
                  fontSize:22, fontFamily:'Nunito', fontWeight:900,
                  color: tipo===t.v ? t.c : 'var(--text3)',
                }}>{t.e}</div>
                <div style={{
                  fontSize:13, fontWeight: tipo===t.v ? 700 : 500,
                  color: tipo===t.v ? t.c : 'var(--text2)',
                }}>{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Si viene pre-seleccionado, mostrar badge */}
        {tipoInicial && (
          <div style={{
            display:'inline-flex', alignItems:'center', gap:7,
            background:`${color}12`, border:`1.5px solid ${color}30`,
            borderRadius:20, padding:'6px 14px', marginBottom:18,
          }}>
            <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, color }}>{esIngreso ? '↑' : '↓'}</span>
            <span style={{ fontSize:13, fontWeight:700, color }}>
              {esIngreso ? 'Ingreso' : 'Gasto'}
            </span>
          </div>
        )}

        {/* Monto */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>💰 Monto</label>
          <div style={{ position:'relative' }}>
            <span style={{
              position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
              fontFamily:'Nunito', fontWeight:900, fontSize:16, color,
            }}>S/.</span>
            <input
              type="number" value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00" min="0" step="0.01" autoFocus
              style={{ ...inp, paddingLeft:50, fontSize:22, fontWeight:800, color }}
            />
          </div>
        </div>

        {/* Categorías */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>🏷️ Categoría</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
            {categorias.map(c => (
              <div key={c.valor} onClick={() => setCategoria(c.valor)} style={{
                padding:'8px 6px', borderRadius:9, cursor:'pointer', textAlign:'center',
                border:`1.5px solid ${categoria===c.valor ? c.color : 'var(--border)'}`,
                background: categoria===c.valor ? `${c.color}12` : 'var(--bg)',
                transition:'all 0.12s',
              }}>
                <div style={{ fontSize:16, marginBottom:2 }}>{c.emoji}</div>
                <div style={{
                  fontSize:10, fontWeight: categoria===c.valor ? 700 : 400,
                  color: categoria===c.valor ? c.color : 'var(--text2)',
                  lineHeight:1.3,
                }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Descripción + Fecha */}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:10, marginBottom:16 }}>
          <div>
            <label style={lbl}>📝 Descripción (opcional)</label>
            <input value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder={catSel ? `Ej: ${catSel.label}...` : 'Descripción del movimiento'}
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>📅 Fecha</label>
            <input type="date" value={fecha}
              onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
        </div>

        {error && (
          <div style={{
            background:'#fef2f2', border:'1.5px solid #fecaca', color:'#991b1b',
            borderRadius:10, padding:'10px 14px', fontSize:13, marginBottom:12,
          }}>{error}</div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={btnCancel}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{
            flex:2, padding:11, border:'none', borderRadius:10,
            background: loading ? '#d1d5db' : color,
            color:'white', fontFamily:'Poppins', fontWeight:700,
            fontSize:13, cursor: loading ? 'not-allowed' : 'pointer',
            transition:'all 0.15s',
          }}>
            {loading ? 'Guardando...' : esEdicion
              ? '💾 Guardar cambios'
              : esIngreso ? '↑ Registrar ingreso' : '↓ Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }
const modal    = { background:'white', borderRadius:20, border:'1.5px solid var(--border)', padding:'26px', width:'100%', maxWidth:460, boxShadow:'0 16px 48px rgba(0,0,0,0.15)' }
const closeBtn = { width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'var(--text3)' }
const lbl      = { fontSize:12, fontWeight:700, color:'var(--text2)', display:'block', marginBottom:7 }
const inp      = { width:'100%', padding:'10px 13px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text)', fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }
const btnCancel= { flex:1, padding:11, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
