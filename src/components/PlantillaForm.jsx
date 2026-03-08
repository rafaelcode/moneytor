import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CATS_PRESUPUESTO, CAT_MAP, PLANTILLAS_SUGERIDAS, fmt } from '../lib/presupuestoUtils'

export default function PlantillaForm({ usuarioId, plantilla, onClose, onGuardado }) {
  const esEdicion = !!plantilla
  const [nombre,      setNombre]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [lineas,      setLineas]      = useState([])   // [{categoria, monto_limite}]
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [paso,        setPaso]        = useState(esEdicion ? 2 : 1)  // 1=elegir base, 2=editar

  useEffect(() => {
    if (plantilla) {
      setNombre(plantilla.nombre)
      setDescripcion(plantilla.descripcion || '')
      // Cargar líneas existentes
      supabase.from('presupuesto_lineas')
        .select('*').eq('plantilla_id', plantilla.id)
        .order('orden')
        .then(({ data }) => setLineas((data || []).map(l => ({ categoria: l.categoria, monto_limite: l.monto_limite }))))
    }
  }, [plantilla])

  function usarSugerida(s) {
    setNombre(s.nombre.replace(/^\S+\s/, ''))  // quitar emoji del nombre
    setDescripcion(s.descripcion)
    setLineas(s.lineas.map((l, i) => ({ categoria: l.categoria, monto_limite: l.monto, orden: i })))
    setPaso(2)
  }

  function empezarBlanco() {
    setNombre(''); setDescripcion(''); setLineas([])
    setPaso(2)
  }

  function setMonto(idx, v) {
    setLineas(ls => ls.map((l, i) => i === idx ? { ...l, monto_limite: v } : l))
  }

  function agregarCategoria(cat) {
    if (lineas.some(l => l.categoria === cat)) return
    setLineas(ls => [...ls, { categoria: cat, monto_limite: '' }])
  }

  function quitarLinea(idx) {
    setLineas(ls => ls.filter((_, i) => i !== idx))
  }

  const totalPresupuesto = lineas.reduce((s, l) => s + Number(l.monto_limite || 0), 0)

  async function guardar() {
    setError('')
    if (!nombre.trim())         return setError('Escribe un nombre para la plantilla.')
    if (lineas.length === 0)    return setError('Agrega al menos una categoría.')
    if (lineas.some(l => !l.monto_limite || Number(l.monto_limite) <= 0))
      return setError('Todos los montos deben ser mayores a 0.')

    setLoading(true)

    if (esEdicion) {
      await supabase.from('presupuesto_plantillas').update({
        nombre: nombre.trim(), descripcion: descripcion.trim() || null,
        actualizado_en: new Date().toISOString(),
      }).eq('id', plantilla.id)

      await supabase.from('presupuesto_lineas').delete().eq('plantilla_id', plantilla.id)

      await supabase.from('presupuesto_lineas').insert(
        lineas.map((l, i) => ({
          plantilla_id: plantilla.id, usuario_id: usuarioId,
          categoria: l.categoria, monto_limite: Number(l.monto_limite), orden: i,
        }))
      )
    } else {
      const { data: nueva, error: err } = await supabase
        .from('presupuesto_plantillas').insert({
          usuario_id: usuarioId,
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
        }).select().single()

      if (err || !nueva) { setError('Error al crear la plantilla.'); setLoading(false); return }

      await supabase.from('presupuesto_lineas').insert(
        lineas.map((l, i) => ({
          plantilla_id: nueva.id, usuario_id: usuarioId,
          categoria: l.categoria, monto_limite: Number(l.monto_limite), orden: i,
        }))
      )
    }

    onGuardado(); onClose()
    setLoading(false)
  }

  const catsDisponibles = CATS_PRESUPUESTO.filter(c => !lineas.some(l => l.categoria === c.valor))

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18 }}>
              {esEdicion ? '✏️ Editar plantilla' : '📋 Nueva plantilla de presupuesto'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Define límites de gasto por categoría
            </div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        {/* ── PASO 1: Elegir punto de partida ── */}
        {paso === 1 && (
          <div>
            <div style={{ fontSize:13, color:'var(--text2)', marginBottom:16, fontWeight:600 }}>
              ¿Cómo quieres empezar?
            </div>

            {/* Plantillas sugeridas */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              {PLANTILLAS_SUGERIDAS.map((s, i) => (
                <div key={i} onClick={() => usarSugerida(s)} style={{
                  padding:'14px 16px', borderRadius:14, cursor:'pointer',
                  border:'1.5px solid var(--border)', background:'var(--bg)',
                  transition:'all 0.13s',
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='#6c63ff'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                >
                  <div>
                    <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:14, marginBottom:3 }}>{s.nombre}</div>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>{s.descripcion}</div>
                    <div style={{ fontSize:11, color:'#6c63ff', fontWeight:700, marginTop:5 }}>
                      {s.lineas.length} categorías · {fmt(s.lineas.reduce((a,l)=>a+l.monto,0))} /mes
                    </div>
                  </div>
                  <span style={{ fontSize:22, flexShrink:0 }}>→</span>
                </div>
              ))}
            </div>

            <div onClick={empezarBlanco} style={{
              padding:'12px 16px', borderRadius:14, cursor:'pointer',
              border:'1.5px dashed var(--border)', background:'white', textAlign:'center',
              fontSize:13, fontWeight:700, color:'var(--text2)',
            }}>
              ➕ Empezar desde cero
            </div>
          </div>
        )}

        {/* ── PASO 2: Editar plantilla ── */}
        {paso === 2 && (
          <div>
            {/* Nombre y descripción */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
              <div>
                <label style={lbl}>📋 Nombre de la plantilla</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Presupuesto personal 2025" style={inp} autoFocus />
              </div>
              <div>
                <label style={lbl}>📝 Descripción (opcional)</label>
                <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Para qué sirve esta plantilla..." style={inp} />
              </div>
            </div>

            {/* Líneas de categorías */}
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <label style={{ ...lbl, margin:0 }}>🏷️ Límites por categoría</label>
                {totalPresupuesto > 0 && (
                  <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, color:'#6c63ff' }}>
                    Total: {fmt(totalPresupuesto)}/mes
                  </span>
                )}
              </div>

              <div style={{ maxHeight:260, overflowY:'auto', display:'flex', flexDirection:'column', gap:7, paddingRight:2 }}>
                {lineas.map((l, idx) => {
                  const cat = CAT_MAP[l.categoria] || { emoji:'📌', label:l.categoria, color:'#64748b' }
                  return (
                    <div key={idx} style={{
                      display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center',
                      background:'var(--bg)', borderRadius:10, padding:'8px 12px',
                      border:'1.5px solid var(--border)',
                    }}>
                      <span style={{ fontSize:15 }}>{cat.emoji}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:cat.color, marginBottom:4 }}>{cat.label}</div>
                        <div style={{ position:'relative' }}>
                          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:11, fontWeight:700, color:cat.color }}>S/.</span>
                          <input
                            type="number" value={l.monto_limite}
                            onChange={e => setMonto(idx, e.target.value)}
                            placeholder="0" min="1"
                            style={{ width:'100%', padding:'6px 8px 6px 32px', background:'white', border:`1.5px solid ${cat.color}40`, borderRadius:8, fontSize:13, fontWeight:700, color:cat.color, fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }}
                          />
                        </div>
                      </div>
                      <button onClick={() => quitarLinea(idx)} style={{ padding:'4px 8px', borderRadius:6, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', cursor:'pointer', fontSize:13 }}>×</button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Agregar categorías */}
            {catsDisponibles.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>➕ Agregar categoría</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {catsDisponibles.map(c => (
                    <div key={c.valor} onClick={() => agregarCategoria(c.valor)} style={{
                      padding:'5px 11px', borderRadius:20, cursor:'pointer',
                      fontSize:11, fontWeight:700,
                      background:`${c.color}12`, color:c.color,
                      border:`1.5px solid ${c.color}30`,
                      transition:'all 0.12s',
                    }}>
                      {c.emoji} {c.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón volver si es nuevo */}
            {!esEdicion && (
              <button onClick={() => setPaso(1)} style={{ fontSize:12, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', marginBottom:4, padding:0 }}>
                ← Volver a plantillas sugeridas
              </button>
            )}
          </div>
        )}

        {error && <div style={errorBox}>{error}</div>}

        {paso === 2 && (
          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            <button onClick={onClose} style={btnCan}>Cancelar</button>
            <button onClick={guardar} disabled={loading} style={btnPri}>
              {loading ? 'Guardando...' : esEdicion ? '💾 Guardar cambios' : '📋 Crear plantilla'}
            </button>
          </div>
        )}
        {paso === 1 && (
          <button onClick={onClose} style={{ ...btnCan, width:'100%', marginTop:14 }}>Cancelar</button>
        )}
      </div>
    </div>
  )
}

const overlay  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }
const modal    = { background:'white', borderRadius:20, border:'1.5px solid var(--border)', padding:'26px', width:'100%', maxWidth:480, boxShadow:'0 16px 48px rgba(0,0,0,0.15)', maxHeight:'90vh', overflowY:'auto' }
const closeBtn = { width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'var(--text3)', flexShrink:0 }
const lbl      = { fontSize:12, fontWeight:700, color:'var(--text2)', display:'block', marginBottom:7 }
const inp      = { width:'100%', padding:'10px 13px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text)', fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }
const errorBox = { background:'#fef2f2', border:'1.5px solid #fecaca', color:'#991b1b', borderRadius:10, padding:'10px 14px', fontSize:13, marginTop:12 }
const btnCan   = { flex:1, padding:11, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
const btnPri   = { flex:2, padding:11, border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'white', fontFamily:'Poppins', background:'#6c63ff', transition:'all 0.15s' }
