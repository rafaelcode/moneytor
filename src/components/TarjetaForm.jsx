import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MONEDAS = ['PEN', 'USD', 'EUR']

const BANCOS = ['BCP', 'Interbank', 'BBVA', 'Scotiabank', 'BanBif', 'Banco de la Nación', 'Pichincha', 'Otro']

const COLORES = [
  { hex: '#2563eb', label: 'Azul' },
  { hex: '#7c3aed', label: 'Morado' },
  { hex: '#059669', label: 'Verde' },
  { hex: '#dc2626', label: 'Rojo' },
  { hex: '#d97706', label: 'Naranja' },
  { hex: '#0891b2', label: 'Celeste' },
  { hex: '#374151', label: 'Gris' },
]

const INITIAL_CREDITO = {
  tipo: 'credito',
  nombre_banco: '',
  numero: '',
  numero_cuenta: '',
  limite_credito: '',
  saldo_actual: '',
  deuda_actual: '',
  moneda: 'PEN',
  fecha_corte: '',
  fecha_limite_pago: '',
  tasa_interes_anual: '',
  color: '#dc2626',
  activa: true,
  notas: '',
}

const INITIAL_DEBITO = {
  tipo: 'debito',
  nombre_banco: '',
  numero: '',
  numero_cuenta: '',
  saldo_actual: '',
  moneda: 'PEN',
  color: '#2563eb',
  activa: true,
  notas: '',
}

