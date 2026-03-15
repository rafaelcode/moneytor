import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_CUENTA, BANCOS_PERU, BILLETERAS } from '../lib/cuentasUtils'

const MONEDAS = ['PEN', 'USD', 'EUR']

const EMPTY = {
  tipo: '',
  nombre: '',
  banco: '',
  plataforma: '',
  numero_cuenta: '',
  numero_telefono: '',
  entidad_pagadora: '',
  dia_pago: '',
  saldo_actual: '',
  deuda_actual: '',
  limite_credito: '',
  tasa_anual: '',
  fecha_vencimiento: '',
  moneda: 'PEN',
  color: '#2563eb',
  activa: true,
  notas: '',
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
const inputErr = { ...inputStyle, borderColor: '#fca5a5', background: '#fef2f2' }
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

export default function CuentaForm({ usuarioId, cuenta, onClose, onGuardado }) {
  const esEdicion = Boolean(cuenta?.id)
  const [form,    setForm]    = useState(() => esEdicion ? { ...EMPTY, ...cuenta } : EMPTY)
  const [errors,  setErrors]  = useState({})
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (esEdicion && cuenta) setForm({ ...EMPTY, ...cuenta })
  }, [cuenta])

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }))
  }

  function selTipo(tipo) {
    const t = TIPOS_CUENTA.find(t => t.valor === tipo)
    setForm(f => ({ ...f, tipo, color: t.color }))
    setErrors({})
  }

  function validate() {
    const e = {}
    if (!form.tipo)               e.tipo = 'Selecciona un tipo'
    if (!form.nombre.trim())      e.nombre = 'Requerido'
    if (form.saldo_actual === '' || isNaN(form.saldo_actual)) e.saldo_actual = 'Ingresa un saldo válido'
    if (form.tipo === 'credito_entidad') {
      if (form.limite_credito !== '' && isNaN(form.limite_credito)) e.limite_credito = 'Número inválido'
    }
    return e
  }

  async function guardar() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true); setError(null)

    const payload = {
      usuario_id:        usuarioId,
      tipo:              form.tipo,
      nombre:            form.nombre.trim(),
      banco:             form.banco || null,
      plataforma:        form.plataforma || null,
      numero_cuenta:     form.numero_cuenta || null,
      numero_telefono:   form.numero_telefono || null,
      entidad_pagadora:  form.entidad_pagadora || null,
      dia_pago:          form.dia_pago ? Number(form.dia_pago) : null,
      saldo_actual:      Number(form.saldo_actual) || 0,
      deuda_actual:      form.tipo === 'credito_entidad' ? (Number(form.deuda_actual) || 0) : 0,
      limite_credito:    form.tipo === 'credito_entidad' ? (Number(form.limite_credito) || 0) : null,
      tasa_anual:        form.tasa_anual ? Number(form.tasa_anual) : null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      moneda:            form.moneda,
      color:             form.color,
      activa:            form.activa,
      notas:             form.notas.trim() || null,
      actualizado_en:    new Date().toISOString(),
    }

    try {
      const { error: err } = esEdicion
        ? await supabase.from('cuentas').update(payload).eq('id', cuenta.id)
        : await supabase.from('cuentas').insert({ ...payload, creado_en: new Date().toISOString() })
      if (err) throw err
      onGuardado(); onClose()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar. Asegúrate de que la tabla "cuentas" exista en Supabase.')
    } finally {
      setLoading(false)
    }
  }

  const tipoSel   = TIPOS_CUENTA.find(t => t.valor === form.tipo)
  const colorSel  = tipoSel?.color || '#2563eb'
  const esBanco   = ['sueldo', 'ahorro_digital', 'corriente', 'credito_entidad'].includes(form.tipo)
  const esBilletera = form.tipo === 'billetera_digital'
  const esSueldo  = form.tipo === 'sueldo'
  const esCredito = form.tipo === 'credito_entidad'

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18 }}>
              {esEdicion ? '✏️ Editar cuenta' : '🏦 Nueva cuenta'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {esEdicion ? cuenta.nombre : 'Registra una cuenta o billetera'}
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
            <label style={{ ...lbl, marginBottom: 10 }}>Tipo de cuenta *</label>
            {errors.tipo && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8 }}>{errors.tipo}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TIPOS_CUENTA.map(t => (
                <div key={t.valor} onClick={() => selTipo(t.valor)} style={{
                  padding: '12px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${form.tipo === t.valor ? t.color : 'var(--border)'}`,
                  background: form.tipo === t.valor ? `${t.color}12` : 'white',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{t.emoji}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, fontFamily: 'Nunito',
                    color: form.tipo === t.valor ? t.color : 'var(--text)',
                    lineHeight: 1.3,
                  }}>{t.label}</div>
                </div>
              ))}
            </div>
            {tipoSel && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                background: `${colorSel}10`, border: `1px solid ${colorSel}30`,
                fontSize: 12, color: colorSel, fontWeight: 600,
              }}>
                {tipoSel.emoji} {tipoSel.desc}
              </div>
            )}
          </div>
        )}

        {/* ── Datos principales ── */}
        {(form.tipo || esEdicion) && (
          <>
            <div style={seccion}>
              <div style={secTit}>📋 Datos de la cuenta</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Nombre de la cuenta *" error={errors.nombre}>
                    <input
                      type="text"
                      placeholder={
                        esSueldo   ? 'ej. Sueldo BCP, Cuenta quincena...' :
                        esBilletera? 'ej. Mi Yape, Plin personal...' :
                        esCredito  ? 'ej. Crédito hipotecario BBVA...' :
                                     'ej. Ahorros BCP, Cuenta corriente...'
                      }
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      style={errors.nombre ? inputErr : inputStyle}
                      autoFocus
                    />
                  </Field>
                </div>

                {/* Banco */}
                {esBanco && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="Banco / Entidad">
                      <select value={form.banco} onChange={e => set('banco', e.target.value)} style={inputStyle}>
                        <option value="">Seleccionar...</option>
                        {BANCOS_PERU.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </Field>
                  </div>
                )}

                {/* Billetera */}
                {esBilletera && (
                  <>
                    <Field label="Plataforma">
                      <select value={form.plataforma} onChange={e => set('plataforma', e.target.value)} style={inputStyle}>
                        <option value="">Seleccionar...</option>
                        {BILLETERAS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </Field>
                    <Field label="Número de celular" hint="Opcional">
                      <input type="tel" placeholder="9xx xxx xxx"
                        value={form.numero_telefono}
                        onChange={e => set('numero_telefono', e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                  </>
                )}

                {/* Nº cuenta */}
                {esBanco && (
                  <Field label="Número de cuenta" hint="Opcional">
                    <input type="text" placeholder="ej. 191-123456789-0-12"
                      value={form.numero_cuenta}
                      onChange={e => set('numero_cuenta', e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                )}

                {/* Cuenta sueldo: empresa y día */}
                {esSueldo && (
                  <>
                    <Field label="Empresa / Pagador" hint="Opcional">
                      <input type="text" placeholder="ej. Mi empresa S.A."
                        value={form.entidad_pagadora}
                        onChange={e => set('entidad_pagadora', e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Día de pago" hint="Día del mes, ej: 15 y 30">
                      <input type="text" placeholder="ej. 15 y 30"
                        value={form.dia_pago}
                        onChange={e => set('dia_pago', e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                  </>
                )}

                {/* Moneda y saldo */}
                <Field label="Moneda">
                  <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={inputStyle}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label={esCredito ? 'Saldo disponible' : 'Saldo actual *'} error={errors.saldo_actual}>
                  <input type="number" inputMode="decimal"
                    placeholder="0.00" step="0.01" min="0"
                    value={form.saldo_actual}
                    onChange={e => set('saldo_actual', e.target.value)}
                    style={errors.saldo_actual ? inputErr : inputStyle}
                  />
                </Field>
              </div>
            </div>

            {/* ── Sección crédito ── */}
            {esCredito && (
              <div style={seccion}>
                <div style={secTit}>💳 Detalles del crédito</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Deuda actual" error={errors.deuda_actual}>
                    <input type="number" inputMode="decimal"
                      placeholder="0.00" step="0.01" min="0"
                      value={form.deuda_actual}
                      onChange={e => set('deuda_actual', e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Límite de crédito" error={errors.limite_credito}>
                    <input type="number" inputMode="decimal"
                      placeholder="0.00" step="0.01" min="0"
                      value={form.limite_credito}
                      onChange={e => set('limite_credito', e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Tasa de interés anual (%)" hint="Opcional">
                    <input type="number" inputMode="decimal"
                      placeholder="ej. 18.5" step="0.01" min="0"
                      value={form.tasa_anual}
                      onChange={e => set('tasa_anual', e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Fecha de vencimiento" hint="Opcional">
                    <input type="date"
                      value={form.fecha_vencimiento}
                      onChange={e => set('fecha_vencimiento', e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* ── Tasa ahorro ── */}
            {form.tipo === 'ahorro_digital' && (
              <div style={seccion}>
                <div style={secTit}>📈 Rendimiento</div>
                <Field label="Tasa de ahorro anual (%)" hint="Opcional — para estimar intereses">
                  <input type="number" inputMode="decimal"
                    placeholder="ej. 5.5" step="0.01" min="0"
                    value={form.tasa_anual}
                    onChange={e => set('tasa_anual', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            )}

            {/* ── Notas y color ── */}
            <div style={seccion}>
              <div style={secTit}>🎨 Personalización</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                {['#16a34a','#2563eb','#7c3aed','#dc2626','#d97706','#0891b2','#374151'].map(c => (
                  <button key={c} type="button" onClick={() => set('color', c)} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    border: 'none', cursor: 'pointer',
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.12s',
                  }} />
                ))}
              </div>
              <Field label="Notas (opcional)">
                <textarea value={form.notas} rows={2}
                  placeholder="Información adicional sobre esta cuenta..."
                  onChange={e => set('notas', e.target.value)}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input type="checkbox" id="cta_activa" checked={form.activa}
                  onChange={e => set('activa', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: colorSel }}
                />
                <label htmlFor="cta_activa" style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                  Cuenta activa
                </label>
              </div>
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
                background: loading ? '#d1d5db' : colorSel,
                color: 'white', fontFamily: 'Poppins', fontWeight: 700,
                fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : `0 3px 10px ${colorSel}40`,
                transition: 'all 0.15s',
              }}>
                {loading ? 'Guardando...' : esEdicion ? '✅ Actualizar cuenta' : '✅ Crear cuenta'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
