import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_INGRESO_REC, FRECUENCIAS, fmt } from '../lib/flujoRecurrenteUtils'

const EMPTY = {
  nombre:'', tipo:'sueldo', moneda:'PEN',
  monto_total:'', frecuencia:'quincenal',
  dia_pago_1:15, dia_pago_2:30,
  monto_pago_1:'', monto_pago_2:'',
  empleador:'', proxima_fecha:'',
}

export default function IngresoRecurrenteForm({ usuarioId, registro, onClose, onGuardado }) {
  const [form,    setForm]    = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const esEdicion = !!registro

  useEffect(() => {
    if (registro) setForm({ ...EMPTY, ...registro })
  }, [registro])

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  const esQuincenal = form.frecuencia === 'quincenal'
  const esMensual   = form.frecuencia === 'mensual'
  const tipo = TIPOS_INGRESO_REC.find(t=>t.valor===form.tipo)
  const color = tipo?.color || '#16a34a'

  // Auto-split equitativo al cambiar monto total
  function onMontoTotal(v) {
    set('monto_total', v)
    if (esQuincenal && v) {
      const mitad = (Number(v)/2).toFixed(2)
      setForm(f=>({...f, monto_total:v, monto_pago_1:mitad, monto_pago_2:mitad}))
    }
  }

  // Ajuste manual quincena 1 → auto-ajusta quincena 2
  function onMontoPago1(v) {
    set('monto_pago_1', v)
    if (form.monto_total && v) {
      const resto = (Number(form.monto_total) - Number(v)).toFixed(2)
      if (resto >= 0) set('monto_pago_2', resto)
    }
  }

  const totalSplit = Number(form.monto_pago_1||0) + Number(form.monto_pago_2||0)
  const diferencia = Number(form.monto_total||0) - totalSplit

  async function guardar() {
    setError('')
    if (!form.nombre.trim()) return setError('Escribe un nombre.')
    if (!form.monto_total || Number(form.monto_total)<=0) return setError('Ingresa el monto.')
    if (esQuincenal && Math.abs(diferencia)>0.01)
      return setError(`La suma de quincenas (${fmt(totalSplit)}) no coincide con el total (${fmt(form.monto_total)}).`)

    setLoading(true)
    const payload = {
      usuario_id:   usuarioId,
      nombre:       form.nombre.trim(),
      tipo:         form.tipo,
      monto_total:  Number(form.monto_total),
      moneda:       form.moneda,
      frecuencia:   form.frecuencia,
      dia_pago_1:   form.dia_pago_1 ? Number(form.dia_pago_1) : null,
      dia_pago_2:   esQuincenal&&form.dia_pago_2 ? Number(form.dia_pago_2) : null,
      monto_pago_1: esQuincenal||esMensual ? Number(form.monto_pago_1||form.monto_total) : null,
      monto_pago_2: esQuincenal ? Number(form.monto_pago_2) : null,
      empleador:    form.empleador||null,
      proxima_fecha:form.proxima_fecha||null,
      activo:       true,
    }

    let err
    if (esEdicion) {
      ;({error:err}=await supabase.from('ingresos_recurrentes').update(payload).eq('id',registro.id))
    } else {
      ;({error:err}=await supabase.from('ingresos_recurrentes').insert(payload))
    }

    if (err) { setError('No se pudo guardar.'); console.error(err) }
    else     { onGuardado(); onClose() }
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e=>e.stopPropagation()} style={modal}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:18}}>
              {esEdicion?'✏️ Editar ingreso fijo':'💰 Configurar ingreso fijo'}
            </div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:1}}>
              Sueldo, honorarios o renta con frecuencia regular
            </div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        <div style={{maxHeight:'72vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:14,paddingRight:2}}>

          {/* Tipo */}
          <div>
            <label style={lbl}>🏷️ Tipo de ingreso</label>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              {TIPOS_INGRESO_REC.map(t=>(
                <div key={t.valor} onClick={()=>set('tipo',t.valor)} style={{
                  padding:'7px 13px',borderRadius:20,cursor:'pointer',
                  border:`1.5px solid ${form.tipo===t.valor?t.color:'var(--border)'}`,
                  background:form.tipo===t.valor?`${t.color}12`:'var(--bg)',
                  fontSize:12,fontWeight:form.tipo===t.valor?700:500,
                  color:form.tipo===t.valor?t.color:'var(--text2)',
                  transition:'all 0.12s',
                }}>
                  {t.emoji} {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* Nombre + Empleador */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={lbl}>📝 Nombre</label>
              <input value={form.nombre||''} onChange={e=>set('nombre',e.target.value)}
                placeholder="Ej: Sueldo empresa XYZ" style={inp} autoFocus/>
            </div>
            <div>
              <label style={lbl}>🏢 Empleador (opcional)</label>
              <input value={form.empleador||''} onChange={e=>set('empleador',e.target.value)}
                placeholder="Nombre empresa" style={inp}/>
            </div>
          </div>

          {/* Frecuencia */}
          <div>
            <label style={lbl}>🔁 Frecuencia de pago</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              {FRECUENCIAS.map(f=>(
                <div key={f.valor} onClick={()=>set('frecuencia',f.valor)} style={{
                  padding:'10px 8px',borderRadius:11,cursor:'pointer',textAlign:'center',
                  border:`1.5px solid ${form.frecuencia===f.valor?color:'var(--border)'}`,
                  background:form.frecuencia===f.valor?`${color}12`:'var(--bg)',
                  transition:'all 0.12s',
                }}>
                  <div style={{fontSize:11,fontWeight:form.frecuencia===f.valor?700:500,color:form.frecuencia===f.valor?color:'var(--text2)',marginBottom:3}}>{f.label}</div>
                  <div style={{fontSize:9,color:'var(--text3)',lineHeight:1.3}}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monto total */}
          <div>
            <label style={lbl}>💰 Monto total mensual</label>
            <div style={{position:'relative'}}>
              <span style={pfx(color)}>S/.</span>
              <input type="number" value={form.monto_total||''}
                onChange={e=>onMontoTotal(e.target.value)}
                placeholder="0.00" min="0" step="0.01"
                style={{...inp,paddingLeft:44,fontSize:20,fontWeight:800,color}}/>
            </div>
          </div>

          {/* Configuración QUINCENAL */}
          {esQuincenal && (
            <div style={{background:`${color}06`,border:`1.5px solid ${color}25`,borderRadius:16,padding:16}}>
              <label style={{...lbl,color,marginBottom:12}}>🌓 Distribución por quincenas</label>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                {/* Quincena 1 */}
                <div style={{background:'white',borderRadius:12,padding:14,border:'1.5px solid #bfdbfe'}}>
                  <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:13,color:'#0891b2',marginBottom:10}}>
                    🌓 Primera quincena
                  </div>
                  <div style={{marginBottom:10}}>
                    <label style={{...lbl,fontSize:11}}>Día de cobro</label>
                    <input type="number" value={form.dia_pago_1}
                      onChange={e=>set('dia_pago_1',e.target.value)}
                      min="1" max="15" placeholder="15"
                      style={{...inp,textAlign:'center',fontWeight:700}}/>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>Del 1 al 15 del mes</div>
                  </div>
                  <div>
                    <label style={{...lbl,fontSize:11}}>Monto a cobrar</label>
                    <div style={{position:'relative'}}>
                      <span style={pfx('#0891b2')}>S/.</span>
                      <input type="number" value={form.monto_pago_1}
                        onChange={e=>onMontoPago1(e.target.value)}
                        placeholder="0.00" min="0" step="0.01"
                        style={{...inp,paddingLeft:40,fontWeight:700,color:'#0891b2'}}/>
                    </div>
                  </div>
                </div>

                {/* Quincena 2 */}
                <div style={{background:'white',borderRadius:12,padding:14,border:'1.5px solid #ddd6fe'}}>
                  <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:13,color:'#7c3aed',marginBottom:10}}>
                    🌕 Segunda quincena
                  </div>
                  <div style={{marginBottom:10}}>
                    <label style={{...lbl,fontSize:11}}>Día de cobro</label>
                    <input type="number" value={form.dia_pago_2 ?? ''}
                      onChange={e=>set('dia_pago_2',e.target.value)}
                      min="16" max="31" placeholder="30"
                      style={{...inp,textAlign:'center',fontWeight:700}}/>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>Del 16 al fin del mes</div>
                  </div>
                  <div>
                    <label style={{...lbl,fontSize:11}}>Monto a cobrar</label>
                    <div style={{position:'relative'}}>
                      <span style={pfx('#7c3aed')}>S/.</span>
                      <input type="number" value={form.monto_pago_2||''}
                        onChange={e=>set('monto_pago_2',e.target.value)}
                        placeholder="0.00" min="0" step="0.01"
                        style={{...inp,paddingLeft:40,fontWeight:700,color:'#7c3aed'}}/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verificación */}
              <div style={{
                background: Math.abs(diferencia)<0.01 ? '#f0fdf4':'#fef2f2',
                border:`1.5px solid ${Math.abs(diferencia)<0.01?'#86efac':'#fca5a5'}`,
                borderRadius:10, padding:'10px 14px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <span style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>
                  Suma de quincenas:
                </span>
                <div style={{textAlign:'right'}}>
                  <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:15,color:Math.abs(diferencia)<0.01?'#16a34a':'#dc2626'}}>
                    {fmt(totalSplit)}
                  </span>
                  {Math.abs(diferencia)>0.01&&(
                    <div style={{fontSize:11,color:'#dc2626',fontWeight:600}}>
                      Falta distribuir: {fmt(Math.abs(diferencia))}
                    </div>
                  )}
                  {Math.abs(diferencia)<0.01&&form.monto_total&&(
                    <div style={{fontSize:11,color:'#16a34a',fontWeight:600}}>✓ Cuadra con el total</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MENSUAL */}
          {esMensual && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={lbl}>📅 Día de cobro del mes</label>
                <input type="number" value={form.dia_pago_1 ?? ''}
                  onChange={e=>set('dia_pago_1',e.target.value)}
                  min="1" max="31" placeholder="30" style={inp}/>
              </div>
              <div>
                <label style={lbl}>💰 Monto por cobro</label>
                <div style={{position:'relative'}}>
                  <span style={pfx(color)}>S/.</span>
                  <input type="number" value={form.monto_pago_1||form.monto_total}
                    onChange={e=>set('monto_pago_1',e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    style={{...inp,paddingLeft:40,fontWeight:700,color}}/>
                </div>
              </div>
            </div>
          )}

          {/* Próxima fecha manual */}
          <div>
            <label style={lbl}>📅 Próxima fecha de cobro (opcional)</label>
            <input type="date" value={form.proxima_fecha||''}
              onChange={e=>set('proxima_fecha',e.target.value)} style={inp}/>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
              Si no la pones, se calcula automáticamente.
            </div>
          </div>
        </div>

        {error&&<div style={errorBox}>{error}</div>}

        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button onClick={onClose} style={btnCan}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{...btnPri,background:loading?'#d1d5db':color}}>
            {loading?'Guardando...':esEdicion?'💾 Guardar cambios':'💰 Configurar ingreso'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay={position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}
const modal={background:'white',borderRadius:20,border:'1.5px solid var(--border)',padding:'26px',width:'100%',maxWidth:520,boxShadow:'0 16px 48px rgba(0,0,0,0.15)'}
const closeBtn={width:32,height:32,borderRadius:8,background:'var(--bg)',border:'1.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:18,color:'var(--text3)',flexShrink:0}
const lbl={fontSize:12,fontWeight:700,color:'var(--text2)',display:'block',marginBottom:7}
const inp={width:'100%',padding:'10px 13px',background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:10,fontSize:13,color:'var(--text)',fontFamily:'Poppins',outline:'none',boxSizing:'border-box'}
const pfx=c=>({position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontFamily:'Nunito',fontWeight:900,fontSize:14,color:c})
const errorBox={background:'#fef2f2',border:'1.5px solid #fecaca',color:'#991b1b',borderRadius:10,padding:'10px 14px',fontSize:13,marginTop:12}
const btnCan={flex:1,padding:11,background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',color:'var(--text2)',fontFamily:'Poppins'}
const btnPri={flex:2,padding:11,border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',color:'white',fontFamily:'Poppins',transition:'all 0.15s'}
