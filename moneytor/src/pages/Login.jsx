import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo]         = useState('login')   // 'login' | 'registro'
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [mensaje, setMensaje]   = useState('')

  async function handleSubmit() {
    setError('')
    setMensaje('')
    setLoading(true)

    if (!email || !password) {
      setError('Por favor completa el email y la contraseña.')
      setLoading(false)
      return
    }

    if (modo === 'registro') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMensaje('✅ Cuenta creada. Revisa tu email para confirmar, luego inicia sesión.')
        setModo('login')
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Email o contraseña incorrectos.')
      } else {
        onLogin(data.user)
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'white', borderRadius: 20,
        border: '1.5px solid var(--border)',
        padding: '40px 36px', width: '100%', maxWidth: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #6c63ff, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 12px',
            boxShadow: '0 4px 16px rgba(108,99,255,0.35)',
          }}>📊</div>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 26 }}>
            Money<span style={{ color: '#6c63ff' }}>Tor</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
            Tu dinero, fácil de entender
          </div>
        </div>

        {/* Tabs login/registro */}
        <div style={{
          display: 'flex', background: 'var(--bg)',
          borderRadius: 10, padding: 3,
          border: '1.5px solid var(--border)', marginBottom: 24,
        }}>
          {['login', 'registro'].map(m => (
            <div
              key={m}
              onClick={() => { setModo(m); setError(''); setMensaje('') }}
              style={{
                flex: 1, textAlign: 'center', padding: '8px',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: modo === m ? 'white' : 'transparent',
                color: modo === m ? 'var(--text)' : 'var(--text3)',
                boxShadow: modo === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? '🔑 Ingresar' : '✨ Registrarme'}
            </div>
          ))}
        </div>

        {/* Campos */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
            📧 Email
          </label>
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
            🔒 Contraseña
          </label>
          <input
            type="password"
            placeholder="mínimo 6 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
          />
        </div>

        {/* Errores y mensajes */}
        {error   && <div style={alertStyle('#fef2f2','#fecaca','#991b1b')}>⚠️ {error}</div>}
        {mensaje && <div style={alertStyle('#f0fdf4','#bbf7d0','#166534')}>✅ {mensaje}</div>}

        {/* Botón */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '12px',
            background: loading ? '#a5b4fc' : '#6c63ff',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Poppins',
            boxShadow: '0 3px 12px rgba(108,99,255,0.35)',
            transition: 'all 0.15s',
          }}
        >
          {loading ? '...' : modo === 'login' ? '🚀 Entrar a MoneyTor' : '✨ Crear mi cuenta'}
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg)', border: '1.5px solid var(--border)',
  borderRadius: 10, fontSize: 13, color: 'var(--text)',
  fontFamily: 'Poppins', outline: 'none',
  boxSizing: 'border-box',
}

function alertStyle(bg, border, color) {
  return {
    background: bg, border: `1.5px solid ${border}`, color,
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, fontWeight: 500, marginBottom: 14,
  }
}
