import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MESES, CAT_MAP, fmt } from '../lib/presupuestoUtils'

export default function AsignarMesForm({ usuarioId, mes, anio, presupuestoExistente, onClose, onGuardado }) {
  const [plantillas,    setPlantillas]    = useState([])
  const [plantillaId,   setPlantillaId]   = useState(presupuestoExistente?.plantilla_id || '')
  const [lineas,        setLineas]        = useState([])
  const [lineasEdicion, setLineasEdicion] = useState([])  // copia editable para ajustes del mes
  const [loading,       setLoading]       = useState(false)
  const [cargando,      setCargando]      = useState(true)

  useEffect(() => { cargarPlantillas() }, [])

  async function cargarPlantillas() {
    const { data } = await supabase
      .from('presupuesto_plantillas').select('*, presupuesto_lineas(*)')
      .eq('usuario_id', usuarioId).order('creado_en')
    setPlantillas(data || [])
    setCargando(false)

    // Si ya hay un presupuesto este mes, cargar sus líneas
    if (presupuestoExistente) {
      const { data: ml } = await supabase
        .from('presupuesto_mes_lineas').select('*')
        .eq('presupuesto_id', presupuestoExistente.id).order('orden')
      setLineasEdicion((ml || []).map(l => ({ ...l, monto_limite: l.monto_limite })))
    }
  }

  // Al elegir una plantilla, pre-cargar sus líneas para poder ajustarlas
  function elegirPlantilla(id) {
    setPlantillaId(id)
    const plantilla = plantillas.find(p => p.id === id)
    if (plantilla) {
      const ls = (plantilla.presupuesto_lineas || [])
        .sort((a,b) => a.orden - b.orden)
        .map(l => ({ categoria: l.categoria, monto_limite: l.monto_limite }))
      setLineasEdicion(ls)
    }
  }

  function setMonto(idx, v) {
    setLineasEdicion(ls => ls.map((l, i) => i === idx ? { ...l, monto_limite: v } : l))
  }

  const totalPresupuesto = lineasEdicion.reduce((s, l) => s + Number(l.monto_limite || 0), 0)

  async function guardar() {
    if (!plantillaId) return
    if (lineasEdicion.length === 0) return
    setLoading(true)

    if (presupuestoExistente) {
      // Actualizar plantilla seleccionada
      await supabase.from('presupuesto_mes').update({
        plantilla_id: plantillaId,
      }).eq('id', presupuestoExistente.id)

      // Reemplazar líneas
      await supabase.from('presupuesto_mes_lineas').delete().eq('presupuesto_id', presupuestoExistente.id)
      await supabase.from('presupuesto_mes_lineas').insert(
        lineasEdicion.map((l, i) => ({
          presupuesto_id: presupuestoExistente.id,
          usuario_id: usuarioId,
          categoria: l.categoria,
          monto_limite: Number(l.monto_limite),
          orden: i,
        }))
      )
    } else {
      // Crear presupuesto para el mes
      const { data: nuevo } = await supabase
        .from('presupuesto_mes').insert({
          usuario_id: usuarioId,
          plantilla_id: plantillaId,
          mes, anio,
        }).select().single()

      if (nuevo) {
        await supabase.from('presupuesto_mes_lineas').insert(
          lineasEdicion.map((l, i) => ({
            presupuesto_id: nuevo.id,
            usuario_id: usuarioId,
            categoria: l.categoria,
            monto_limite: Number(l.monto_limite),
            orden: i,
          }))
        )
      }
    }

    onGuardado(); onClose()
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18 }}>
              📅 {presupuestoExistente ? 'Cambiar' : 'Asignar'} plantilla — {MESES[mes-1]} {anio}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Puedes ajustar los montos solo para este mes
            </div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        {cargando ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text3)', fontSize:13 }}>Cargando plantillas...</div>
        ) : plantillas.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>Sin plantillas creadas</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>Primero crea una plantilla en la pestaña "Plantillas".</div>
          </div>
        ) : (
          <>
            {/* Seleccionar plantilla */}
            <div style={{ marginBottom:18 }}>
              <label style={lbl}>📋 Selecciona una plantilla base</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {plantillas.map(p => {
                  const totalP = (p.presupuesto_lineas || []).reduce((s,l) => s+Number(l.monto_limite),0)
                  const selec  = plantillaId === p.id
                  return (
                    <div key={p.id} onClick={() => elegirPlantilla(p.id)} style={{
                      padding:'12px 14px', borderRadius:12, cursor:'pointer',
                      border:`1.5px solid ${selec ? '#6c63ff':'var(--border)'}`,
                      background: selec ? '#f5f3ff' : 'var(--bg)',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      transition:'all 0.12s',
                    }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, color: selec?'#6c63ff':'var(--text)' }}>{p.nombre}</div>
                        {p.descripcion && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{p.descripcion}</div>}
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>
                          {(p.presupuesto_lineas||[]).length} categorías
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:15, color: selec?'#6c63ff':'var(--text2)' }}>
                          {fmt(totalP)}
                        </div>
                        <div style={{ fontSize:10, color:'var(--text3)' }}>/mes</div>
                        {selec && <div style={{ fontSize:11, color:'#6c63ff', fontWeight:700, marginTop:3 }}>✓ Seleccionada</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ajuste de montos para este mes */}
            {lineasEdicion.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <label style={{ ...lbl, margin:0 }}>
                    🔧 Ajustar montos para {MESES[mes-1]}
                    <span style={{ fontSize:11, color:'var(--text3)', fontWeight:400, marginLeft:6 }}>(opcional)</span>
                  </label>
                  <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#6c63ff' }}>
                    {fmt(totalPresupuesto)}/mes
                  </span>
                </div>
                <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                  {lineasEdicion.map((l, idx) => {
                    const cat = CAT_MAP[l.categoria] || { emoji:'📌', label:l.categoria, color:'#64748b' }
                    return (
                      <div key={idx} style={{
                        display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center',
                        background:'var(--bg)', borderRadius:9, padding:'7px 11px',
                        border:'1px solid var(--border)',
                      }}>
                        <span style={{ fontSize:16 }}>{cat.emoji}</span>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>{cat.label}</div>
                        <div style={{ position:'relative' }}>
                          <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:10, fontWeight:700, color:cat.color }}>S/.</span>
                          <input
                            type="number" value={l.monto_limite}
                            onChange={e => setMonto(idx, e.target.value)}
                            min="0"
                            style={{ width:90, padding:'5px 6px 5px 26px', background:'white', border:`1.5px solid ${cat.color}40`, borderRadius:7, fontSize:12, fontWeight:700, color:cat.color, fontFamily:'Poppins', outline:'none', boxSizing:'border-box', textAlign:'right' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={btnCan}>Cancelar</button>
          {plantillas.length > 0 && (
            <button onClick={guardar} disabled={loading || !plantillaId} style={{
              ...btnPri, background: (!plantillaId||loading) ? '#d1d5db':'#6c63ff',
              cursor: (!plantillaId||loading) ? 'not-allowed':'pointer',
            }}>
              {loading ? 'Guardando...' : presupuestoExistente ? '💾 Actualizar mes' : '📅 Activar para el mes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const overlay  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }
const modal    = { background:'white', borderRadius:20, border:'1.5px solid var(--border)', padding:'26px', width:'100%', maxWidth:460, boxShadow:'0 16px 48px rgba(0,0,0,0.15)', maxHeight:'90vh', overflowY:'auto' }
const closeBtn = { width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'var(--text3)', flexShrink:0 }
const lbl      = { fontSize:12, fontWeight:700, color:'var(--text2)', display:'block', marginBottom:7 }
const btnCan   = { flex:1, padding:11, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
const btnPri   = { flex:2, padding:11, border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'white', fontFamily:'Poppins', transition:'all 0.15s' }
