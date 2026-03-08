import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_PROPIEDAD, LIQUIDEZ_OPCIONES, fmt } from '../lib/propiedadesUtils'

const EMPTY = {
  nombre: '', tipo: '', moneda: 'PEN',
  valor_estimado: '', valor_compra: '', fecha_adquisicion: '',
  direccion: '', ciudad: '', pais: 'Perú',
  tiene_deuda: false, deuda_pendiente: '',
  genera_renta: false, renta_mensual: '', renta_moneda: 'PEN',
  es_realizable: false, es_vivienda_propia: false,
  liquidez_estimada_dias: 180,
  tiene_escritura: false, tiene_seguro: false,
  notas: '',
}

export default function PropiedadForm({ usuarioId, propiedad, onClose, onGuardado }) {
  const [form,    setForm]    = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const esEdicion = !!propiedad

  useEffect(() => {
    if (propiedad) setForm({ ...EMPTY, ...propiedad })
  }, [propiedad])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function selTipo(tipo) {
    const esViv = tipo === 'inmueble_vivienda'
    setForm(f => ({ ...f, tipo, es_vivienda_propia: esViv, es_realizable: !esViv }))
  }

  const tipoSel  = TIPOS_PROPIEDAD.find(t => t.valor === form.tipo)
  const color    = tipoSel?.color || '#7c3aed'
  const simbolo  = form.moneda === 'USD' ? 'US$' : form.moneda === 'EUR' ? '€' : 'S/.'
  const esInmueble = ['inmueble_vivienda','inmueble_inversion','terreno'].includes(form.tipo)
  const esVehiculo = form.tipo === 'vehiculo'

  // Plusvalía en tiempo real
  const plusvalia = form.valor_estimado && form.valor_compra
    ? Number(form.valor_estimado) - Number(form.valor_compra) : null

  async function guardar() {
    setError('')
    if (!form.nombre.trim())    return setError('Escribe un nombre para la propiedad.')
    if (!form.tipo)             return setError('Selecciona el tipo de activo.')
    if (!form.valor_estimado || Number(form.valor_estimado) <= 0)
      return setError('Ingresa el valor estimado actual.')

    setLoading(true)
    const payload = {
      usuario_id:              usuarioId,
      nombre:                  form.nombre.trim(),
      tipo:                    form.tipo,
      moneda:                  form.moneda,
      valor_estimado:          Number(form.valor_estimado),
      valor_compra:            form.valor_compra        ? Number(form.valor_compra)        : null,
      fecha_adquisicion:       form.fecha_adquisicion   || null,
      direccion:               form.direccion            || null,
      ciudad:                  form.ciudad               || null,
      pais:                    form.pais                 || 'Perú',
      tiene_deuda:             form.tiene_deuda,
      deuda_pendiente:         form.tiene_deuda && form.deuda_pendiente ? Number(form.deuda_pendiente) : null,
      genera_renta:            form.genera_renta,
      renta_mensual:           form.genera_renta && form.renta_mensual  ? Number(form.renta_mensual)  : null,
      renta_moneda:            form.renta_moneda,
      es_realizable:           form.es_realizable,
      es_vivienda_propia:      form.es_vivienda_propia,
      liquidez_estimada_dias:  form.es_realizable ? Number(form.liquidez_estimada_dias) : null,
      tiene_escritura:         form.tiene_escritura,
      tiene_seguro:            form.tiene_seguro,
      notas:                   form.notas || null,
      activa:                  true,
      actualizado_en:          new Date().toISOString(),
    }

    let err
    if (esEdicion) {
      ;({ error: err } = await supabase.from('propiedades').update(payload).eq('id', propiedad.id))
    } else {
      ;({ error: err } = await supabase.from('propiedades').insert(payload))
    }

    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); console.error(err) }
    else     { onGuardado(); onClose() }
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18 }}>
              {esEdicion ? '✏️ Editar propiedad' : '🏠 Nueva propiedad'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Registra activos físicos de valor
            </div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        <div style={{ maxHeight:'72vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:16, paddingRight:2 }}>

          {/* Tipo */}
          <div>
            <label style={lbl}>🏷️ Tipo de activo</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {TIPOS_PROPIEDAD.map(t => (
                <div key={t.valor} onClick={() => selTipo(t.valor)} style={{
                  padding:'10px 8px', borderRadius:11, cursor:'pointer', textAlign:'center',
                  border:`1.5px solid ${form.tipo===t.valor ? t.color : 'var(--border)'}`,
                  background: form.tipo===t.valor ? `${t.color}12` : 'var(--bg)',
                  transition:'all 0.12s',
                }}>
                  <div style={{ fontSize:20, marginBottom:3 }}>{t.emoji}</div>
                  <div style={{ fontSize:11, fontWeight: form.tipo===t.valor ? 700:500, color: form.tipo===t.valor ? t.color:'var(--text2)', lineHeight:1.3 }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label style={lbl}>📝 Nombre / Descripción</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder={
                form.tipo==='inmueble_vivienda'   ? 'Ej: Departamento San Isidro' :
                form.tipo==='inmueble_inversion'  ? 'Ej: Dpto alquiler Miraflores' :
                form.tipo==='terreno'             ? 'Ej: Terreno Lurín 500m²' :
                form.tipo==='vehiculo'            ? 'Ej: Toyota Yaris 2021' :
                'Nombre descriptivo del activo'
              }
              style={inp} />
          </div>

          {/* Valores + Moneda */}
          <div style={{ background:`${color}08`, border:`1.5px solid ${color}20`, borderRadius:14, padding:16 }}>
            <label style={{ ...lbl, color }}>💰 Valorización</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, marginBottom: plusvalia!==null ? 12:0 }}>
              <div>
                <label style={{ ...lbl, fontSize:11 }}>Valor estimado hoy</label>
                <div style={{ position:'relative' }}>
                  <span style={pfx(color)}>{simbolo}</span>
                  <input type="number" value={form.valor_estimado}
                    onChange={e => set('valor_estimado', e.target.value)}
                    placeholder="0" min="0"
                    style={{ ...inp, paddingLeft:44, fontSize:16, fontWeight:700, color }} />
                </div>
              </div>
              <div>
                <label style={{ ...lbl, fontSize:11 }}>Valor de compra (opcional)</label>
                <div style={{ position:'relative' }}>
                  <span style={pfx('#64748b')}>{simbolo}</span>
                  <input type="number" value={form.valor_compra}
                    onChange={e => set('valor_compra', e.target.value)}
                    placeholder="0" min="0"
                    style={{ ...inp, paddingLeft:44 }} />
                </div>
              </div>
              <div>
                <label style={{ ...lbl, fontSize:11 }}>Moneda</label>
                <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={{ ...inp, width:88 }}>
                  <option value="PEN">S/. PEN</option>
                  <option value="USD">US$ USD</option>
                </select>
              </div>
            </div>

            {/* Plusvalía en tiempo real */}
            {plusvalia !== null && (
              <div style={{
                background:'white', borderRadius:10, padding:'10px 14px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>📈 Plusvalía estimada</span>
                <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, color: plusvalia>=0?'#16a34a':'#dc2626' }}>
                  {plusvalia>=0?'+':''}{fmt(plusvalia, form.moneda)}
                  {form.valor_compra > 0 && (
                    <span style={{ fontSize:12, marginLeft:6 }}>
                      ({((plusvalia/Number(form.valor_compra))*100).toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
            )}

            <div style={{ marginTop:10 }}>
              <label style={{ ...lbl, fontSize:11 }}>Fecha de adquisición (opcional)</label>
              <input type="date" value={form.fecha_adquisicion}
                onChange={e => set('fecha_adquisicion', e.target.value)} style={inp} />
            </div>
          </div>

          {/* Ubicación (inmuebles y terrenos) */}
          {(esInmueble) && (
            <div>
              <label style={lbl}>📍 Ubicación</label>
              <input value={form.direccion} onChange={e => set('direccion', e.target.value)}
                placeholder="Dirección o referencia" style={{ ...inp, marginBottom:8 }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
                  placeholder="Ciudad" style={inp} />
                <input value={form.pais} onChange={e => set('pais', e.target.value)}
                  placeholder="País" style={inp} />
              </div>
            </div>
          )}

          {/* Deuda asociada */}
          <div style={{ background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:12, padding:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: form.tiene_deuda ? 12:0 }}>
              <input type="checkbox" id="deuda" checked={form.tiene_deuda}
                onChange={e => set('tiene_deuda', e.target.checked)}
                style={{ width:15, height:15, accentColor:'#ef4444', cursor:'pointer' }} />
              <label htmlFor="deuda" style={{ fontSize:13, fontWeight:600, cursor:'pointer' }}>
                💳 Esta propiedad tiene deuda asociada (hipoteca, leasing, crédito vehicular)
              </label>
            </div>
            {form.tiene_deuda && (
              <div>
                <label style={{ ...lbl, fontSize:11 }}>Monto pendiente de la deuda</label>
                <div style={{ position:'relative' }}>
                  <span style={pfx('#ef4444')}>{simbolo}</span>
                  <input type="number" value={form.deuda_pendiente}
                    onChange={e => set('deuda_pendiente', e.target.value)}
                    placeholder="0" min="0"
                    style={{ ...inp, paddingLeft:44 }} />
                </div>
                {form.deuda_pendiente && form.valor_estimado && (
                  <div style={{ fontSize:12, color:'var(--text2)', marginTop:8, fontWeight:600 }}>
                    Patrimonio neto de esta propiedad:{' '}
                    <span style={{ color: Number(form.valor_estimado)-Number(form.deuda_pendiente)>=0?'#16a34a':'#dc2626', fontFamily:'Nunito', fontWeight:900 }}>
                      {fmt(Number(form.valor_estimado)-Number(form.deuda_pendiente), form.moneda)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Genera renta */}
          <div style={{ background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:12, padding:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: form.genera_renta ? 12:0 }}>
              <input type="checkbox" id="renta" checked={form.genera_renta}
                onChange={e => set('genera_renta', e.target.checked)}
                style={{ width:15, height:15, accentColor:'#16a34a', cursor:'pointer' }} />
              <label htmlFor="renta" style={{ fontSize:13, fontWeight:600, cursor:'pointer' }}>
                💵 Esta propiedad genera renta mensual (alquiler)
              </label>
            </div>
            {form.genera_renta && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10 }}>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Renta mensual</label>
                  <div style={{ position:'relative' }}>
                    <span style={pfx('#16a34a')}>
                      {form.renta_moneda==='USD'?'US$':'S/.'}
                    </span>
                    <input type="number" value={form.renta_mensual}
                      onChange={e => set('renta_mensual', e.target.value)}
                      placeholder="0" min="0"
                      style={{ ...inp, paddingLeft:44 }} />
                  </div>
                  {form.renta_mensual && form.valor_estimado && (
                    <div style={{ fontSize:11, color:'#16a34a', marginTop:5, fontWeight:700 }}>
                      Yield bruto: {((Number(form.renta_mensual)*12/Number(form.valor_estimado))*100).toFixed(2)}% anual
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Moneda renta</label>
                  <select value={form.renta_moneda} onChange={e => set('renta_moneda', e.target.value)} style={{ ...inp, width:88 }}>
                    <option value="PEN">S/. PEN</option>
                    <option value="USD">US$ USD</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Liquidez y realizabilidad */}
          <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:14, padding:16 }}>
            <label style={{ ...lbl, color:'#166534' }}>💡 ¿Es un activo que podrías convertir en efectivo?</label>
            <div style={{ fontSize:12, color:'#166534', marginBottom:12, lineHeight:1.5 }}>
              Esto determina si se considera parte de tu "patrimonio realizable" — tu red de seguridad financiera real.
            </div>

            <div style={{ display:'flex', gap:8, marginBottom: form.es_realizable ? 14:0 }}>
              {[
                { v:true,  label:'✅ Sí, podría venderla o hipotecarla', color:'#16a34a' },
                { v:false, label:'⛔ No, no la vendería / no es opción', color:'#64748b' },
              ].map(opt => (
                <div key={String(opt.v)} onClick={() => set('es_realizable', opt.v)} style={{
                  flex:1, padding:'9px 12px', borderRadius:10, cursor:'pointer', textAlign:'center',
                  border:`1.5px solid ${form.es_realizable===opt.v ? opt.color:'var(--border)'}`,
                  background: form.es_realizable===opt.v ? `${opt.color}12`:'white',
                  fontSize:12, fontWeight: form.es_realizable===opt.v ? 700:500,
                  color: form.es_realizable===opt.v ? opt.color:'var(--text2)',
                  transition:'all 0.12s',
                }}>{opt.label}</div>
              ))}
            </div>

            {form.es_realizable && (
              <div>
                <label style={{ ...lbl, fontSize:11 }}>¿Cuánto tiempo tardarías en venderla / liquidarla?</label>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                  {LIQUIDEZ_OPCIONES.map(o => (
                    <div key={o.dias} onClick={() => set('liquidez_estimada_dias', o.dias)} style={{
                      padding:'7px 12px', borderRadius:20, cursor:'pointer',
                      fontSize:11, fontWeight:700,
                      border:`1.5px solid ${form.liquidez_estimada_dias===o.dias ? o.color:'var(--border)'}`,
                      background: form.liquidez_estimada_dias===o.dias ? `${o.color}12`:'white',
                      color: form.liquidez_estimada_dias===o.dias ? o.color:'var(--text2)',
                      transition:'all 0.12s',
                    }}>
                      {o.emoji} {o.label} <span style={{ opacity:0.7 }}>({o.desc})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
              <input type="checkbox" id="viv" checked={form.es_vivienda_propia}
                onChange={e => set('es_vivienda_propia', e.target.checked)}
                style={{ width:15, height:15, accentColor:'#2563eb', cursor:'pointer' }} />
              <label htmlFor="viv" style={{ fontSize:12, fontWeight:600, cursor:'pointer', color:'#1d4ed8' }}>
                🏠 Es la vivienda donde resido actualmente
              </label>
            </div>
          </div>

          {/* Documentación */}
          <div style={{ display:'flex', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" id="escr" checked={form.tiene_escritura}
                onChange={e => set('tiene_escritura', e.target.checked)}
                style={{ width:15, height:15, accentColor:color, cursor:'pointer' }} />
              <label htmlFor="escr" style={{ fontSize:12, fontWeight:600, cursor:'pointer' }}>
                📄 Tiene escritura / título
              </label>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" id="seg" checked={form.tiene_seguro}
                onChange={e => set('tiene_seguro', e.target.checked)}
                style={{ width:15, height:15, accentColor:color, cursor:'pointer' }} />
              <label htmlFor="seg" style={{ fontSize:12, fontWeight:600, cursor:'pointer' }}>
                🛡️ Tiene seguro vigente
              </label>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={lbl}>📝 Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Estado del inmueble, inquilino actual, condiciones especiales..."
              rows={2} style={{ ...inp, resize:'vertical' }} />
          </div>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onClose} style={btnCan}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{
            ...btnPri, background: loading ? '#d1d5db' : color,
          }}>
            {loading ? 'Guardando...' : esEdicion ? '💾 Guardar cambios' : '🏠 Registrar propiedad'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }
const modal    = { background:'white', borderRadius:20, border:'1.5px solid var(--border)', padding:'26px', width:'100%', maxWidth:560, boxShadow:'0 16px 48px rgba(0,0,0,0.15)' }
const closeBtn = { width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'var(--text3)' }
export const lbl = { fontSize:12, fontWeight:700, color:'var(--text2)', display:'block', marginBottom:7 }
export const inp = { width:'100%', padding:'10px 13px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text)', fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }
const pfx      = color => ({ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontFamily:'Nunito', fontWeight:900, fontSize:14, color })
const errorBox = { background:'#fef2f2', border:'1.5px solid #fecaca', color:'#991b1b', borderRadius:10, padding:'10px 14px', fontSize:13, marginTop:12 }
const btnCan   = { flex:1, padding:11, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
const btnPri   = { flex:2, padding:11, border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'white', fontFamily:'Poppins', transition:'all 0.15s' }
