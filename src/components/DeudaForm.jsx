import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_DEUDA } from '../lib/deudasUtils'

const EMPTY = {
  nombre: '', tipo: 'tarjeta_credito', direccion: 'debo',
  monto_total: '', monto_pendiente: '',
  tiene_interes: false, tasa_anual: '', tasa_mensual: '',
  es_en_cuotas: false, total_cuotas: '', cuotas_pagadas: '0', monto_cuota: '',
  fecha_inicio: '', fecha_vencimiento: '', dia_pago_mes: '',
  contacto_nombre: '', contacto_email: '',
  notas: '',
}

export default function DeudaForm({ usuarioId, deuda, onClose, onGuardado }) {
  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const esEdicion             = !!deuda

  useEffect(() => {
    if (deuda) setForm({ ...EMPTY, ...deuda })
  }, [deuda])

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  // Si cambia monto_total en deuda nueva, pre-rellena monto_pendiente
  function onMontoTotal(v) {
    set('monto_total', v)
    if (!esEdicion) set('monto_pendiente', v)
  }

  async function guardar() {
    setError('')
    if (!form.nombre.trim())           return setError('Escribe un nombre para la deuda.')
    if (!form.monto_total || Number(form.monto_total) <= 0)
                                       return setError('El monto total debe ser mayor a 0.')
    if (!form.monto_pendiente || Number(form.monto_pendiente) < 0)
                                       return setError('El monto pendiente no puede ser negativo.')

    setLoading(true)
    const payload = {
      usuario_id:        usuarioId,
      nombre:            form.nombre.trim(),
      tipo:              form.tipo,
      direccion:         form.direccion,
      monto_total:       Number(form.monto_total),
      monto_pendiente:   Number(form.monto_pendiente),
      tiene_interes:     form.tiene_interes,
      tasa_anual:        form.tiene_interes && form.tasa_anual   ? Number(form.tasa_anual)   : null,
      tasa_mensual:      form.tiene_interes && form.tasa_mensual ? Number(form.tasa_mensual) : null,
      es_en_cuotas:      form.es_en_cuotas,
      total_cuotas:      form.es_en_cuotas && form.total_cuotas    ? Number(form.total_cuotas)    : null,
      cuotas_pagadas:    form.es_en_cuotas && form.cuotas_pagadas  ? Number(form.cuotas_pagadas)  : 0,
      monto_cuota:       form.es_en_cuotas && form.monto_cuota     ? Number(form.monto_cuota)     : null,
      dia_pago_mes:      form.dia_pago_mes   ? Number(form.dia_pago_mes)   : null,
      fecha_inicio:      form.fecha_inicio      || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      contacto_nombre:   form.contacto_nombre.trim() || null,
      contacto_email:    form.contacto_email.trim()  || null,
      notas:             form.notas.trim() || null,
      actualizado_en:    new Date().toISOString(),
    }

    let err
    if (esEdicion) {
      ;({ error: err } = await supabase.from('deudas').update(payload).eq('id', deuda.id))
    } else {
      ;({ error: err } = await supabase.from('deudas').insert({ ...payload, estado: 'activa' }))
    }

    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); console.error(err) }
    else     { onGuardado(); onClose() }
    setLoading(false)
  }

  const tipoSeleccionado = TIPOS_DEUDA.find(t => t.valor === form.tipo)
  const colorTipo = tipoSeleccionado?.color || '#6c63ff'
  const esAmigo   = form.tipo === 'deuda_amigo'

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 520 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18 }}>
              {esEdicion ? '✏️ Editar deuda' : '💳 Nueva deuda'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>Completa los datos</div>
          </div>
          <div onClick={onClose} style={closeBtnStyle}>×</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>

          {/* Dirección: debo / me deben */}
          <div>
            <label style={labelStyle}>¿Es una deuda que tú debes o que te deben a ti?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'debo',     e: '📤', t: 'Yo debo' },
                { v: 'me_deben', e: '📥', t: 'Me deben a mí' },
              ].map(d => (
                <div key={d.v} onClick={() => set('direccion', d.v)} style={{
                  ...toggleChip,
                  background: form.direccion === d.v ? colorTipo : 'var(--bg)',
                  color:      form.direccion === d.v ? 'white' : 'var(--text2)',
                  border:     `1.5px solid ${form.direccion === d.v ? colorTipo : 'var(--border)'}`,
                }}>
                  {d.e} {d.t}
                </div>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label style={labelStyle}>📝 Nombre / Descripción</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Tarjeta BCP, Préstamo María, Laptop Saga..."
              style={inputStyle} />
          </div>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>🏷️ Tipo de deuda</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 7 }}>
              {TIPOS_DEUDA.map(t => (
                <div key={t.valor} onClick={() => set('tipo', t.valor)} style={{
                  padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, fontWeight: form.tipo === t.valor ? 700 : 500,
                  background: form.tipo === t.valor ? `${t.color}15` : 'var(--bg)',
                  border: `1.5px solid ${form.tipo === t.valor ? t.color : 'var(--border)'}`,
                  color: form.tipo === t.valor ? t.color : 'var(--text2)',
                  transition: 'all 0.12s',
                }}>
                  <span style={{ fontSize: 16 }}>{t.emoji}</span> {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* Contacto (solo si es deuda amigo) */}
          {esAmigo && (
            <div style={{ background: '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: 12, padding: 14 }}>
              <label style={{ ...labelStyle, color: '#0f766e' }}>👤 Datos del contacto</label>
              <input value={form.contacto_nombre}
                onChange={e => set('contacto_nombre', e.target.value)}
                placeholder="Nombre de la persona"
                style={{ ...inputStyle, marginBottom: 8 }} />
              <input value={form.contacto_email}
                onChange={e => set('contacto_email', e.target.value)}
                placeholder="Email (opcional, para futuras notificaciones)"
                style={inputStyle} />
            </div>
          )}

          {/* Montos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>💰 Monto total original</label>
              <div style={{ position: 'relative' }}>
                <span style={prefixStyle}>S/.</span>
                <input type="number" value={form.monto_total}
                  onChange={e => onMontoTotal(e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...inputStyle, paddingLeft: 40 }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>⏳ Monto pendiente</label>
              <div style={{ position: 'relative' }}>
                <span style={prefixStyle}>S/.</span>
                <input type="number" value={form.monto_pendiente}
                  onChange={e => set('monto_pendiente', e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...inputStyle, paddingLeft: 40 }} />
              </div>
            </div>
          </div>

          {/* Toggle: tiene interés */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--bg)', borderRadius: 10, padding: '12px 14px',
            border: '1.5px solid var(--border)' }}>
            <input type="checkbox" id="interes" checked={form.tiene_interes}
              onChange={e => set('tiene_interes', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: colorTipo, cursor: 'pointer' }} />
            <label htmlFor="interes" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              💹 Esta deuda cobra intereses
            </label>
          </div>

          {form.tiene_interes && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: 14 }}>
              <label style={{ ...labelStyle, color: '#991b1b' }}>📊 Tasas de interés</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>TEA (anual %)</label>
                  <input type="number" value={form.tasa_anual}
                    onChange={e => set('tasa_anual', e.target.value)}
                    placeholder="Ej: 45" min="0" step="0.01" style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>TEM (mensual %)</label>
                  <input type="number" value={form.tasa_mensual}
                    onChange={e => set('tasa_mensual', e.target.value)}
                    placeholder="Ej: 3.5" min="0" step="0.01" style={inputStyle} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#991b1b', marginTop: 8, fontWeight: 500 }}>
                💡 Llena solo una. Si no sabes la TEM, divide la TEA entre 12.
              </div>
            </div>
          )}

          {/* Toggle: es en cuotas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--bg)', borderRadius: 10, padding: '12px 14px',
            border: '1.5px solid var(--border)' }}>
            <input type="checkbox" id="cuotas" checked={form.es_en_cuotas}
              onChange={e => set('es_en_cuotas', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: colorTipo, cursor: 'pointer' }} />
            <label htmlFor="cuotas" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🔢 Se paga en cuotas
            </label>
          </div>

          {form.es_en_cuotas && (
            <div style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Total cuotas</label>
                  <input type="number" value={form.total_cuotas}
                    onChange={e => set('total_cuotas', e.target.value)}
                    placeholder="Ej: 36" min="1" style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Cuotas pagadas</label>
                  <input type="number" value={form.cuotas_pagadas}
                    onChange={e => set('cuotas_pagadas', e.target.value)}
                    placeholder="Ej: 12" min="0" style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Monto por cuota</label>
                  <div style={{ position: 'relative' }}>
                    <span style={prefixStyle}>S/.</span>
                    <input type="number" value={form.monto_cuota}
                      onChange={e => set('monto_cuota', e.target.value)}
                      placeholder="0.00" min="0" step="0.01"
                      style={{ ...inputStyle, paddingLeft: 40 }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>📅 Fecha de inicio</label>
              <input type="date" value={form.fecha_inicio}
                onChange={e => set('fecha_inicio', e.target.value)} style={inputStyle} />
            </div>
            {!form.es_en_cuotas ? (
              <div>
                <label style={labelStyle}>⏰ Fecha de vencimiento</label>
                <input type="date" value={form.fecha_vencimiento}
                  onChange={e => set('fecha_vencimiento', e.target.value)} style={inputStyle} />
              </div>
            ) : (
              <div>
                <label style={labelStyle}>📆 Día de pago cada mes</label>
                <input type="number" value={form.dia_pago_mes}
                  onChange={e => set('dia_pago_mes', e.target.value)}
                  placeholder="Ej: 15" min="1" max="31" style={inputStyle} />
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label style={labelStyle}>📝 Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Detalles adicionales, condiciones especiales..."
              rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </div>

        {error && <div style={errorStyle}>⚠️ {error}</div>}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={btnCancelStyle}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ ...btnPrimaryStyle, background: loading ? '#d1d5db' : colorTipo }}>
            {loading ? 'Guardando...' : esEdicion ? '💾 Guardar cambios' : '💳 Agregar deuda'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Estilos compartidos ───────────────────────────────────
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}
const modalStyle = {
  background: 'white', borderRadius: 20, border: '1.5px solid var(--border)',
  padding: '28px', width: '100%',
  boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
}
const closeBtnStyle = {
  width: 32, height: 32, borderRadius: 8, background: 'var(--bg)',
  border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: 'var(--text3)',
}
export const labelStyle = {
  fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 7,
}
export const inputStyle = {
  width: '100%', padding: '10px 14px', background: 'var(--bg)',
  border: '1.5px solid var(--border)', borderRadius: 10,
  fontSize: 13, color: 'var(--text)', fontFamily: 'Poppins',
  outline: 'none', boxSizing: 'border-box',
}
const prefixStyle = {
  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
  fontFamily: 'Nunito', fontWeight: 900, fontSize: 13, color: 'var(--text3)',
}
const toggleChip = {
  flex: 1, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
  fontSize: 13, fontWeight: 700, textAlign: 'center', transition: 'all 0.15s',
}
const errorStyle = {
  background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 14,
}
const btnCancelStyle = {
  flex: 1, padding: 11, background: 'var(--bg)', border: '1.5px solid var(--border)',
  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  color: 'var(--text2)', fontFamily: 'Poppins',
}
const btnPrimaryStyle = {
  flex: 2, padding: 11, border: 'none', borderRadius: 10,
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  color: 'white', fontFamily: 'Poppins', transition: 'all 0.15s',
}
