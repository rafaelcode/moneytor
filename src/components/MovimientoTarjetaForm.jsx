import { useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (monto, moneda = 'PEN') =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(monto ?? 0)

// Acciones disponibles según tipo de tarjeta
const ACCIONES_DEBITO = [
  { v: 'deposito', e: '↑', label: 'Depósito',  color: '#16a34a', desc: 'Ingresar dinero' },
  { v: 'retiro',   e: '↓', label: 'Retiro',    color: '#dc2626', desc: 'Retirar dinero'  },
  { v: 'ajuste',   e: '⟳', label: 'Ajuste',    color: '#d97706', desc: 'Corregir saldo'  },
]

const ACCIONES_CREDITO = [
  { v: 'pago',      e: '✅', label: 'Pago',         color: '#16a34a', desc: 'Abonar a la deuda'  },
  { v: 'cargo',     e: '💸', label: 'Cargo/Compra',  color: '#dc2626', desc: 'Registrar un gasto' },
  { v: 'ajuste',    e: '⟳', label: 'Ajuste saldo',  color: '#d97706', desc: 'Corregir manualmente'},
]

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100, padding: 20,
}
const modal = {
  background: 'white', borderRadius: 20,
  border: '1.5px solid var(--border)',
  padding: '26px', width: '100%', maxWidth: 400,
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

export default function MovimientoTarjetaForm({ usuarioId, tarjeta, onClose, onGuardado }) {
  const hoy       = new Date().toISOString().split('T')[0]
  const isCredito = tarjeta.tipo === 'credito'
  const ACCIONES  = isCredito ? ACCIONES_CREDITO : ACCIONES_DEBITO

  const [accion,      setAccion]      = useState(isCredito ? 'pago' : 'deposito')
  const [monto,       setMonto]       = useState('')
  const [fecha,       setFecha]       = useState(hoy)
  const [descripcion, setDescripcion] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const accionSel = ACCIONES.find(a => a.v === accion)
  const montoN    = Number(monto || 0)

  // Calcular nuevo estado de la tarjeta según acción
  const calcNuevoEstado = () => {
    const saldo  = Number(tarjeta.saldo_actual  || 0)
    const deuda  = Number(tarjeta.deuda_actual  || 0)
    const limite = Number(tarjeta.limite_credito || 0)

    if (accion === 'ajuste') {
      return isCredito
        ? { saldo_actual: montoN, deuda_actual: deuda }
        : { saldo_actual: montoN }
    }

    if (!isCredito) {
      // Débito
      if (accion === 'deposito') return { saldo_actual: saldo + montoN }
      if (accion === 'retiro')   return { saldo_actual: Math.max(0, saldo - montoN) }
    } else {
      // Crédito
      if (accion === 'pago') {
        const nuevaDeuda  = Math.max(0, deuda - montoN)
        const nuevoSaldo  = limite > 0 ? limite - nuevaDeuda : saldo + montoN
        return { deuda_actual: nuevaDeuda, saldo_actual: nuevoSaldo }
      }
      if (accion === 'cargo') {
        const nuevaDeuda  = deuda + montoN
        const nuevoSaldo  = Math.max(0, saldo - montoN)
        return { deuda_actual: nuevaDeuda, saldo_actual: nuevoSaldo }
      }
    }
    return {}
  }

  const nuevoEstado = monto !== '' && !isNaN(monto) ? calcNuevoEstado() : null

  async function registrar() {
    setError('')
    if (!monto || isNaN(monto) || Number(monto) < 0)
      return setError('Ingresa un monto válido.')

    if (!isCredito && accion === 'retiro' && montoN > Number(tarjeta.saldo_actual))
      return setError(`Saldo insuficiente. Disponible: ${fmt(tarjeta.saldo_actual, tarjeta.moneda)}`)

    if (isCredito && accion === 'pago' && montoN > Number(tarjeta.deuda_actual))
      return setError(`El pago supera la deuda actual de ${fmt(tarjeta.deuda_actual, tarjeta.moneda)}`)

    setLoading(true)

    try {
      // 1. Registrar movimiento en historial
      const { error: e1 } = await supabase.from('movimientos_tarjeta').insert({
        tarjeta_id:  tarjeta.id,
        usuario_id:  usuarioId,
        tipo:        accion,
        monto:       montoN,
        descripcion: descripcion.trim() || null,
        fecha,
      })
      if (e1) throw e1

      // 2. Actualizar saldos de la tarjeta
      const { error: e2 } = await supabase.from('tarjetas_credito').update({
        ...nuevoEstado,
        actualizado_en: new Date().toISOString(),
      }).eq('id', tarjeta.id)
      if (e2) throw e2

      onGuardado()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Error al registrar. Verifica que la tabla movimientos_tarjeta exista.')
    } finally {
      setLoading(false)
    }
  }

  const simbolo = tarjeta.moneda === 'USD' ? 'US$' : tarjeta.moneda === 'EUR' ? '€' : 'S/.'

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 17 }}>
              {isCredito ? '💳' : '🏦'} {tarjeta.nombre_banco}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              {isCredito
                ? <>Deuda: <strong style={{ color: '#ef4444' }}>{fmt(tarjeta.deuda_actual, tarjeta.moneda)}</strong> · Saldo: <strong style={{ color: '#16a34a' }}>{fmt(tarjeta.saldo_actual, tarjeta.moneda)}</strong></>
                : <>Saldo: <strong style={{ color: tarjeta.color || '#2563eb' }}>{fmt(tarjeta.saldo_actual, tarjeta.moneda)}</strong></>
              }
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
          gridTemplateColumns: `repeat(${ACCIONES.length}, 1fr)`,
          gap: 8, marginBottom: 18,
        }}>
          {ACCIONES.map(a => (
            <div key={a.v} onClick={() => { setAccion(a.v); setMonto('') }} style={{
              padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
              border: `1.5px solid ${accion === a.v ? a.color : 'var(--border)'}`,
              background: accion === a.v ? `${a.color}12` : 'var(--bg)',
              transition: 'all 0.12s',
            }}>
              <div style={{ fontSize: 18, fontFamily: 'Nunito', fontWeight: 900, color: a.color }}>{a.e}</div>
              <div style={{ fontSize: 12, fontWeight: accion === a.v ? 700 : 500, color: accion === a.v ? a.color : 'var(--text2)' }}>
                {a.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{a.desc}</div>
            </div>
          ))}
        </div>

        {/* Monto */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>
            {accion === 'ajuste' && !isCredito ? '📊 Nuevo saldo total' :
             accion === 'ajuste' && isCredito  ? '📊 Nuevo saldo disponible' :
             accion === 'pago'                 ? '💰 Monto del pago' :
             accion === 'cargo'                ? '💸 Monto del cargo/compra' :
             accion === 'deposito'             ? '💰 Monto a depositar' :
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
              min="0" step="0.01"
              style={{
                ...inputStyle,
                paddingLeft: 52, fontSize: 20, fontWeight: 800,
                color: accionSel.color,
              }}
            />
          </div>
        </div>

        {/* Preview nuevo estado */}
        {nuevoEstado && monto !== '' && !isNaN(monto) && (
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
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Nuevo saldo</div>
                  <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 16, color: '#16a34a' }}>
                    {fmt(nuevoEstado.saldo_actual, tarjeta.moneda)}
                  </div>
                </div>
              )}
              {isCredito && 'deuda_actual' in nuevoEstado && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Nueva deuda</div>
                  <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 16, color: '#ef4444' }}>
                    {fmt(nuevoEstado.deuda_actual, tarjeta.moneda)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fecha + Descripción */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, marginBottom: 14 }}>
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
                accion === 'pago'    ? 'Ej: Pago mínimo, pago total...' :
                accion === 'cargo'   ? 'Ej: Supermercado, gasolina...' :
                accion === 'deposito'? 'Ej: Depósito sueldo...' :
                                       'Ej: Retiro ATM...'
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

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
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
