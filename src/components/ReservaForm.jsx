import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_RESERVA, BANCOS_PERU } from '../lib/reservasUtils'

const EMPTY = {
  nombre: '', tipo: '', saldo_actual: '',
  moneda: 'PEN', banco: '', numero_cuenta: '', cci: '',
  tasa_anual: '', meta_monto: '',
  contacto_nombre: '', contacto_email: '',
  fecha_devolucion: '', notas_admin: '', notas: '',
  color: '#2563eb', emoji: '🏦',
  // Nuevo: ¿es dinero que se puede usar ya?
  es_dinero_inmediato: false,
}

// ── Estilos ───────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100, padding: 20,
}
const modal = {
  background: 'white', borderRadius: 20,
  border: '1.5px solid var(--border)',
  padding: '26px', width: '100%', maxWidth: 520,
  maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
}
const lbl = {
  fontSize: 12, fontWeight: 700, color: 'var(--text2)',
  display: 'block', marginBottom: 6,
}
const inputStyle = {
  width: '100%', padding: '10px 13px',
  background: 'var(--bg)', border: '1.5px solid var(--border)',
  borderRadius: 10, fontSize: 13, color: 'var(--text)',
  fontFamily: 'Poppins', outline: 'none', boxSizing: 'border-box',
}
const seccion = {
  background: 'var(--bg)', borderRadius: 12,
  border: '1.5px solid var(--border)',
  padding: '14px 16px', marginBottom: 14,
}
const secTit = {
  fontSize: 11, fontWeight: 700, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

function fmtCCI(cci) {
  if (!cci) return ''
  const d = cci.replace(/\D/g, '')
  if (d.length !== 20) return cci
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,16)}-${d.slice(16)}`
}

// Tipos que por defecto son dinero inmediato (en efectivo o cuentas de ahorro accesibles)
const TIPOS_INMEDIATO_DEFAULT = ['efectivo', 'cuenta_corriente']

export default function ReservaForm({ usuarioId, reserva, onClose, onGuardado }) {
  const [form,    setForm]    = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const esEdicion = !!reserva

  useEffect(() => {
    if (reserva) setForm({ ...EMPTY, ...reserva })
  }, [reserva])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function seleccionarTipo(tipo) {
    const t = TIPOS_RESERVA.find(t => t.valor === tipo)
    const esDineroInmediato = TIPOS_INMEDIATO_DEFAULT.includes(tipo)
    setForm(f => ({
      ...f,
      tipo,
      color: t.color,
      emoji: t.emoji,
      es_dinero_inmediato: esDineroInmediato,
    }))
  }

  async function guardar() {
    setError('')
    if (!form.nombre.trim()) return setError('Escribe un nombre para esta reserva.')
    if (!form.tipo)          return setError('Selecciona el tipo de reserva.')
    if (form.saldo_actual === '' || isNaN(form.saldo_actual))
      return setError('Ingresa el saldo actual.')
    if (form.cci && form.cci.replace(/\D/g, '').length !== 20)
      return setError('El CCI debe tener exactamente 20 dígitos.')

    setLoading(true)
    const payload = {
      usuario_id:       usuarioId,
      nombre:           form.nombre.trim(),
      tipo:             form.tipo,
      saldo_actual:     Number(form.saldo_actual),
      moneda:           form.moneda,
      banco:            form.banco || null,
      numero_cuenta:    form.numero_cuenta || null,
      cci:              form.cci ? form.cci.replace(/\D/g, '') : null,
      tasa_anual:       form.tasa_anual ? Number(form.tasa_anual) : null,
      meta_monto:       form.meta_monto ? Number(form.meta_monto) : null,
      contacto_nombre:  form.contacto_nombre || null,
      contacto_email:   form.contacto_email  || null,
      fecha_devolucion: form.fecha_devolucion || null,
      notas_admin:      form.notas_admin || null,
      notas:            form.notas || null,
      color:            form.color,
      emoji:            form.emoji,
      // Nuevo campo
      es_dinero_inmediato: form.es_dinero_inmediato === true,
      actualizado_en:   new Date().toISOString(),
    }

    let err
    if (esEdicion) {
      ;({ error: err } = await supabase.from('reservas').update(payload).eq('id', reserva.id))
    } else {
      ;({ error: err } = await supabase.from('reservas').insert({ ...payload, activa: true, creado_en: new Date().toISOString() }))
    }

    setLoading(false)
    if (err) { console.error(err); return setError('No se pudo guardar. Revisa la consola.') }
    onGuardado()
    onClose()
  }

  const tipoSel = TIPOS_RESERVA.find(t => t.valor === form.tipo)
  const tieneBanco = tipoSel?.campos?.includes('banco') ?? false
  const tieneNumCuenta = tipoSel?.campos?.includes('numero_cuenta') ?? false
  const tieneMeta = tipoSel?.campos?.includes('meta_monto') ?? false
  const tieneContacto = tipoSel?.campos?.includes('contacto_nombre') ?? false
  const tieneDevolucion = tipoSel?.campos?.includes('fecha_devolucion') ?? false

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18 }}>
              {esEdicion ? '✏️ Editar reserva' : '🛡️ Nueva reserva'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {esEdicion ? reserva.nombre : 'Fondo de emergencia, efectivo, ahorros'}
            </div>
          </div>
          <div onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--bg)', border: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, color: 'var(--text3)',
          }}>×</div>
        </div>

        {/* Selector de tipo */}
        {!esEdicion && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...lbl, marginBottom: 10 }}>Tipo de reserva *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TIPOS_RESERVA.map(t => (
                <div key={t.valor} onClick={() => seleccionarTipo(t.valor)} style={{
                  padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${form.tipo === t.valor ? t.color : 'var(--border)'}`,
                  background: form.tipo === t.valor ? `${t.color}12` : 'white',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'Nunito', color: form.tipo === t.valor ? t.color : 'var(--text)', lineHeight: 1.3 }}>
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
            {tipoSel && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${tipoSel.color}10`, border: `1px solid ${tipoSel.color}30`, fontSize: 12, color: tipoSel.color, fontWeight: 600 }}>
                {tipoSel.emoji} {tipoSel.desc}
              </div>
            )}
          </div>
        )}

        {/* ── Datos principales ── */}
        {(form.tipo || esEdicion) && (
          <>
            <div style={seccion}>
              <div style={secTit}>📋 Datos de la reserva</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Nombre *">
                    <input type="text" placeholder="ej. Fondo de emergencia"
                      value={form.nombre} onChange={e => set('nombre', e.target.value)}
                      style={inputStyle} autoFocus />
                  </Field>
                </div>

                {tieneBanco && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="Banco / Entidad">
                      <select value={form.banco} onChange={e => set('banco', e.target.value)} style={inputStyle}>
                        <option value="">Seleccionar...</option>
                        {BANCOS_PERU.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </Field>
                  </div>
                )}

                {tieneNumCuenta && (
                  <>
                    <Field label="Número de cuenta" hint="Opcional">
                      <input type="text" placeholder="ej. 191-123456789-0-12"
                        value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)}
                        style={inputStyle} />
                    </Field>
                    <Field label="CCI" hint="20 dígitos">
                      <input type="text" inputMode="numeric"
                        placeholder="20 dígitos"
                        value={form.cci}
                        onChange={e => set('cci', e.target.value.replace(/\D/g, '').slice(0, 20))}
                        maxLength={20}
                        style={inputStyle}
                      />
                      {form.cci && form.cci.length === 20 && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, fontFamily: 'monospace' }}>
                          {fmtCCI(form.cci)}
                        </div>
                      )}
                    </Field>
                  </>
                )}

                <Field label="Moneda">
                  <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={inputStyle}>
                    {['PEN','USD','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Saldo actual *">
                  <input type="number" inputMode="decimal"
                    placeholder="0.00" step="0.01" min="0"
                    value={form.saldo_actual} onChange={e => set('saldo_actual', e.target.value)}
                    style={inputStyle} />
                </Field>

                {tieneBanco && (
                  <Field label="Tasa anual (%)" hint="Opcional">
                    <input type="number" inputMode="decimal"
                      placeholder="ej. 4.5" step="0.01" min="0"
                      value={form.tasa_anual} onChange={e => set('tasa_anual', e.target.value)}
                      style={inputStyle} />
                  </Field>
                )}

                {tieneMeta && (
                  <Field label="Meta / Objetivo" hint="Monto objetivo a alcanzar">
                    <input type="number" inputMode="decimal"
                      placeholder="0.00" step="0.01" min="0"
                      value={form.meta_monto} onChange={e => set('meta_monto', e.target.value)}
                      style={inputStyle} />
                  </Field>
                )}
              </div>
            </div>

            {/* ── ¿Es dinero inmediato? ── */}
            <div style={seccion}>
              <div style={secTit}>💰 Disponibilidad</div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                background: form.es_dinero_inmediato ? '#f0fdf4' : '#faf5ff',
                border: `1.5px solid ${form.es_dinero_inmediato ? '#bbf7d0' : '#e9d5ff'}`,
              }} onClick={() => set('es_dinero_inmediato', !form.es_dinero_inmediato)}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.es_dinero_inmediato ? '#15803d' : '#7c3aed' }}>
                    {form.es_dinero_inmediato ? '✅ Dinero disponible hoy' : '🔒 Reservado / Bloqueado'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {form.es_dinero_inmediato
                      ? 'Se suma al KPI de saldo real disponible'
                      : 'No se suma al saldo real (fondo de emergencia, patrimonio, etc.)'}
                  </div>
                </div>
                <div style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: form.es_dinero_inmediato ? '#16a34a' : '#d1d5db',
                  position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 2,
                    left: form.es_dinero_inmediato ? 20 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </div>
            </div>

            {/* ── Contacto (reserva_administrada) ── */}
            {tieneContacto && (
              <div style={seccion}>
                <div style={secTit}>👤 Datos del responsable</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Nombre del responsable">
                    <input type="text" placeholder="Nombre completo"
                      value={form.contacto_nombre} onChange={e => set('contacto_nombre', e.target.value)}
                      style={inputStyle} />
                  </Field>
                  <Field label="Email (opcional)">
                    <input type="email" placeholder="correo@ejemplo.com"
                      value={form.contacto_email} onChange={e => set('contacto_email', e.target.value)}
                      style={inputStyle} />
                  </Field>
                  {tieneDevolucion && (
                    <Field label="Fecha acordada de devolución">
                      <input type="date"
                        value={form.fecha_devolucion} onChange={e => set('fecha_devolucion', e.target.value)}
                        style={inputStyle} />
                    </Field>
                  )}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="Notas de administración">
                      <textarea value={form.notas_admin} rows={2}
                        placeholder="Condiciones, acuerdos, recordatorios..."
                        onChange={e => set('notas_admin', e.target.value)}
                        style={{ ...inputStyle, resize: 'none' }} />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notas generales ── */}
            <div style={seccion}>
              <div style={secTit}>📝 Notas</div>
              <textarea value={form.notas} rows={2}
                placeholder="Información adicional sobre esta reserva..."
                onChange={e => set('notas', e.target.value)}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1.5px solid #fecaca',
                borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14,
              }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: 11, background: 'var(--bg)',
                border: '1.5px solid var(--border)', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                color: 'var(--text2)', fontFamily: 'Poppins',
              }}>Cancelar</button>
              <button onClick={guardar} disabled={loading} style={{
                flex: 2, padding: 11, border: 'none', borderRadius: 10,
                background: loading ? '#d1d5db' : (tipoSel?.color || '#2563eb'),
                color: 'white', fontFamily: 'Poppins', fontWeight: 700,
                fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : `0 3px 10px ${tipoSel?.color || '#2563eb'}40`,
                transition: 'all 0.15s',
              }}>
                {loading ? 'Guardando...' : esEdicion ? '✅ Actualizar reserva' : '✅ Crear reserva'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
