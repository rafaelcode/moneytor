import { useState, useEffect } from 'react'
import { supabase }        from './lib/supabase'
import Sidebar             from './components/Sidebar'
import Topbar              from './components/Topbar'
import Login               from './pages/Login'
import Dashboard           from './pages/Dashboard'
import FlujoDashboard      from './pages/FlujoDashboard'
import QuincenaResumen     from './pages/QuincenaResumen'
import Ingresos            from './pages/Ingresos'
import Gastos              from './pages/Gastos'
import FlujoCaja           from './pages/FlujoCajaPage'
import Movimientos         from './pages/Movimientos'
import Deudas              from './pages/Deudas'
import Reservas            from './pages/Reservas'
import AhorroProgramado    from './pages/AhorroProgramado'
import Propiedades         from './pages/Propiedades'
import Presupuesto         from './pages/Presupuesto'
import Inversiones         from './pages/Inversiones'
import TransactionForm     from './components/TransactionForm'

/* ── Bottom nav items (los 5 más usados) ─────────────── */
const BOTTOM_NAV = [
  { id:'dashboard',        emoji:'🏠', label:'Inicio' },
  { id:'quincena_resumen', emoji:'📅', label:'Quincena' },
  { id:'gastos',           emoji:'↓',  label:'Gastos' },
  { id:'deudas',           emoji:'💳', label:'Deudas' },
  { id:'presupuesto',      emoji:'📋', label:'Presupuesto' },
]

/* ── Placeholder páginas en construcción ─────────────── */
function Pronto({ titulo, emoji, color, descripcion }) {
  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ background:'white', borderRadius:18, border:'1.5px solid var(--border)', padding:'48px 24px', textAlign:'center', maxWidth:440, margin:'0 auto' }}>
        <div style={{ width:60, height:60, borderRadius:16, margin:'0 auto 14px', background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>{emoji}</div>
        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, marginBottom:8 }}>{titulo}</div>
        <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.6, marginBottom:18 }}>{descripcion}</div>
        <div style={{ display:'inline-block', background:`${color}15`, color, border:`1.5px solid ${color}40`, borderRadius:20, padding:'5px 16px', fontSize:12, fontWeight:700 }}>🔨 En construcción</div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   APP PRINCIPAL
══════════════════════════════════════════════════════ */
export default function App() {
  const [usuario,      setUsuario]      = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [page,         setPage]         = useState('dashboard')
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [mostrarForm,  setMostrarForm]  = useState(false)
  const [tipoForm,     setTipoForm]     = useState(null)

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
    // Scroll al top al navegar
    setTimeout(() => {
      document.querySelector('.shell-content')?.scrollTo({ top:0, behavior:'smooth' })
    }, 50)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUsuario(null); setPage('dashboard')
  }

  function abrirForm(tipo = null) { setTipoForm(tipo); setMostrarForm(true) }
  function cerrarForm() { setMostrarForm(false); setTipoForm(null) }

  /* ── Loading ── */
  if (cargando) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:42, marginBottom:10 }}>📊</div>
        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:22 }}>Money<span style={{ color:'#6c63ff' }}>Tor</span></div>
        <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!usuario) return <Login onLogin={setUsuario} />

  /* ── Páginas ── */
  const pages = {
    dashboard:               <Dashboard        usuarioId={usuario.id} onNavigate={navegar} onRegistrar={abrirForm} />,
    flujo_dashboard:         <FlujoDashboard   usuarioId={usuario.id} onNavigate={navegar} onRegistrar={abrirForm} />,
    quincena_resumen:        <QuincenaResumen  usuarioId={usuario.id} />,
    ingresos:                <Ingresos         usuarioId={usuario.id} />,
    gastos:                  <Gastos           usuarioId={usuario.id} />,
    movimientos:             <Movimientos      usuarioId={usuario.id} />,
    flujo_caja:              <FlujoCaja        usuarioId={usuario.id} />,
    deudas:                  <Deudas           usuarioId={usuario.id} />,
    reservas:                <Reservas         usuarioId={usuario.id} />,
    ahorro_programado:       <AhorroProgramado usuarioId={usuario.id} />,
    propiedades:             <Propiedades      usuarioId={usuario.id} />,
    inversiones:             <Inversiones      usuarioId={usuario.id} />,
    presupuesto:             <Presupuesto      usuarioId={usuario.id} />,
    obligaciones_dashboard:  <Pronto emoji="💳" color="#ef4444" titulo="Dashboard Obligaciones"  descripcion="Vista consolidada de todas tus deudas." />,
    patrimonio_dashboard:    <Pronto emoji="📊" color="#7c3aed" titulo="Dashboard Patrimonio"    descripcion="Valor total de activos menos deudas." />,
    planificacion_dashboard: <Pronto emoji="🗓️" color="#d97706" titulo="Dashboard Planificación" descripcion="Metas, presupuesto y pagos en un lugar." />,
    metas:                   <Pronto emoji="🎯" color="#db2777" titulo="Metas de ahorro"         descripcion="Objetivos financieros a plazo." />,
    calendario:              <Pronto emoji="🗓️" color="#0d9488" titulo="Calendario de pagos"     descripcion="Todos los vencimientos del mes." />,
    reportes:                <Pronto emoji="📉" color="#475569" titulo="Reportes"                descripcion="Evolución patrimonial y exportación." />,
    configuracion:           <Pronto emoji="⚙️" color="#6d28d9" titulo="Configuración"           descripcion="Preferencias y categorías personalizadas." />,
  }

  return (
    <div className="shell">

      {/* ── Sidebar (desktop fijo / mobile drawer) ── */}
      <Sidebar
        currentPage={page}
        onNavigate={navegar}
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
      />

      {/* ── Contenido principal ── */}
      <div className="shell-right">

        {/* Topbar */}
        <Topbar
          currentPage={page}
          onRegistrar={() => abrirForm()}
          onCerrarSesion={cerrarSesion}
          email={usuario.email}
          onMenuOpen={() => setDrawerOpen(true)}
        />

        {/* Página activa */}
        <main className="shell-content">
          {pages[page] || pages.dashboard}
        </main>
      </div>

      {/* ── Bottom Navigation (mobile/tablet) ── */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.map(item => {
          const activo = page === item.id
          return (
            <button key={item.id}
              className={`bnav-item ${activo ? 'active' : ''}`}
              onClick={() => navegar(item.id)}>
              <span className="bnav-emoji">{item.emoji}</span>
              <span className="bnav-label" style={{ color: activo ? '#6c63ff' : 'var(--text3)' }}>
                {item.label}
              </span>
              {activo && (
                <div style={{ position:'absolute', bottom:6, width:4, height:4, borderRadius:'50%', background:'#6c63ff' }}/>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── FAB: botón flotante para registrar (mobile) ── */}
      <button className="fab" onClick={() => abrirForm()} aria-label="Registrar movimiento">
        +
      </button>

      {/* ── Modal / Bottom Sheet ── */}
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
