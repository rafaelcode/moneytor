import { useState, useEffect } from 'react'
import { supabase }        from './lib/supabase'
import Sidebar             from './components/Sidebar'
import Topbar              from './components/Topbar'
import Login               from './pages/Login'
import Dashboard           from './pages/Dashboard'
import QuincenaResumen     from './pages/QuincenaResumen'
import Ingresos            from './pages/Ingresos'
import Gastos              from './pages/Gastos'
import FlujoCaja           from './pages/FlujoCajaPage'
import Movimientos         from './pages/Movimientos'
import Deudas              from './pages/Deudas'
import Prestamos           from './pages/Prestamos'
import Reservas            from './pages/Reservas'
import AhorroProgramado    from './pages/AhorroProgramado'
import Propiedades         from './pages/Propiedades'
import Presupuesto         from './pages/Presupuesto'
import Inversiones         from './pages/Inversiones'
import Tarjetas            from './pages/Tarjetas'
import Cuentas             from './pages/Cuentas'
import Efectivo            from './pages/Efectivo'
import TransactionForm     from './components/TransactionForm'

/* ── Bottom nav (5 más usados) ───────────────────────────── */
const BOTTOM_NAV = [
  { id: 'dashboard',        emoji: '🏠', label: 'Inicio'     },
  { id: 'quincena_resumen', emoji: '📅', label: 'Quincena'   },
  { id: 'gastos',           emoji: '↓',  label: 'Gastos'     },
  { id: 'deudas',           emoji: '💳', label: 'Deudas'     },
  { id: 'presupuesto',      emoji: '📋', label: 'Presupuesto'},
]

