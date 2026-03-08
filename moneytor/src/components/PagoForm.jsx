import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, TIPO_MAP } from '../lib/deudasUtils'
import { labelStyle, inputStyle } from './DeudaForm'

export default function PagoForm({ usuarioId, deuda, onClose, onGuardado }) {
  const hoy = new Date().toISOString().split('T')[0]
  const tipo = TIPO_MAP[deuda.tipo] || { emoji: '💳', color: '#ef4444' }

  const [monto,   setMonto]   = useState(deuda.monto_cuota || '')
  const [fecha,   setFecha]   = useState(hoy)
  const [notas,   setNotas]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function registrarPago() {
    setError('')
    if (!monto || Number(monto) <= 0) return setError('Ingresa un monto válido.')
    if (Number(monto) > Number(deuda.monto_pendiente))
      return setError(`El pago no puede superar el pendiente (${fmt(deuda.monto_pendiente)}).`)

    setLoading(true)
    const nuevoPendiente = Number(deuda.monto_pendiente) - Number(monto)
    const nuevasCuotasPagadas = deuda.es_en_cuotas
      ? (deuda.cuotas_pagadas || 0) + 1
      : deuda.cuotas_pagadas

    // 1. Registrar el pago en historial
    const { error: e1 } = await supabase.from('pagos_deuda').insert({
      deuda_id:   deuda.id,
      usuario_id: usuarioId,
      monto:      Number(monto),
      fecha,
      notas: notas.trim() || null,
    })

    // 2. Actualizar el pendiente en la deuda
    const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
    const { error: e2 } = await supabase.from('deudas').update({
      monto_pendiente:  Math.max(0, nuevoPendiente),
      cuotas_pagadas:   nuevasCuotasPagadas,
      estado:           nuevoEstado,
      actualizado_en:   new Date().toISOString(),
    }).eq('id', deuda.id)

    if (e1 || e2) {
      setError('Error al registrar el pago. Intenta de nuevo.')
      console.error(e1 || e2)
    } else {
      onGuardado()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 400,
        border: '1.5px solid var(--border)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18 }}>
            {tipo.emoji} Registrar pago
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
            {deuda.nombre} — Pendiente: <strong style={{ color: tipo.color }}>{fmt(deuda.monto_pendiente)}</strong>
          </div>
        </div>

        {/* Monto */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>💰 ¿Cuánto pagaste?</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'Nunito', fontWeight: 900, fontSize: 14, color: tipo.color,
            }}>S/.</span>
            <input type="number" value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              style={{ ...inputStyle, paddingLeft: 44, fontSize: 18, fontWeight: 700, color: tipo.color }} />
          </div>
          {deuda.monto_cuota && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, fontWeight: 500 }}>
              💡 Cuota sugerida: {fmt(deuda.monto_cuota)}
              <span onClick={() => setMonto(deuda.monto_cuota)}
                style={{ color: tipo.color, cursor: 'pointer', marginLeft: 8, fontWeight: 700 }}>
                Usar este monto →
              </span>
            </div>
          )}
        </div>

        {/* Fecha */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>📅 Fecha del pago</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
        </div>

        {/* Notas */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>📝 Notas (opcional)</label>
          <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej: Pago por transferencia, Nro. operación..." style={inputStyle} />
        </div>

        {/* Resumen del resultado */}
        {monto > 0 && (
          <div style={{
            background: `${tipo.color}10`, border: `1.5px solid ${tipo.color}30`,
            borderRadius: 12, padding: '12px 14px', marginBottom: 16,
            fontSize: 13, fontWeight: 600,
          }}>
            Después de este pago quedará: <strong style={{ color: tipo.color }}>
              {fmt(Math.max(0, Number(deuda.monto_pendiente) - Number(monto)))}
            </strong>
            {Number(monto) >= Number(deuda.monto_pendiente) &&
              <span style={{ color: '#16a34a', marginLeft: 8 }}>🎉 ¡Deuda saldada!</span>}
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14,
          }}>⚠️ {error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 11, background: 'var(--bg)',
            border: '1.5px solid var(--border)', borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text2)', fontFamily: 'Poppins',
          }}>Cancelar</button>
          <button onClick={registrarPago} disabled={loading} style={{
            flex: 2, padding: 11, background: loading ? '#d1d5db' : tipo.color,
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', color: 'white', fontFamily: 'Poppins',
          }}>
            {loading ? 'Registrando...' : '✅ Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
