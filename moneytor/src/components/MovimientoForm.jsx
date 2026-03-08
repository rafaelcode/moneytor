import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, TIPO_MAP } from '../lib/reservasUtils'

export default function MovimientoForm({ usuarioId, reserva, onClose, onGuardado }) {
  const hoy  = new Date().toISOString().split('T')[0]
  const tipo = TIPO_MAP[reserva.tipo] || { emoji: '🏦', color: '#2563eb' }

  const [accion,      setAccion]      = useState('deposito')
  const [monto,       setMonto]       = useState('')
  const [fecha,       setFecha]       = useState(hoy)
  const [descripcion, setDescripcion] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const ACCIONES = [
    { v: 'deposito', e: '↑', label: 'Depósito',  color: '#16a34a', desc: 'Agregar dinero' },
    { v: 'retiro',   e: '↓', label: 'Retiro',    color: '#dc2626', desc: 'Sacar dinero'  },
    { v: 'ajuste',   e: '⟳', label: 'Ajuste',    color: '#d97706', desc: 'Corregir saldo' },
  ]
  const accionSel = ACCIONES.find(a => a.v === accion)

  // Para ajuste calculamos el nuevo saldo directamente
  const nuevoSaldo = accion === 'ajuste'
    ? Number(monto || 0)
    : accion === 'deposito'
      ? Number(reserva.saldo_actual) + Number(monto || 0)
      : Math.max(0, Number(reserva.saldo_actual) - Number(monto || 0))

  async function registrar() {
    setError('')
    if (!monto || isNaN(monto) || Number(monto) < 0)
      return setError('Ingresa un monto válido.')
    if (accion === 'retiro' && Number(monto) > Number(reserva.saldo_actual))
      return setError(`No puedes retirar más del saldo disponible (${fmt(reserva.saldo_actual, reserva.moneda)}).`)

    setLoading(true)

    // 1. Registrar movimiento en historial
    const montoReal = accion === 'ajuste'
      ? Number(monto) - Number(reserva.saldo_actual)  // diferencia
      : Number(monto)

    const { error: e1 } = await supabase.from('movimientos_reserva').insert({
      reserva_id:  reserva.id,
      usuario_id:  usuarioId,
      tipo:        accion,
      monto:       Math.abs(montoReal),
      descripcion: descripcion.trim() || null,
      fecha,
    })

    // 2. Actualizar saldo en la reserva
    const { error: e2 } = await supabase.from('reservas').update({
      saldo_actual:   nuevoSaldo,
      actualizado_en: new Date().toISOString(),
    }).eq('id', reserva.id)

    if (e1 || e2) {
      setError('Error al registrar. Intenta de nuevo.')
      console.error(e1 || e2)
    } else {
      onGuardado()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modal}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:17 }}>
              {tipo.emoji} {reserva.nombre}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Saldo actual: <strong style={{ color: tipo.color }}>{fmt(reserva.saldo_actual, reserva.moneda)}</strong>
            </div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        {/* Tipo de acción */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
          {ACCIONES.map(a => (
            <div key={a.v} onClick={() => { setAccion(a.v); setMonto('') }} style={{
              padding:'10px 8px', borderRadius:10, cursor:'pointer', textAlign:'center',
              border:`1.5px solid ${accion===a.v ? a.color : 'var(--border)'}`,
              background: accion===a.v ? `${a.color}12` : 'var(--bg)',
              transition:'all 0.12s',
            }}>
              <div style={{ fontSize:18, fontFamily:'Nunito', fontWeight:900, color:a.color }}>{a.e}</div>
              <div style={{ fontSize:12, fontWeight: accion===a.v ? 700 : 500, color: accion===a.v ? a.color : 'var(--text2)' }}>
                {a.label}
              </div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>{a.desc}</div>
            </div>
          ))}
        </div>

        {/* Monto */}
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>
            {accion === 'ajuste' ? '📊 Nuevo saldo total' : `💰 Monto a ${accion === 'deposito' ? 'depositar' : 'retirar'}`}
          </label>
          <div style={{ position:'relative' }}>
            <span style={{
              position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
              fontFamily:'Nunito', fontWeight:900, fontSize:15,
              color: accionSel.color,
            }}>
              {reserva.moneda === 'USD' ? 'US$' : reserva.moneda === 'EUR' ? '€' : 'S/.'}
            </span>
            <input
              type="number" value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder={accion === 'ajuste' ? fmt(reserva.saldo_actual, reserva.moneda).replace(/[^\d.]/g,'') : '0.00'}
              min="0" step="0.01"
              style={{
                ...inputStyle,
                paddingLeft:50, fontSize:20, fontWeight:800,
                color: accionSel.color,
              }}
            />
          </div>
        </div>

        {/* Resultado visual */}
        {monto !== '' && !isNaN(monto) && (
          <div style={{
            background: `${accionSel.color}10`,
            border:`1.5px solid ${accionSel.color}30`,
            borderRadius:12, padding:'12px 14px', marginBottom:14,
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>Nuevo saldo:</span>
            <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color: accionSel.color }}>
              {fmt(nuevoSaldo, reserva.moneda)}
            </span>
          </div>
        )}

        {/* Fecha + descripción */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:10, marginBottom:14 }}>
          <div>
            <label style={lbl}>📅 Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>📝 Descripción (opcional)</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Depósito sueldo, Retiro gastos..." style={inputStyle} />
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button onClick={onClose} style={btnCancel}>Cancelar</button>
          <button onClick={registrar} disabled={loading} style={{
            flex:2, padding:11, border:'none', borderRadius:10,
            background: loading ? '#d1d5db' : accionSel.color,
            color:'white', fontFamily:'Poppins', fontWeight:700,
            fontSize:13, cursor: loading ? 'not-allowed':'pointer',
            transition:'all 0.15s',
          }}>
            {loading ? 'Registrando...' : `${accionSel.e} Confirmar ${accionSel.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay   = { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:20 }
const modal     = { background:'white', borderRadius:20, border:'1.5px solid var(--border)', padding:'26px', width:'100%', maxWidth:400, boxShadow:'0 16px 48px rgba(0,0,0,0.15)' }
const closeBtn  = { width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'var(--text3)' }
const lbl       = { fontSize:12, fontWeight:700, color:'var(--text2)', display:'block', marginBottom:7 }
const inputStyle= { width:'100%', padding:'10px 13px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text)', fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }
const errorStyle= { background:'#fef2f2', border:'1.5px solid #fecaca', color:'#991b1b', borderRadius:10, padding:'10px 14px', fontSize:13, marginBottom:12 }
const btnCancel = { flex:1, padding:11, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