// ── Estilos compartidos ───────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100, padding: '20px',
}
const modal = {
  background: 'white', borderRadius: 20,
  border: '1.5px solid var(--border)',
  padding: '26px', width: '100%', maxWidth: 540,
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
const inputError = {
  ...inputStyle,
  borderColor: '#fca5a5', background: '#fef2f2',
}
const seccion = {
  background: 'var(--bg)', borderRadius: 12,
  border: '1.5px solid var(--border)',
  padding: '14px 16px', marginBottom: 14,
}
const seccionTitle = {
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

export default function TarjetaForm({ usuarioId, tarjeta, onClose, onGuardado }) {
  const esEdicion = Boolean(tarjeta?.id)

  const getInitial = () => {
    if (esEdicion) {
      return {
        tipo: tarjeta.tipo || 'credito',
        nombre_banco: tarjeta.nombre_banco ?? '',
        numero: tarjeta.numero ?? '',
        numero_cuenta: tarjeta.numero_cuenta ?? '',
        limite_credito: tarjeta.limite_credito ?? '',
        saldo_actual: tarjeta.saldo_actual ?? '',
        deuda_actual: tarjeta.deuda_actual ?? '',
        moneda: tarjeta.moneda ?? 'PEN',
        fecha_corte: tarjeta.fecha_corte ?? '',
        fecha_limite_pago: tarjeta.fecha_limite_pago ?? '',
        tasa_interes_anual: tarjeta.tasa_interes_anual ?? '',
        color: tarjeta.color ?? '#2563eb',
        activa: tarjeta.activa ?? true,
        notas: tarjeta.notas ?? '',
      }
    }
    return INITIAL_CREDITO
  }

  const [form,    setForm]    = useState(getInitial)
  const [errors,  setErrors]  = useState({})
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function set(name, value) {
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  function switchTipo(tipo) {
    setForm(tipo === 'credito' ? { ...INITIAL_CREDITO } : { ...INITIAL_DEBITO })
    setErrors({})
  }

  function validate() {
    const e = {}
    if (!form.nombre_banco.trim()) e.nombre_banco = 'Requerido'
    if (!form.numero.trim()) e.numero = 'Requerido'
    if (form.numero.trim().length < 4) e.numero = 'Mínimo 4 dígitos'
    if (form.saldo_actual !== '' && isNaN(parseFloat(form.saldo_actual))) e.saldo_actual = 'Número inválido'
    if (form.tipo === 'credito') {
      if (form.limite_credito !== '' && isNaN(parseFloat(form.limite_credito))) e.limite_credito = 'Número inválido'
      if (form.deuda_actual !== '' && isNaN(parseFloat(form.deuda_actual))) e.deuda_actual = 'Número inválido'
      if (form.fecha_corte && form.fecha_limite_pago && form.fecha_corte > form.fecha_limite_pago)
        e.fecha_limite_pago = 'Debe ser posterior al corte'
    }
    return e
  }

  async function guardar() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    setError(null)

    const payload = {
      usuario_id:   usuarioId,
      tipo:         form.tipo,
      nombre_banco: form.nombre_banco.trim(),
      numero:       form.numero.trim().slice(-4),
      numero_cuenta: form.numero_cuenta.trim() || null,
      saldo_actual: parseFloat(form.saldo_actual) || 0,
      moneda:       form.moneda,
      color:        form.color,
      activa:       form.activa,
      notas:        form.notas.trim() || null,
      ...(form.tipo === 'credito' ? {
        limite_credito:    parseFloat(form.limite_credito) || 0,
        deuda_actual:      parseFloat(form.deuda_actual) || 0,
        fecha_corte:       form.fecha_corte || null,
        fecha_limite_pago: form.fecha_limite_pago || null,
        tasa_interes_anual: form.tasa_interes_anual ? parseFloat(form.tasa_interes_anual) : null,
      } : {
        limite_credito:    null,
        deuda_actual:      0,
        fecha_corte:       null,
        fecha_limite_pago: null,
        tasa_interes_anual: null,
      }),
    }

    try {
      const { error: err } = esEdicion
        ? await supabase.from('tarjetas_credito').update(payload).eq('id', tarjeta.id)
        : await supabase.from('tarjetas_credito').insert(payload)
      if (err) throw err
      onGuardado()
      onClose()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar. Verifica que la tabla tenga las columnas tipo y numero_cuenta.')
    } finally {
      setLoading(false)
    }
  }

  const isCredito = form.tipo === 'credito'
  const colorSel  = isCredito ? '#dc2626' : '#2563eb'

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18 }}>
              {esEdicion ? '✏️ Editar tarjeta' : '💳 Nueva tarjeta'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {esEdicion ? `${tarjeta.nombre_banco} ···· ${tarjeta.numero}` : 'Registra débito o crédito'}
            </div>
          </div>
          <div onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--bg)', border: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, color: 'var(--text3)',
          }}>×</div>
        </div>

        {/* Selector tipo (solo en creación) */}
        {!esEdicion && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[
              { v: 'credito', emoji: '💳', label: 'Tarjeta de crédito', color: '#dc2626', bg: '#fef2f2', desc: 'Límite, deuda, corte' },
              { v: 'debito',  emoji: '🏦', label: 'Tarjeta de débito',  color: '#2563eb', bg: '#eff6ff', desc: 'Saldo, cuenta bancaria' },
            ].map(t => (
              <div key={t.v} onClick={() => switchTipo(t.v)} style={{
                padding: '14px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${form.tipo === t.v ? t.color : 'var(--border)'}`,
                background: form.tipo === t.v ? t.bg : 'white',
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 26, marginBottom: 5 }}>{t.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Nunito', color: form.tipo === t.v ? t.color : 'var(--text)' }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Sección: Datos bancarios ── */}
        <div style={seccion}>
          <div style={seccionTitle}>🏦 Datos bancarios</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Banco *" error={errors.nombre_banco}>
                <select
                  value={form.nombre_banco}
                  onChange={e => set('nombre_banco', e.target.value)}
                  style={errors.nombre_banco ? inputError : inputStyle}
                >
                  <option value="">Seleccionar banco...</option>
                  {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {form.nombre_banco === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Nombre del banco"
                    value={form._banco_otro || ''}
                    onChange={e => { set('_banco_otro', e.target.value); set('nombre_banco', e.target.value) }}
                    style={{ ...inputStyle, marginTop: 8 }}
                  />
                )}
              </Field>
            </div>

            <Field label="Nº de tarjeta (últimos 4 dígitos) *" error={errors.numero}>
              <input
                type="text" inputMode="numeric"
                placeholder="1234"
                value={form.numero}
                onChange={e => set('numero', e.target.value.replace(/\D/g, '').slice(0, 16))}
                maxLength={16}
                style={errors.numero ? inputError : inputStyle}
              />
            </Field>

            <Field label="Número de cuenta" hint="Opcional — para identificación">
              <input
                type="text" inputMode="numeric"
                placeholder="ej. 191-123456789-0-12"
                value={form.numero_cuenta}
                onChange={e => set('numero_cuenta', e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Moneda">
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={inputStyle}>
                {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            <Field label={isCredito ? 'Saldo disponible' : 'Saldo actual *'} error={errors.saldo_actual}>
              <input
                type="number" inputMode="decimal"
                placeholder="0.00" step="0.01" min="0"
                value={form.saldo_actual}
                onChange={e => set('saldo_actual', e.target.value)}
                style={errors.saldo_actual ? inputError : inputStyle}
              />
            </Field>
          </div>
        </div>

        {/* ── Sección: Solo crédito ── */}
        {isCredito && (
          <>
            <div style={seccion}>
              <div style={seccionTitle}>💰 Crédito y deuda</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Límite de crédito" error={errors.limite_credito}>
                  <input
                    type="number" inputMode="decimal"
                    placeholder="0.00" step="0.01" min="0"
                    value={form.limite_credito}
                    onChange={e => set('limite_credito', e.target.value)}
                    style={errors.limite_credito ? inputError : inputStyle}
                  />
                </Field>
                <Field label="Deuda actual" error={errors.deuda_actual}>
                  <input
                    type="number" inputMode="decimal"
                    placeholder="0.00" step="0.01" min="0"
                    value={form.deuda_actual}
                    onChange={e => set('deuda_actual', e.target.value)}
                    style={errors.deuda_actual ? inputError : inputStyle}
                  />
                </Field>
                <Field label="Tasa de interés anual (%)" hint="Opcional">
                  <input
                    type="number" inputMode="decimal"
                    placeholder="ej. 45.5" step="0.01" min="0"
                    value={form.tasa_interes_anual}
                    onChange={e => set('tasa_interes_anual', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>

            <div style={seccion}>
              <div style={seccionTitle}>📅 Ciclo de facturación</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Fecha de corte" error={errors.fecha_corte}>
                  <input
                    type="date" value={form.fecha_corte}
                    onChange={e => set('fecha_corte', e.target.value)}
                    style={errors.fecha_corte ? inputError : inputStyle}
                  />
                </Field>
                <Field label="Fecha límite de pago" error={errors.fecha_limite_pago}>
                  <input
                    type="date" value={form.fecha_limite_pago}
                    onChange={e => set('fecha_limite_pago', e.target.value)}
                    style={errors.fecha_limite_pago ? inputError : inputStyle}
                  />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* ── Sección: Color ── */}
        <div style={seccion}>
          <div style={seccionTitle}>🎨 Personalización</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            {COLORES.map(c => (
              <button key={c.hex} type="button" title={c.label}
                onClick={() => set('color', c.hex)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c.hex, border: 'none', cursor: 'pointer',
                  outline: form.color === c.hex ? `3px solid ${c.hex}` : 'none',
                  outlineOffset: 2,
                  transform: form.color === c.hex ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.12s',
                }}
              />
            ))}
          </div>
          <Field label="Notas (opcional)">
            <textarea
              value={form.notas} rows={2}
              placeholder="Beneficios, condiciones, etc."
              onChange={e => set('notas', e.target.value)}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input type="checkbox" id="activa" checked={form.activa}
              onChange={e => set('activa', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: colorSel }}
            />
            <label htmlFor="activa" style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
              Tarjeta activa
            </label>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Acciones */}
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
            transition: 'all 0.15s',
            boxShadow: loading ? 'none' : `0 3px 10px ${colorSel}40`,
          }}>
            {loading ? 'Guardando...' : esEdicion ? '✅ Actualizar tarjeta' : `✅ Agregar ${isCredito ? 'crédito' : 'débito'}`}
          </button>
        </div>

      </div>
    </div>
  )
}
