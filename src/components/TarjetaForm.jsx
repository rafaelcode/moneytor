import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const BANCOS  = ['BCP', 'Interbank', 'BBVA', 'Scotiabank', 'BanBif', 'Banco de la Nación', 'Banco Pichincha', 'Caja Metropolitana de Lima']
const COLORES = [
  { hex: '#dc2626', label: 'Rojo'    },
  { hex: '#2563eb', label: 'Azul'    },
  { hex: '#7c3aed', label: 'Morado'  },
  { hex: '#059669', label: 'Verde'   },
  { hex: '#d97706', label: 'Naranja' },
  { hex: '#0891b2', label: 'Celeste' },
  { hex: '#374151', label: 'Gris'    },
]

// Tipos de cuenta relevantes por tipo de tarjeta
const CUENTAS_DEBITO  = ['sueldo', 'ahorro_digital', 'corriente', 'billetera_digital']
const CUENTAS_CREDITO = ['credito_entidad', 'sueldo', 'corriente']

const TIPO_EMOJI = { sueldo:'💼', ahorro_digital:'🏦', billetera_digital:'📱', corriente:'🔄', credito_entidad:'🏛️' }
const TIPO_LABEL = { sueldo:'Sueldo', ahorro_digital:'Ahorro', billetera_digital:'Billetera', corriente:'Corriente', credito_entidad:'Crédito entidad' }

const INITIAL_CREDITO = {
  tipo: 'credito', nombre_banco: '', numero: '',
  limite_credito: '', deuda_actual: '',
  fecha_corte: '', fecha_limite_pago: '', tasa_interes_anual: '',
  color: '#dc2626', activa: true, notas: '',
}
const INITIAL_DEBITO = {
  tipo: 'debito', nombre_banco: '', numero: '',
  color: '#2563eb', activa: true, notas: '',
}

