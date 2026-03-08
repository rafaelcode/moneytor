import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  TIPOS_AHORRO, BANCOS_PERU,
  calcularInteresProyectado, proximoDepositoCTS,
  fmt,
} from '../lib/ahorroUtils'

const EMPTY = {
  nombre: '', tipo: '', monto: '', moneda: 'PEN',
  banco: '', numero_cuenta: '',
  tasa_anual: '', tasa_efectiva: '',
  fecha_inicio: '', fecha_vencimiento: '', dias_plazo: '',
  renovacion_auto: false,
  cts_disponible: true, cts_empleador: '',
  cts_ultimo_deposito: '', cts_proximo_deposito: '',
  notas: '',
}

export default function AhorroForm({ usuarioId, ahorro, onClose, onGuardado }) {
  const [form,    setForm]    = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const esEdicion = !!ahorro

  useEffect(() => {
    if (ahorro) setForm({ ...EMPTY, ...ahorro })
    else {
      // Fecha inicio por defecto: hoy
      const hoy = new Date().toISOString().split('T')[0]
      setForm(f => ({ ...f, fecha_inicio: hoy }))
    }
  }, [ahorro])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function seleccionarTipo(tipo) {
    const hoy  = new Date().toISOString().split('T')[0]
    const prox = proximoDepositoCTS()
    setForm(f => ({
      ...f, tipo,
      // Pre-rellenar fecha próximo depósito CTS
      cts_proximo_deposito: tipo === 'cts' ? prox.fecha : '',
      fecha_inicio: hoy,
    }))
  }

  // Auto-calcular fecha vencimiento desde días plazo
  function onDiasPlazo(v) {
    set('dias_plazo', v)
    if (v && form.fecha_inicio) {
      const d = new Date(form.fecha_inicio + 'T00:00:00')
      d.setDate(d.getDate() + Number(v))
      set('fecha_vencimiento', d.toISOString().split('T')[0])
    }
  }

  // Auto-calcular días desde fechas
  function onFechaVencimiento(v) {
    set('fecha_vencimiento', v)
    if (v && form.fecha_inicio) {
      const ini = new Date(form.fecha_inicio + 'T00:00:00')
      const fin = new Date(v + 'T00:00:00')
      const dias = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24))
      if (dias > 0) set('dias_plazo', dias)
    }
  }

  const interesProyectado = calcularInteresProyectado(
    form.monto, form.tasa_anual, form.fecha_inicio, form.fecha_vencimiento
  )

  async function guardar() {
    setError('')
    if (!form.nombre.trim()) return setError('Escribe un nombre.')
    if (!form.tipo)          return setError('Selecciona el tipo.')
    if (!form.monto || Number(form.monto) <= 0) return setError('Ingresa el monto.')

    setLoading(true)
    const payload = {
      usuario_id:           usuarioId,
      nombre:               form.nombre.trim(),
      tipo:                 form.tipo,
      monto:                Number(form.monto),
      moneda:               form.moneda,
      banco:                form.banco || null,
      numero_cuenta:        form.numero_cuenta || null,
      tasa_anual:           form.tasa_anual    ? Number(form.tasa_anual)    : null,
      tasa_efectiva:        form.tasa_efectiva ? Number(form.tasa_efectiva) : null,
      interes_proyectado:   interesProyectado > 0 ? interesProyectado       : null,
      fecha_inicio:         form.fecha_inicio      || null,
      fecha_vencimiento:    form.fecha_vencimiento || null,
      dias_plazo:           form.dias_plazo ? Number(form.dias_plazo)       : null,
      renovacion_auto:      form.renovacion_auto,
      cts_disponible:       form.cts_disponible,
      cts_empleador:        form.cts_empleador || null,
      cts_ultimo_deposito:  form.cts_ultimo_deposito  || null,
      cts_proximo_deposito: form.cts_proximo_deposito || null,
      estado:               'activo',
      notas:                form.notas || null,
      actualizado_en:       new Date().toISOString(),
    }

    let err
    if (esEdicion) {
      ;({ error: err } = await supabase.from('ahorro_programado').update(payload).eq('id', ahorro.id))
    } else {
      ;({ error: err } = await supabase.from('ahorro_programado').insert(payload))
    }

    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); console.error(err) }
    else     { onGuardado(); onClose() }
    setLoading(false)
  }

  const tipoSel     = TIPOS_AHORRO.find(t => t.valor === form.tipo)
  const colorActivo = tipoSel?.color || '#0891b2'
  const esPlazo     = form.tipo === 'plazo_fijo'
  const esCTS       = form.tipo === 'cts'
  const esFondo     = form.tipo === 'fondo_empresa'
  const simbolo     = form.moneda === 'USD' ? 'US$' : form.moneda === 'EUR' ? '€' : 'S/.'

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18 }}>
              {esEdicion ? '✏️ Editar ahorro' : '📅 Nuevo ahorro programado'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Depósitos con fecha o condiciones especiales
            </div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        <div style={{ maxHeight:'72vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:16, paddingRight:2 }}>

          {/* Tipo */}
          <div>
            <label style={lbl}>🏷️ Tipo de ahorro programado</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {TIPOS_AHORRO.map(t => (
                <div key={t.valor} onClick={() => seleccionarTipo(t.valor)} style={{
                  padding:'12px 10px', borderRadius:12, cursor:'pointer', textAlign:'center',
                  border:`1.5px solid ${form.tipo===t.valor ? t.color : 'var(--border)'}`,
                  background: form.tipo===t.valor ? `${t.color}12` : 'var(--bg)',
                  transition:'all 0.12s',
                }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{t.emoji}</div>
                  <div style={{ fontSize:12, fontWeight: form.tipo===t.valor ? 700:500, color: form.tipo===t.valor ? t.color:'var(--text2)', lineHeight:1.3 }}>{t.label}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:3, lineHeight:1.3 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label style={lbl}>📝 Nombre</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder={
                esPlazo ? 'Ej: Plazo fijo BCP 90 días' :
                esCTS   ? 'Ej: Mi CTS Interbank' :
                esFondo ? 'Ej: Fondo de ahorro empresa XYZ' :
                'Nombre descriptivo'
              }
              style={inp} />
          </div>

          {/* Monto + Moneda */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10 }}>
            <div>
              <label style={lbl}>💰 {esCTS ? 'Saldo actual CTS' : 'Monto depositado'}</label>
              <div style={{ position:'relative' }}>
                <span style={prefix(colorActivo)}>{simbolo}</span>
                <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...inp, paddingLeft:46, fontSize:18, fontWeight:700, color:colorActivo }} />
              </div>
            </div>
            <div>
              <label style={lbl}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={{ ...inp, width:88 }}>
                <option value="PEN">S/. PEN</option>
                <option value="USD">US$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
          </div>

          {/* Banco */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={lbl}>🏦 Banco / Entidad</label>
              <select value={form.banco} onChange={e => set('banco', e.target.value)} style={inp}>
                <option value="">Selecciona</option>
                {BANCOS_PERU.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>N° cuenta (opcional)</label>
              <input value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)}
                placeholder="••••••••" style={inp} />
            </div>
          </div>

          {/* ── Campos específicos PLAZO FIJO ── */}
          {esPlazo && (
            <div style={{ background:'#ecfeff', border:'1.5px solid #a5f3fc', borderRadius:14, padding:16 }}>
              <label style={{ ...lbl, color:'#0e7490' }}>🔒 Condiciones del plazo fijo</label>

              {/* Tasa */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>TEA (tasa anual %)</label>
                  <input type="number" value={form.tasa_anual}
                    onChange={e => set('tasa_anual', e.target.value)}
                    placeholder="Ej: 7.5" min="0" step="0.01" style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>TNA (si el banco la da)</label>
                  <input type="number" value={form.tasa_efectiva}
                    onChange={e => set('tasa_efectiva', e.target.value)}
                    placeholder="Ej: 7.0" min="0" step="0.01" style={inp} />
                </div>
              </div>

              {/* Fechas + días */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio}
                    onChange={e => set('fecha_inicio', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Días plazo</label>
                  <input type="number" value={form.dias_plazo}
                    onChange={e => onDiasPlazo(e.target.value)}
                    placeholder="Ej: 90" min="1" style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Fecha vencimiento</label>
                  <input type="date" value={form.fecha_vencimiento}
                    onChange={e => onFechaVencimiento(e.target.value)} style={inp} />
                </div>
              </div>

              {/* Renovación automática */}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'white', borderRadius:10, border:'1px solid #a5f3fc' }}>
                <input type="checkbox" id="reno" checked={form.renovacion_auto}
                  onChange={e => set('renovacion_auto', e.target.checked)}
                  style={{ width:15, height:15, accentColor:'#0891b2', cursor:'pointer' }} />
                <label htmlFor="reno" style={{ fontSize:13, fontWeight:600, cursor:'pointer', color:'#0e7490' }}>
                  🔄 El banco renueva automáticamente al vencer
                </label>
              </div>

              {/* Interés proyectado */}
              {interesProyectado > 0 && (
                <div style={{ marginTop:12, padding:'10px 14px', background:'white', borderRadius:10, border:'1px solid #a5f3fc' }}>
                  <div style={{ fontSize:11, color:'#0e7490', fontWeight:600, marginBottom:2 }}>
                    💹 Interés proyectado al vencer
                  </div>
                  <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color:'#16a34a' }}>
                    +{fmt(interesProyectado, form.moneda)}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
                    Total al vencer: {fmt(Number(form.monto) + interesProyectado, form.moneda)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Campos específicos CTS ── */}
          {esCTS && (
            <div style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:14, padding:16 }}>
              <label style={{ ...lbl, color:'#6d28d9' }}>🏛️ Información CTS</label>

              {/* Estado disponibilidad */}
              <div style={{ marginBottom:14 }}>
                <label style={{ ...lbl, fontSize:11 }}>¿Está disponible para retiro actualmente?</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[
                    { v:true,  label:'✅ Sí, libre disposición', color:'#16a34a' },
                    { v:false, label:'🔐 No, restringida',        color:'#7c3aed' },
                  ].map(opt => (
                    <div key={String(opt.v)} onClick={() => set('cts_disponible', opt.v)} style={{
                      flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer', textAlign:'center',
                      border:`1.5px solid ${form.cts_disponible===opt.v ? opt.color : 'var(--border)'}`,
                      background: form.cts_disponible===opt.v ? `${opt.color}12` : 'var(--bg)',
                      fontSize:12, fontWeight: form.cts_disponible===opt.v ? 700:500,
                      color: form.cts_disponible===opt.v ? opt.color : 'var(--text2)',
                      transition:'all 0.12s',
                    }}>
                      {opt.label}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'#6d28d9', marginTop:8, fontWeight:500 }}>
                  💡 Desde 2024 la CTS está en libre disposición por ley temporal. Actualiza este estado si cambia la ley.
                </div>
              </div>

              {/* Empleador */}
              <div style={{ marginBottom:12 }}>
                <label style={{ ...lbl, fontSize:11 }}>Empleador actual</label>
                <input value={form.cts_empleador} onChange={e => set('cts_empleador', e.target.value)}
                  placeholder="Nombre de la empresa" style={inp} />
              </div>

              {/* Tasa CTS */}
              <div style={{ marginBottom:12 }}>
                <label style={{ ...lbl, fontSize:11 }}>Tasa de interés del banco (opcional)</label>
                <input type="number" value={form.tasa_anual}
                  onChange={e => set('tasa_anual', e.target.value)}
                  placeholder="Ej: 3.5" min="0" step="0.01" style={inp} />
              </div>

              {/* Fechas depósito */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Último depósito del empleador</label>
                  <input type="date" value={form.cts_ultimo_deposito}
                    onChange={e => set('cts_ultimo_deposito', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Próximo depósito esperado</label>
                  <input type="date" value={form.cts_proximo_deposito}
                    onChange={e => set('cts_proximo_deposito', e.target.value)} style={inp} />
                </div>
              </div>
            </div>
          )}

          {/* ── Campos FONDO EMPRESA ── */}
          {esFondo && (
            <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:14, padding:16 }}>
              <label style={{ ...lbl, color:'#92400e' }}>🏢 Condiciones del fondo</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Empleador</label>
                  <input value={form.cts_empleador} onChange={e => set('cts_empleador', e.target.value)}
                    placeholder="Empresa" style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Tasa / rendimiento %</label>
                  <input type="number" value={form.tasa_anual}
                    onChange={e => set('tasa_anual', e.target.value)}
                    placeholder="Ej: 5.0" min="0" step="0.01" style={inp} />
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label style={lbl}>📝 Notas (opcional)</label>
            <input value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Condiciones especiales, recordatorios..." style={inp} />
          </div>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onClose} style={btnCan}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{
            ...btnPri, background: loading ? '#d1d5db' : colorActivo,
          }}>
            {loading ? 'Guardando...' : esEdicion ? '💾 Guardar cambios' : '📅 Crear ahorro'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }
const modal    = { background:'white', borderRadius:20, border:'1.5px solid var(--border)', padding:'26px', width:'100%', maxWidth:520, boxShadow:'0 16px 48px rgba(0,0,0,0.15)' }
const closeBtn = { width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'var(--text3)' }
export const lbl = { fontSize:12, fontWeight:700, color:'var(--text2)', display:'block', marginBottom:7 }
export const inp = { width:'100%', padding:'10px 13px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text)', fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }
const prefix   = color => ({ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontFamily:'Nunito', fontWeight:900, fontSize:15, color })
const errorBox = { background:'#fef2f2', border:'1.5px solid #fecaca', color:'#991b1b', borderRadius:10, padding:'10px 14px', fontSize:13, marginTop:12 }
const btnCan   = { flex:1, padding:11, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
const btnPri   = { flex:2, padding:11, border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'white', fontFamily:'Poppins', transition:'all 0.15s' }
