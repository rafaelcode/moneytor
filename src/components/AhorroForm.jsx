import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  TIPOS_AHORRO, BANCOS_PERU,
  calcularInteresProyectado, proximoDepositoCTS,
  fmt,
} from '../lib/ahorroUtils'

const EMPTY = {
  nombre: '', tipo: '', monto: '', moneda: 'PEN',
  banco: '', numero_cuenta: '', cci: '',
  tasa_anual: '', tasa_efectiva: '',
  fecha_inicio: '', fecha_vencimiento: '', dias_plazo: '',
  renovacion_auto: false,
  cts_disponible: true, cts_empleador: '',
  cts_ultimo_deposito: '', cts_proximo_deposito: '',
  notas: '',
  // Nuevo: indica si este ahorro es patrimonio intangible (no disponible)
  es_intangible: true,
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
  padding: '26px', width: '100%', maxWidth: 560,
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

// Formatea CCI con guiones para legibilidad
function fmtCCI(cci) {
  if (!cci) return ''
  const d = cci.replace(/\D/g, '')
  if (d.length !== 20) return cci
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,16)}-${d.slice(16)}`
}

export default function AhorroForm({ usuarioId, ahorro, onClose, onGuardado }) {
  const [form,    setForm]    = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [errors,  setErrors]  = useState({})
  const esEdicion = !!ahorro

  useEffect(() => {
    if (ahorro) {
      setForm({ ...EMPTY, ...ahorro })
    } else {
      const hoy = new Date().toISOString().split('T')[0]
      setForm(f => ({ ...f, fecha_inicio: hoy }))
    }
  }, [ahorro])

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }))
  }

  function seleccionarTipo(tipo) {
    const hoy  = new Date().toISOString().split('T')[0]
    const prox = proximoDepositoCTS()
    // CTS y plazo_fijo son intangibles por defecto
    const esIntangible = ['cts', 'plazo_fijo'].includes(tipo)
    setForm(f => ({
      ...f, tipo,
      es_intangible: esIntangible,
      cts_proximo_deposito: tipo === 'cts' ? prox.fecha : '',
      fecha_inicio: hoy,
    }))
  }

  function onDiasPlazo(v) {
    set('dias_plazo', v)
    if (v && form.fecha_inicio) {
      const d = new Date(form.fecha_inicio + 'T00:00:00')
      d.setDate(d.getDate() + Number(v))
      set('fecha_vencimiento', d.toISOString().split('T')[0])
    }
  }

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
    if (form.cci && form.cci.replace(/\D/g, '').length !== 20)
      return setError('El CCI debe tener exactamente 20 dígitos.')

    setLoading(true)
    const payload = {
      usuario_id:           usuarioId,
      nombre:               form.nombre.trim(),
      tipo:                 form.tipo,
      monto:                Number(form.monto),
      moneda:               form.moneda,
      banco:                form.banco || null,
      numero_cuenta:        form.numero_cuenta || null,
      cci:                  form.cci ? form.cci.replace(/\D/g, '') : null,
      tasa_anual:           form.tasa_anual ? Number(form.tasa_anual) : null,
      tasa_efectiva:        form.tasa_efectiva ? Number(form.tasa_efectiva) : null,
      interes_proyectado:   interesProyectado || null,
      fecha_inicio:         form.fecha_inicio || null,
      fecha_vencimiento:    form.fecha_vencimiento || null,
      dias_plazo:           form.dias_plazo ? Number(form.dias_plazo) : null,
      renovacion_auto:      form.renovacion_auto,
      cts_disponible:       form.tipo === 'cts' ? form.cts_disponible : null,
      cts_empleador:        form.tipo === 'cts' ? (form.cts_empleador || null) : null,
      cts_periodo:          form.tipo === 'cts' ? (form.cts_periodo || null) : null,
      cts_ultimo_deposito:  form.tipo === 'cts' ? (form.cts_ultimo_deposito || null) : null,
      cts_proximo_deposito: form.tipo === 'cts' ? (form.cts_proximo_deposito || null) : null,
      // Nuevo campo
      es_intangible:        form.es_intangible !== false,
      notas:                form.notas || null,
      actualizado_en:       new Date().toISOString(),
    }

    try {
      const { error: err } = esEdicion
        ? await supabase.from('ahorro_programado').update(payload).eq('id', ahorro.id)
        : await supabase.from('ahorro_programado').insert({ ...payload, estado: 'activo', creado_en: new Date().toISOString() })
      if (err) throw err
      onGuardado()
      onClose()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar. Revisa la consola para más detalles.')
    } finally {
      setLoading(false)
    }
  }

  const tipoInfo = TIPOS_AHORRO.find(t => t.valor === form.tipo)
  const esCTS = form.tipo === 'cts'

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18 }}>
              {esEdicion ? '✏️ Editar ahorro' : '💰 Nuevo ahorro programado'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {esEdicion ? ahorro.nombre : 'Plazo fijo, CTS, fondo empresa'}
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
            <label style={{ ...lbl, marginBottom: 10 }}>Tipo de ahorro *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TIPOS_AHORRO.map(t => (
                <div key={t.valor} onClick={() => seleccionarTipo(t.valor)} style={{
                  padding: '12px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${form.tipo === t.valor ? t.color : 'var(--border)'}`,
                  background: form.tipo === t.valor ? `${t.color}12` : 'white',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{t.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Nunito', color: form.tipo === t.valor ? t.color : 'var(--text)', lineHeight: 1.3 }}>
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
            {tipoInfo && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${tipoInfo.color}10`, border: `1px solid ${tipoInfo.color}30`, fontSize: 12, color: tipoInfo.color, fontWeight: 600 }}>
                {tipoInfo.emoji} {tipoInfo.desc}
              </div>
            )}
          </div>
        )}

        {/* ── Datos principales ── */}
        {(form.tipo || esEdicion) && (
          <>
            <div style={seccion}>
              <div style={secTit}>📋 Datos del ahorro</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Nombre *">
                    <input type="text"
                      placeholder={esCTS ? 'ej. CTS BCP 2024' : 'ej. Plazo fijo Interbank'}
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      style={inputStyle}
                      autoFocus
                    />
                  </Field>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Banco / Entidad">
                    <select value={form.banco} onChange={e => set('banco', e.target.value)} style={inputStyle}>
                      <option value="">Seleccionar banco...</option>
                      {BANCOS_PERU.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Número de cuenta" hint="Opcional">
                  <input type="text" placeholder="ej. 191-123456789-0-12"
                    value={form.numero_cuenta}
                    onChange={e => set('numero_cuenta', e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="CCI (Código Interbancario)" hint="20 dígitos">
                  <input type="text" inputMode="numeric"
                    placeholder="ej. 00219100012345678901"
                    value={form.cci}
                    onChange={e => set('cci', e.target.value.replace(/\D/g, '').slice(0, 20))}
                    maxLength={20}
                    style={inputStyle}
                  />
                  {form.cci && form.cci.length === 20 && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'monospace' }}>
                      {fmtCCI(form.cci)}
                    </div>
                  )}
                </Field>

                <Field label="Moneda">
                  <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={inputStyle}>
                    {['PEN','USD','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Monto *">
                  <input type="number" inputMode="decimal"
                    placeholder="0.00" step="0.01" min="0"
                    value={form.monto}
                    onChange={e => set('monto', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>

            {/* ── Clasificación: intangible o disponible ── */}
            <div style={seccion}>
              <div style={secTit}>💰 ¿Es dinero disponible?</div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                background: form.es_intangible ? '#faf5ff' : '#f0fdf4',
                border: `1.5px solid ${form.es_intangible ? '#e9d5ff' : '#bbf7d0'}`,
              }} onClick={() => set('es_intangible', !form.es_intangible)}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.es_intangible ? '#7c3aed' : '#15803d' }}>
                    {form.es_intangible ? '🔒 Patrimonio intangible' : '✅ Disponible (puede retirarse)'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {form.es_intangible
                      ? 'No suma al saldo disponible del Dashboard (CTS, plazo fijo, etc.)'
                      : 'Suma al saldo disponible — se puede usar hoy'}
                  </div>
                </div>
                <div style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: form.es_intangible ? '#7c3aed' : '#16a34a',
                  position: 'relative', flexShrink: 0,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 2,
                    left: form.es_intangible ? 2 : 20,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </div>
            </div>

            {/* ── Tasas y plazos (solo plazo_fijo / fondo_empresa) ── */}
            {['plazo_fijo', 'fondo_empresa'].includes(form.tipo) && (
              <div style={seccion}>
                <div style={secTit}>📈 Tasas y plazos</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Tasa anual (%)" hint="TEA">
                    <input type="number" inputMode="decimal" placeholder="ej. 7.5" step="0.01" min="0"
                      value={form.tasa_anual} onChange={e => set('tasa_anual', e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Tasa efectiva (%)" hint="TNA o TEA, según banco">
                    <input type="number" inputMode="decimal" placeholder="ej. 7.2" step="0.01" min="0"
                      value={form.tasa_efectiva} onChange={e => set('tasa_efectiva', e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Fecha de inicio">
                    <input type="date" value={form.fecha_inicio}
                      onChange={e => { set('fecha_inicio', e.target.value); if (form.dias_plazo) onDiasPlazo(form.dias_plazo) }}
                      style={inputStyle} />
                  </Field>
                  <Field label="Días de plazo">
                    <input type="number" inputMode="numeric" placeholder="ej. 180"
                      value={form.dias_plazo} onChange={e => onDiasPlazo(e.target.value)} style={inputStyle} />
                  </Field>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="Fecha de vencimiento">
                      <input type="date" value={form.fecha_vencimiento}
                        onChange={e => onFechaVencimiento(e.target.value)} style={inputStyle} />
                    </Field>
                  </div>
                  {interesProyectado > 0 && (
                    <div style={{
                      gridColumn: '1 / -1',
                      padding: '10px 14px', borderRadius: 10,
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      fontSize: 13, color: '#1d4ed8', fontWeight: 600,
                    }}>
                      📊 Interés proyectado: <strong>{fmt(interesProyectado, form.moneda)}</strong>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="renovacion" checked={form.renovacion_auto}
                      onChange={e => set('renovacion_auto', e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: '#2563eb' }} />
                    <label htmlFor="renovacion" style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                      Renovación automática al vencer
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── Campos específicos CTS ── */}
            {esCTS && (
              <div style={seccion}>
                <div style={secTit}>🏛️ Datos CTS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Tasa anual (%)" hint="TEA">
                    <input type="number" inputMode="decimal" placeholder="ej. 3.5" step="0.01" min="0"
                      value={form.tasa_anual} onChange={e => set('tasa_anual', e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Empleador (empresa)">
                    <input type="text" placeholder="ej. Mi empresa S.A."
                      value={form.cts_empleador} onChange={e => set('cts_empleador', e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Último depósito CTS">
                    <input type="date" value={form.cts_ultimo_deposito}
                      onChange={e => set('cts_ultimo_deposito', e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Próximo depósito CTS">
                    <input type="date" value={form.cts_proximo_deposito}
                      onChange={e => set('cts_proximo_deposito', e.target.value)} style={inputStyle} />
                  </Field>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="cts_disp" checked={form.cts_disponible}
                      onChange={e => set('cts_disponible', e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: '#7c3aed' }} />
                    <label htmlFor="cts_disp" style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                      CTS disponible para retiro parcial
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notas ── */}
            <div style={seccion}>
              <div style={secTit}>📝 Notas</div>
              <textarea value={form.notas} rows={2}
                placeholder="Condiciones especiales, recordatorios..."
                onChange={e => set('notas', e.target.value)}
                style={{ ...inputStyle, resize: 'none' }}
              />
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
                background: loading ? '#d1d5db' : (tipoInfo?.color || '#2563eb'),
                color: 'white', fontFamily: 'Poppins', fontWeight: 700,
                fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : `0 3px 10px ${tipoInfo?.color || '#2563eb'}40`,
                transition: 'all 0.15s',
              }}>
                {loading ? 'Guardando...' : esEdicion ? '✅ Actualizar' : '✅ Guardar ahorro'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