const overlay  = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }
const modal    = { background: 'white', borderRadius: 20, border: '1.5px solid var(--border)', padding: '26px', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }
const lbl      = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }
const inp      = { width: '100%', padding: '10px 13px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'Poppins', outline: 'none', boxSizing: 'border-box' }
const inpErr   = { ...inp, borderColor: '#fca5a5', background: '#fef2f2' }
const sec      = { background: 'var(--bg)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '14px 16px', marginBottom: 14 }
const secTit   = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }

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

const S0 = n => `S/. ${Number(n||0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`

export default function TarjetaForm({ usuarioId, tarjeta, onClose, onGuardado }) {
  const esEdicion = Boolean(tarjeta?.id)

  function normalize(src) {
    const base   = (src.tipo === 'debito') ? { ...INITIAL_DEBITO } : { ...INITIAL_CREDITO }
    const merged = { ...base, ...src }
    ;['nombre_banco','numero','color','notas','fecha_corte','fecha_limite_pago'].forEach(k => {
      if (merged[k] == null) merged[k] = ''
    })
    ;['deuda_actual','limite_credito','tasa_interes_anual'].forEach(k => {
      if (merged[k] == null) merged[k] = ''
    })
    if (merged.activa == null) merged.activa = true
    return merged
  }

  const [form,            setForm]            = useState(() => esEdicion ? normalize(tarjeta) : { ...INITIAL_CREDITO })
  const [errors,          setErrors]          = useState({})
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)
  const [todasCuentas,    setTodasCuentas]    = useState([])
  const [cuentasSelec,    setCuentasSelec]    = useState([])
  const [cuentaPrincipal, setCuentaPrincipal] = useState('')

  function set(k, v) {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }))
  }

  function switchTipo(tipo) {
    setForm(tipo === 'credito' ? { ...INITIAL_CREDITO } : { ...INITIAL_DEBITO })
    setCuentasSelec([]); setCuentaPrincipal(''); setErrors({})
  }

  const tiposPermitidos   = form.tipo === 'debito' ? CUENTAS_DEBITO : CUENTAS_CREDITO
  const cuentasFiltradas  = todasCuentas.filter(c => tiposPermitidos.includes(c.tipo))
  const cuentasOtrasSelec = todasCuentas.filter(c => !tiposPermitidos.includes(c.tipo) && cuentasSelec.includes(c.id))
  const cuentasMostradas  = [...cuentasFiltradas, ...cuentasOtrasSelec]

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('cuentas')
        .select('id, nombre, tipo, banco, plataforma, numero_cuenta, cci, saldo_actual, moneda')
        .eq('usuario_id', usuarioId).eq('activa', true).order('creado_en')
      setTodasCuentas(data || [])

      if (esEdicion && tarjeta?.id) {
        const { data: rel } = await supabase
          .from('tarjetas_cuentas')
          .select('cuenta_id, es_principal')
          .eq('tarjeta_id', tarjeta.id)
        if (rel?.length) {
          setCuentasSelec(rel.map(r => r.cuenta_id))
          const ppal = rel.find(r => r.es_principal)
          if (ppal) setCuentaPrincipal(ppal.cuenta_id)
        }
      }
    }
    cargar()
  }, [usuarioId, esEdicion, tarjeta?.id])

  function toggleCuenta(id) {
    setCuentasSelec(prev => {
      const nuevo = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (!nuevo.includes(cuentaPrincipal)) setCuentaPrincipal('')
      if (nuevo.length === 1) setCuentaPrincipal(nuevo[0])
      return nuevo
    })
  }

  function validate() {
    const e = {}
    if (!form.nombre_banco.trim()) e.nombre_banco = 'Requerido'
    if (!form.numero.trim() || form.numero.replace(/\D/g,'').length < 4) e.numero = 'Mínimo 4 dígitos'
    if (form.tipo === 'credito') {
      if (form.limite_credito !== '' && isNaN(parseFloat(form.limite_credito))) e.limite_credito = 'Número inválido'
      if (form.deuda_actual   !== '' && isNaN(parseFloat(form.deuda_actual)))   e.deuda_actual   = 'Número inválido'
      if (form.fecha_corte && form.fecha_limite_pago && form.fecha_corte > form.fecha_limite_pago)
        e.fecha_limite_pago = 'Debe ser posterior al corte'
    }
    return e
  }

  async function guardar() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true); setError(null)

    const payload = {
      usuario_id:   usuarioId,
      tipo:         form.tipo,
      nombre_banco: form.nombre_banco.trim(),
      numero:       form.numero.replace(/\D/g,'').slice(-4),
      moneda:       'PEN',
      color:        form.color,
      activa:       form.activa,
      notas:        form.notas.trim() || null,
      ...(form.tipo === 'credito' ? {
        limite_credito:     parseFloat(form.limite_credito)    || 0,
        deuda_actual:       parseFloat(form.deuda_actual)      || 0,
        saldo_actual:       parseFloat(form.limite_credito)    || 0,
        fecha_corte:        form.fecha_corte       || null,
        fecha_limite_pago:  form.fecha_limite_pago || null,
        tasa_interes_anual: form.tasa_interes_anual ? parseFloat(form.tasa_interes_anual) : null,
      } : {
        limite_credito: 0, deuda_actual: 0, saldo_actual: 0,
        fecha_corte: null, fecha_limite_pago: null, tasa_interes_anual: null,
      }),
    }

    try {
      let tarjetaId = tarjeta?.id
      if (esEdicion) {
        const { error: err } = await supabase.from('tarjetas_credito').update(payload).eq('id', tarjetaId)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.from('tarjetas_credito').insert(payload).select('id').single()
        if (err) throw err
        tarjetaId = data.id
      }

      await supabase.from('tarjetas_cuentas').delete().eq('tarjeta_id', tarjetaId)
      if (cuentasSelec.length > 0) {
        const { error: errRel } = await supabase.from('tarjetas_cuentas').insert(
          cuentasSelec.map(cuenta_id => ({
            tarjeta_id: tarjetaId, cuenta_id, usuario_id: usuarioId,
            es_principal: cuenta_id === cuentaPrincipal,
            tipo_relacion: form.tipo === 'debito' ? 'debito_asociado' : 'pago_asociado',
          }))
        )
        if (errRel) console.warn('tarjetas_cuentas:', errRel)
      }

      onGuardado(); onClose()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar. Revisa la consola para más detalles.')
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
          <div onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' }}>×</div>
        </div>

        {/* Selector tipo */}
        {!esEdicion && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[
              { v: 'credito', emoji: '💳', label: 'Tarjeta de crédito', color: '#dc2626', bg: '#fef2f2', desc: 'Límite, deuda, ciclo de corte' },
              { v: 'debito',  emoji: '🏦', label: 'Tarjeta de débito',  color: '#2563eb', bg: '#eff6ff', desc: 'Ligada a cuenta bancaria' },
            ].map(t => (
              <div key={t.v} onClick={() => switchTipo(t.v)} style={{
                padding: '14px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${form.tipo === t.v ? t.color : 'var(--border)'}`,
                background: form.tipo === t.v ? t.bg : 'white', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 26, marginBottom: 5 }}>{t.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Nunito', color: form.tipo === t.v ? t.color : 'var(--text)' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Datos bancarios ── */}
        <div style={sec}>
          <div style={secTit}>🏦 Identificación</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Banco *" error={errors.nombre_banco}>
                <select value={form.nombre_banco} onChange={e => set('nombre_banco', e.target.value)}
                  style={errors.nombre_banco ? inpErr : inp}>
                  <option value="">Seleccionar banco...</option>
                  {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                
              </Field>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Últimos 4 dígitos de la tarjeta *" error={errors.numero}>
                <input type="text" inputMode="numeric" placeholder="1234"
                  value={form.numero}
                  onChange={e => set('numero', e.target.value.replace(/\D/g,'').slice(0,16))}
                  maxLength={16} style={errors.numero ? inpErr : inp} />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Solo crédito ── */}
        {isCredito && (
          <>
            <div style={sec}>
              <div style={secTit}>💰 Crédito y deuda</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Límite de crédito" error={errors.limite_credito}>
                  <input type="number" inputMode="decimal" placeholder="0.00" step="0.01" min="0"
                    value={form.limite_credito} onChange={e => set('limite_credito', e.target.value)}
                    style={errors.limite_credito ? inpErr : inp} />
                </Field>
                <Field label="Deuda actual" error={errors.deuda_actual}>
                  <input type="number" inputMode="decimal" placeholder="0.00" step="0.01" min="0"
                    value={form.deuda_actual} onChange={e => set('deuda_actual', e.target.value)}
                    style={errors.deuda_actual ? inpErr : inp} />
                </Field>
                <Field label="Tasa de interés anual (%)" hint="Opcional">
                  <input type="number" inputMode="decimal" placeholder="ej. 45.5" step="0.01" min="0"
                    value={form.tasa_interes_anual} onChange={e => set('tasa_interes_anual', e.target.value)}
                    style={inp} />
                </Field>
              </div>
            </div>
            <div style={sec}>
              <div style={secTit}>📅 Ciclo de facturación</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Fecha de corte" error={errors.fecha_corte}>
                  <input type="date" value={form.fecha_corte} onChange={e => set('fecha_corte', e.target.value)}
                    style={errors.fecha_corte ? inpErr : inp} />
                </Field>
                <Field label="Fecha límite de pago" error={errors.fecha_limite_pago}>
                  <input type="date" value={form.fecha_limite_pago} onChange={e => set('fecha_limite_pago', e.target.value)}
                    style={errors.fecha_limite_pago ? inpErr : inp} />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* ── Cuentas asociadas (filtradas por tipo) ── */}
        <div style={sec}>
          <div style={secTit}>
            🔗 {isCredito ? 'Cuenta de pago asociada' : 'Cuenta bancaria vinculada'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            {isCredito
              ? 'Cuenta desde la que pagas esta tarjeta (sueldo, corriente o línea de crédito)'
              : 'Cuenta de ahorro o sueldo que respalda esta tarjeta de débito'}
          </div>

          {cuentasMostradas.length === 0 ? (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fffbeb', border: '1.5px solid #fde68a', fontSize: 12, color: '#92400e' }}>
              ⚠️ No tienes cuentas del tipo requerido.{' '}
              <strong>{isCredito ? 'Agrega una cuenta sueldo, corriente o crédito entidad.' : 'Agrega una cuenta de ahorro o sueldo.'}</strong>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cuentasMostradas.map(c => {
                  const selec  = cuentasSelec.includes(c.id)
                  const esPpal = cuentaPrincipal === c.id
                  return (
                    <div key={c.id} onClick={() => toggleCuenta(c.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${selec ? colorSel : 'var(--border)'}`,
                      background: selec ? `${colorSel}08` : 'white',
                      transition: 'all 0.15s',
                    }}>
                      <input type="checkbox" checked={selec} onChange={() => toggleCuenta(c.id)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 15, height: 15, accentColor: colorSel, flexShrink: 0 }} />

                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: selec ? `${colorSel}15` : 'var(--bg)',
                        border: `1px solid ${selec ? colorSel+'30' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>
                        {TIPO_EMOJI[c.tipo] || '🏦'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          {c.nombre}
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                            background: selec ? `${colorSel}15` : 'var(--bg)',
                            color: selec ? colorSel : 'var(--text3)',
                            border: `1px solid ${selec ? colorSel+'30' : 'var(--border)'}`,
                          }}>
                            {TIPO_LABEL[c.tipo] || c.tipo}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(c.banco || c.plataforma) && <span>{c.banco || c.plataforma}</span>}
                          {c.numero_cuenta && <span style={{ fontFamily: 'monospace' }}>···{c.numero_cuenta.slice(-4)}</span>}
                          {c.cci           && <span style={{ color: '#2563eb', fontWeight: 700 }}>CCI ✓</span>}
                          {c.saldo_actual > 0 && <span style={{ fontFamily: 'Nunito', fontWeight: 800, color: '#16a34a' }}>{S0(c.saldo_actual)}</span>}
                        </div>
                      </div>

                      {selec && cuentasSelec.length > 1 && (
                        <div onClick={e => { e.stopPropagation(); setCuentaPrincipal(esPpal ? '' : c.id) }} style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                          background: esPpal ? colorSel : 'var(--bg)',
                          color: esPpal ? 'white' : 'var(--text3)',
                          border: `1px solid ${esPpal ? colorSel : 'var(--border)'}`,
                          cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}>
                          {esPpal ? '⭐ Principal' : 'Principal'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {cuentasSelec.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>✅ {cuentasSelec.length} cuenta{cuentasSelec.length !== 1 ? 's' : ''} vinculada{cuentasSelec.length !== 1 ? 's' : ''}</span>
                  {cuentaPrincipal && <span>· 1 principal</span>}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Personalización ── */}
        <div style={sec}>
          <div style={secTit}>🎨 Personalización</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {COLORES.map(c => (
              <button key={c.hex} type="button" title={c.label} onClick={() => set('color', c.hex)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c.hex, border: 'none', cursor: 'pointer',
                outline: form.color === c.hex ? `3px solid ${c.hex}` : 'none', outlineOffset: 2,
                transform: form.color === c.hex ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.12s',
              }} />
            ))}
          </div>
          <Field label="Notas (opcional)">
            <textarea value={form.notas} rows={2} placeholder="Beneficios, condiciones, etc."
              onChange={e => set('notas', e.target.value)} style={{ ...inp, resize: 'none' }} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input type="checkbox" id="activa_t" checked={form.activa}
              onChange={e => set('activa', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: colorSel }} />
            <label htmlFor="activa_t" style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
              Tarjeta activa
            </label>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text2)', fontFamily: 'Poppins' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={loading} style={{
            flex: 2, padding: 11, border: 'none', borderRadius: 10,
            background: loading ? '#d1d5db' : colorSel, color: 'white',
            fontFamily: 'Poppins', fontWeight: 700, fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            boxShadow: loading ? 'none' : `0 3px 10px ${colorSel}40`,
          }}>
            {loading ? 'Guardando...' : esEdicion ? '✅ Actualizar tarjeta' : `✅ Agregar ${isCredito ? 'crédito' : 'débito'}`}
          </button>
        </div>

      </div>
    </div>
  )
}