/* ── Placeholder para páginas en construcción ────────────── */
function Pronto({ titulo, emoji, color, descripcion }) {
  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{
        background: 'white', borderRadius: 18,
        border: '1.5px solid var(--border)',
        padding: '48px 24px', textAlign: 'center',
        maxWidth: 440, margin: '0 auto',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16, margin: '0 auto 14px',
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>{emoji}</div>
        <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{titulo}</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 18 }}>{descripcion}</div>
        <div style={{
          display: 'inline-block',
          background: `${color}15`, color,
          border: `1.5px solid ${color}40`,
          borderRadius: 20, padding: '5px 16px',
          fontSize: 12, fontWeight: 700,
        }}>🔨 En construcción</div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   APP PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function App() {
  const [usuario,     setUsuario]     = useState(null)
  const [cargando,    setCargando]    = useState(true)
  const [page,        setPage]        = useState('dashboard')
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [tipoForm,    setTipoForm]    = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null)
      setCargando(false)
    })
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setUsuario(s?.user ?? null))
    return () => l.subscription.unsubscribe()
  }, [])

  function navegar(id) {
    setPage(id)
    setDrawerOpen(false)
    setTimeout(() => {
      document.querySelector('.shell-content')?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUsuario(null); setPage('dashboard')
  }

  function abrirForm(tipo = null) { setTipoForm(tipo); setMostrarForm(true) }
  function cerrarForm()           { setMostrarForm(false); setTipoForm(null) }

  /* ── Loading ── */
  if (cargando) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 42, marginBottom: 10 }}>📊</div>
        <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 22, color: 'var(--text)' }}>
          Money<span style={{ color: 'var(--primary-blue)' }}>Tor</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!usuario) return <Login onLogin={setUsuario} />

  /* ── Mapa de páginas ─────────────────────────────────────
     Estructura según reorganización del menú:
     🟥 INICIO
     🟦 FLUJO DE DINERO
     🟩 OBLIGACIONES
     🟪 RELACIONES FINANCIERAS
     🟧 PATRIMONIO
     🟫 PLANIFICACIÓN
     ⬛ ANÁLISIS
  ────────────────────────────────────────────────────────── */
  const pages = {

    // ── 🟥 INICIO ──────────────────────────────────────────
    dashboard:          <Dashboard        usuarioId={usuario.id} onNavigate={navegar} onRegistrar={abrirForm} />,

    // ── 🟦 FLUJO DE DINERO ─────────────────────────────────
    quincena_resumen:   <QuincenaResumen  usuarioId={usuario.id} />,
    ingresos:           <Ingresos         usuarioId={usuario.id} />,
    gastos:             <Gastos           usuarioId={usuario.id} />,
    flujo_caja:         <FlujoCaja        usuarioId={usuario.id} />,
    movimientos:        <Movimientos      usuarioId={usuario.id} />,

    // ── 🟩 OBLIGACIONES ────────────────────────────────────
    deudas:             <Deudas           usuarioId={usuario.id} />,
    prestamos:          <Prestamos        usuarioId={usuario.id} />,

    // ── 🟪 RELACIONES FINANCIERAS ──────────────────────────
    efectivo:           <Efectivo         usuarioId={usuario.id} />,
    tarjetas:           <Tarjetas         usuarioId={usuario.id} />,
    cuentas:            <Cuentas          usuarioId={usuario.id} />,

    // ── 🟧 PATRIMONIO ──────────────────────────────────────
    reservas:           <Reservas         usuarioId={usuario.id} />,
    ahorro_programado:  <AhorroProgramado usuarioId={usuario.id} />,
    inversiones:        <Inversiones      usuarioId={usuario.id} />,
    propiedades:        <Propiedades      usuarioId={usuario.id} />,

    // ── 🟫 PLANIFICACIÓN ───────────────────────────────────
    presupuesto:        <Presupuesto      usuarioId={usuario.id} />,
    metas:              <Pronto emoji="🎯" color="#2563eb"  titulo="Metas de ahorro"     descripcion="Define objetivos financieros y rastrea tu progreso hacia ellos." />,
    calendario:         <Pronto emoji="🗓️" color="#16a34a" titulo="Calendario de pagos" descripcion="Visualiza todos tus vencimientos y fechas importantes del mes." />,

    // ── ⬛ ANÁLISIS ────────────────────────────────────────
    reportes:           <Pronto emoji="📉" color="#64748b" titulo="Reportes"       descripcion="Evolución patrimonial, gráficos históricos y exportación de datos." />,
    configuracion:      <Pronto emoji="⚙️" color="#2563eb" titulo="Configuración"  descripcion="Personaliza categorías, monedas y parámetros del sistema." />,
  }

  return (
    <div className="shell">

      {/* ── Sidebar ── */}
      <Sidebar
        currentPage={page}
        onNavigate={navegar}
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
      />

      {/* ── Contenido ── */}
      <div className="shell-right">
        <Topbar
          currentPage={page}
          onRegistrar={() => abrirForm()}
          onCerrarSesion={cerrarSesion}
          email={usuario.email}
          onMenuOpen={() => setDrawerOpen(true)}
        />
        <main className="shell-content">
          {pages[page] || pages.dashboard}
        </main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.map(item => {
          const activo = page === item.id
          return (
            <button
              key={item.id}
              className={`bnav-item ${activo ? 'active' : ''}`}
              onClick={() => navegar(item.id)}
            >
              <span className="bnav-emoji">{item.emoji}</span>
              <span className="bnav-label" style={{ color: activo ? 'var(--primary-blue)' : 'var(--text3)' }}>
                {item.label}
              </span>
              {activo && (
                <div style={{
                  position: 'absolute', bottom: 6,
                  width: 4, height: 4, borderRadius: '50%',
                  background: 'var(--primary-blue)',
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* ── FAB ── */}
      <button className="fab" onClick={() => abrirForm()} aria-label="Registrar movimiento">+</button>

      {/* ── Modal global ── */}
      {mostrarForm && (
        <TransactionForm
          usuarioId={usuario.id}
          tipoInicial={tipoForm}
          onClose={cerrarForm}
          onGuardado={cerrarForm}
        />
      )}
    </div>
  )
}
