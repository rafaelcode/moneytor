import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, accionesDeTipo, calcNuevoSaldo } from '../lib/cuentasUtils'

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100, padding: 20,
}
const modal = {
  background: 'white', borderRadius: 20,
  border: '1.5px solid var(--border)',
  padding: '26px', width: '100%', maxWidth: 420,
  boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
}
const lbl = {
  fontSize: 12, fontWeight: 700, color: 'var(--text2)',
  display: 'block', marginBottom: 7,
}
const inputStyle = {
  width: '100%', padding: '10px 13px',
  background: 'var(--bg)', border: '1.5px solid var(--border)',
  borderRadius: 10, fontSize: 13, color: 'var(--text)',
  fontFamily: 'Poppins', outline: 'none', boxSizing: 'border-box',
}

export default function MovimientoCuentaForm({ usuarioId, cuenta, todasLasCuentas, onClose, onGuardado }) {
  const hoy     = new Date().toISOString().split('T')[0]
  const ACCIONES = accionesDeTipo(cuenta.tipo)

  const [accion,         setAccion]         = useState(ACCIONES[0].v)
  const [monto,          setMonto]          = useState('')
  const [fecha,          setFecha]          = useState(hoy)
  const [descripcion,    setDescripcion]    = useState('')
  const [cuentaDestino,  setCuentaDestino]  = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')

  const accionSel    = ACCIONES.find(a => a.v === accion)
  const montoN = parseFloat(parseFloat(monto || 0).toFixed(2))
  const esTransf     = accion === 'transferencia'
  const nuevoEstado  = monto !== '' && !isNaN(monto) ? calcNuevoSaldo(cuenta, accion, monto) : null

  // Cuentas destino disponibles (para transferencia)
  const otrasCtas = (todasLasCuentas || []).filter(c => c.id !== cuenta.id)

  async function registrar() {
    setError('')
    if (!monto || isNaN(monto) || montoN <= 0)
      return setError('Ingresa un monto válido mayor a 0.')
    if (esTransf && !cuentaDestino)
      return setError('Selecciona la cuenta de destino.')
    if (['retiro', 'transferencia', 'pago', 'quincena'].includes(accion) && accion !== 'quincena') {
      if (montoN > Number(cuenta.saldo_actual))
        return setError(`Saldo insuficiente. Disponible: ${fmt(cuenta.saldo_actual, cuenta.moneda)}`)
    }

    setLoading(true)
    try {
      // 1. Registrar movimiento de la cuenta origen
      const { error: e1 } = await supabase.from('movimientos_cuenta').insert({
        cuenta_id:       cuenta.id,
        usuario_id:      usuarioId,
        tipo:            accion,
        monto:           montoN,
        descripcion:     descripcion.trim() || null,
        fecha,
        cuenta_destino_id: esTransf ? cuentaDestino : null,
      })
      if (e1) throw e1

      // 2. Actualizar saldo de la cuenta origen
      const { error: e2 } = await supabase.from('cuentas').update({
        ...nuevoEstado,
        actualizado_en: new Date().toISOString(),
      }).eq('id', cuenta.id)
      if (e2) throw e2

      // 3. Si es transferencia, acreditar en cuenta destino
      if (esTransf && cuentaDestino) {
        const destino = otrasCtas.find(c => c.id === cuentaDestino)
        if (destino) {
          const nuevoSaldoDest = Number(destino.saldo_actual || 0) + montoN

          await supabase.from('movimientos_cuenta').insert({
            cuenta_id:       cuentaDestino,
            usuario_id:      usuarioId,
            tipo:            'deposito',
            monto:           montoN,
            descripcion:     `Transferencia desde ${cuenta.nombre}`,
            fecha,
            cuenta_origen_id: cuenta.id,
          })

          await supabase.from('cuentas').update({
            saldo_actual:   nuevoSaldoDest,
            actualizado_en: new Date().toISOString(),
          }).eq('id', cuentaDestino)
        }
      }

      onGuardado()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Error al registrar. Verifica que la tabla movimientos_cuenta exista.')
    } finally {
      setLoading(false)
    }
  }

  const simbolo = cuenta.moneda === 'USD' ? 'US$' : cuenta.moneda === 'EUR' ? '€' : 'S/.'

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 17 }}>
              {cuenta.tipo === 'billetera_digital' ? '📱' : cuenta.tipo === 'sueldo' ? '💼' : '🏦'} {cuenta.nombre}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              Saldo actual:{' '}
              <strong style={{ color: cuenta.color || '#2563eb' }}>
                {fmt(cuenta.saldo_actual, cuenta.moneda)}
              </strong>
              {cuenta.tipo === 'credito_entidad' && (
                <> · Deuda: <strong style={{ color: '#ef4444' }}>{fmt(cuenta.deuda_actual, cuenta.moneda)}</strong></>
              )}
            </div>
          </div>
          <div onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--bg)', border: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, color: 'var(--text3)',
          }}>×</div>
        </div>

        {/* Selector de acción */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(ACCIONES.length, 4)}, 1fr)`,
          gap: 8, marginBottom: 18,
        }}>
          {ACCIONES.map(a => (
            <div key={a.v} onClick={() => { setAccion(a.v); setMonto('') }} style={{
              padding: '10px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
              border: `1.5px solid ${accion === a.v ? a.color : 'var(--border)'}`,
              background: accion === a.v ? `${a.color}12` : 'var(--bg)',
              transition: 'all 0.12s',
            }}>
              <div style={{ fontSize: 18, fontFamily: 'Nunito', fontWeight: 900, color: a.color }}>{a.e}</div>
              <div style={{ fontSize: 11, fontWeight: accion === a.v ? 700 : 500, color: accion === a.v ? a.color : 'var(--text2)' }}>
                {a.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{a.desc}</div>
            </div>
          ))}
        </div>

        {/* Cuenta destino (si es transferencia) */}
        {esTransf && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>🏦 Cuenta destino</label>
            {otrasCtas.length === 0 ? (
              <div style={{
                padding: '10px 13px', background: '#fffbeb',
                border: '1.5px solid #fde68a', borderRadius: 10,
                fontSize: 12, color: '#92400e',
              }}>
                No hay otras cuentas registradas para transferir.
              </div>
            ) : (
              <select value={cuentaDestino} onChange={e => setCuentaDestino(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar cuenta destino...</option>
                {otrasCtas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {fmt(c.saldo_actual, c.moneda)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Monto */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>
            {accion === 'ajuste'     ? '📊 Nuevo saldo total' :
             accion === 'quincena'   ? '💼 Monto de la quincena' :
             accion === 'pago'       ? '💸 Monto del pago' :
             accion === 'transferencia' ? '↔ Monto a transferir' :
             accion === 'deposito'   ? '💰 Monto a depositar' :
                                       '💰 Monto a retirar'}
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'Nunito', fontWeight: 900, fontSize: 15,
              color: accionSel.color,
            }}>{simbolo}</span>
            <input
              type="number" inputMode="decimal"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"              
              style={{
                ...inputStyle,
                paddingLeft: 50, fontSize: 20, fontWeight: 800,
                color: accionSel.color,
              }}
            />
          </div>
        </div>

        {/* Preview nuevo saldo */}
        {nuevoEstado && (
          <div style={{
            background: `${accionSel.color}10`,
            border: `1.5px solid ${accionSel.color}30`,
            borderRadius: 12, padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
              Resultado
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {'saldo_actual' in nuevoEstado && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {esTransf ? 'Nuevo saldo origen' : 'Nuevo saldo'}
                  </div>
                  <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 16, color: accionSel.color }}>
                    {fmt(nuevoEstado.saldo_actual, cuenta.moneda)}
                  </div>
                </div>
              )}
              {esTransf && cuentaDestino && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Saldo destino</div>
                  <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 16, color: '#16a34a' }}>
                    {fmt(
                      Number((otrasCtas.find(c => c.id === cuentaDestino)?.saldo_actual || 0)) + montoN,
                      cuenta.moneda
                    )}
                  </div>
                </div>
              )}
              {cuenta.tipo === 'credito_entidad' && 'deuda_actual' in nuevoEstado && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Nueva deuda</div>
                  <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 16, color: '#ef4444' }}>
                    {fmt(nuevoEstado.deuda_actual, cuenta.moneda)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fecha + descripción */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lbl}>📅 Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>📝 Descripción</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder={
                accion === 'quincena'    ? 'Ej: Quincena diciembre...' :
                accion === 'transferencia'? 'Ej: Para gastos del mes...' :
                accion === 'deposito'    ? 'Ej: Depósito sueldo...' :
                accion === 'pago'        ? 'Ej: Pago cuota hipoteca...' :
                                           'Ej: Retiro cajero ATM...'
              }
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 11, background: 'var(--bg)',
            border: '1.5px solid var(--border)', borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            color: 'var(--text2)', fontFamily: 'Poppins',
          }}>Cancelar</button>
          <button onClick={registrar} disabled={loading} style={{
            flex: 2, padding: 11, border: 'none', borderRadius: 10,
            background: loading ? '#d1d5db' : accionSel.color,
            color: 'white', fontFamily: 'Poppins', fontWeight: 700,
            fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}>
            {loading ? 'Registrando...' : `${accionSel.e} Confirmar ${accionSel.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
