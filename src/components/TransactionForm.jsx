import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIAS = {
  ingreso: [
    { valor: 'sueldo',      emoji: '🏢', label: 'Sueldo / Trabajo fijo' },
    { valor: 'freelance',   emoji: '💻', label: 'Trabajo extra / Freelance' },
    { valor: 'bono',        emoji: '🎁', label: 'Bono o comisión' },
    { valor: 'alquiler',    emoji: '🏠', label: 'Alquiler de propiedad' },
    { valor: 'dividendos',  emoji: '💹', label: 'Dividendos / Intereses' },
    { valor: 'otro_ingreso',emoji: '➕', label: 'Otro ingreso' },
  ],
  gasto: [
    { valor: 'casa',        emoji: '🏘️', label: 'Casa (alquiler, luz, agua)' },
    { valor: 'comida',      emoji: '🍔', label: 'Comida y mercado' },
    { valor: 'transporte',  emoji: '🚗', label: 'Transporte' },
    { valor: 'salud',       emoji: '💊', label: 'Salud' },
    { valor: 'educacion',   emoji: '📚', label: 'Educación' },
    { valor: 'ropa',        emoji: '👗', label: 'Ropa y personal' },
    { valor: 'ocio',        emoji: '🎮', label: 'Diversión y ocio' },
    { valor: 'suscripciones',emoji:'📱', label: 'Suscripciones' },
    { valor: 'seguros',     emoji: '🛡️', label: 'Seguros' },
    { valor: 'imprevisto',  emoji: '⚡', label: 'Imprevisto' },
    { valor: 'otro_gasto',  emoji: '➕', label: 'Otro gasto' },
  ],
}

export default function TransactionForm({ onClose, onGuardado, usuarioId }) {
  const hoy = new Date().toISOString().split('T')[0]

  const [tipo,        setTipo]        = useState('gasto')
  const [monto,       setMonto]       = useState('')
  const [categoria,   setCategoria]   = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha,       setFecha]       = useState(hoy)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const color = tipo === 'ingreso' ? '#22c55e' : '#f97316'

  async function guardar() {
    setError('')

    if (!monto || isNaN(monto) || Number(monto) <= 0) {
      setError('Ingresa un monto válido mayor a 0.')
      return
    }
    if (!categoria) {
      setError('Selecciona una categoría.')
      return
    }
    if (!fecha) {
      setError('Selecciona una fecha.')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('transacciones').insert({
      usuario_id:  usuarioId,
      tipo,
      monto:       Number(monto),
      categoria,
      descripcion: descripcion.trim(),
      fecha,
    })

    if (error) {
      setError('No se pudo guardar. Intenta de nuevo.')
      console.error(error)
    } else {
      onGuardado()  // avisa al padre que se guardó → recarga la lista
      onClose()
    }
    setLoading(false)
  }

  return (
    /* Fondo oscuro */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 20,
          border: '1.5px solid var(--border)',
          padding: '28px 28px 24px',
          width: '100%', maxWidth: 440,
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
          animation: 'popIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18 }}>
              {tipo === 'ingreso' ? '💵 Registrar ingreso' : '💸 Registrar gasto'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              Completa los datos abajo
            </div>
          </div>
          <div
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bg)', border: '1.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, color: 'var(--text3)',
            }}
          >×</div>
        </div>

        {/* Toggle ingreso / gasto */}
        <div style={{
          display: 'flex', background: 'var(--bg)',
          borderRadius: 12, padding: 4,
          border: '1.5px solid var(--border)', marginBottom: 20,
        }}>
          {['gasto', 'ingreso'].map(t => (
            <div
              key={t}
              onClick={() => { setTipo(t); setCategoria('') }}
              style={{
                flex: 1, textAlign: 'center', padding: '9px',
                borderRadius: 9, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                background: tipo === t ? (t === 'ingreso' ? '#22c55e' : '#f97316') : 'transparent',
                color: tipo === t ? 'white' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              {t === 'ingreso' ? '📥 Dinero que entró' : '📤 Dinero que salió'}
            </div>
          ))}
        </div>

        {/* Monto */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>💰 ¿Cuánto?</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'Nunito', fontWeight: 900, fontSize: 16, color,
            }}>S/.</span>
            <input
              type="number"
              placeholder="0.00"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              min="0"
              step="0.01"
              style={{ ...inputStyle, paddingLeft: 46, fontSize: 18, fontWeight: 700, color }}
            />
          </div>
        </div>

        {/* Categoría */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>📂 ¿En qué categoría?</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 7,
          }}>
            {CATEGORIAS[tipo].map(cat => (
              <div
                key={cat.valor}
                onClick={() => setCategoria(cat.valor)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${categoria === cat.valor ? color : 'var(--border)'}`,
                  background: categoria === cat.valor ? `${color}15` : 'var(--bg)',
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: categoria === cat.valor ? 700 : 500,
                  color: categoria === cat.valor ? color : 'var(--text2)',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 15 }}>{cat.emoji}</span>
                {cat.label}
              </div>
            ))}
          </div>
        </div>

        {/* Fecha */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>📅 ¿Cuándo fue?</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Descripción */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>📝 Descripción (opcional)</label>
          <input
            type="text"
            placeholder="Ej: Supermercado Wong, Freelance cliente ABC..."
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            maxLength={120}
            style={inputStyle}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca',
            color: '#991b1b', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, marginBottom: 14,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px',
              background: 'var(--bg)', border: '1.5px solid var(--border)',
              borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', color: 'var(--text2)', fontFamily: 'Poppins',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={loading}
            style={{
              flex: 2, padding: '11px',
              background: loading ? '#d1d5db' : color,
              border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'white', fontFamily: 'Poppins',
              boxShadow: loading ? 'none' : `0 3px 12px ${color}44`,
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Guardando...' : tipo === 'ingreso' ? '💵 Guardar ingreso' : '💸 Guardar gasto'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

const labelStyle = {
  fontSize: 12, fontWeight: 700,
  color: 'var(--text2)', display: 'block', marginBottom: 8,
}

const inputStyle = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg)', border: '1.5px solid var(--border)',
  borderRadius: 10, fontSize: 13, color: 'var(--text)',
  fontFamily: 'Poppins', outline: 'none', boxSizing: 'border-box',
}
