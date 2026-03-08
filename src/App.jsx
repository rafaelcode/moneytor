import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Sidebar            from './components/Sidebar'
import Topbar             from './components/Topbar'
import Login              from './pages/Login'
import Dashboard          from './pages/Dashboard'
import FlujoDashboard     from './pages/FlujoDashboard'
import Ingresos           from './pages/Ingresos'
import Gastos             from './pages/Gastos'
import Deudas             from './pages/Deudas'
import Reservas           from './pages/Reservas'
import AhorroProgramado   from './pages/AhorroProgramado'
import Propiedades        from './pages/Propiedades'
import Presupuesto        from './pages/Presupuesto'
import TransactionForm    from './components/TransactionForm'

function Proximamente({ titulo, emoji, color, descripcion }) {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ background:'white', borderRadius:18, border:'1.5px solid var(--border)', padding:'52px 32px', textAlign:'center', maxWidth:480, margin:'0 auto', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ width:64, height:64, borderRadius:18, margin:'0 auto 16px', background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30 }}>{emoji}</div>
        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, marginBottom:8 }}>{titulo}</div>
        <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.6, marginBottom:20 }}>{descripcion}</div>
        <div style={{ display:'inline-block', background:`${color}15`, color, border:`1.5px solid ${color}40`, borderRadius:20, padding:'5px 16px', fontSize:12, fontWeight:700 }}>🔨 En construcción</div>
      </div>
    </div>
  )
}

export default function App() {
  const [usuario,     setUsuario]     = useState(null)
  const [cargando,    setCargando]    = useState(true)
  const [page,        setPage]        = useState('dashboard')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [tipoForm,    setTipoForm]    = useState(null)
  const [recargar,    setRecargar]    = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null)
      setCargando(false)
    })
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setUsuario(s?.user ?? null))
    return () => l.subscription.unsubscribe()
  }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUsuario(null); setPage('dashboard')
  }

  function abrirForm(tipo = null) { setTipoForm(tipo); setMostrarForm(true) }

  if (cargando) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:44, marginBottom:12 }}>📊</div>
        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:22 }}>
          Money<span style={{ color:'#6c63ff' }}>Tor</span>
        </div>
        <div style={{ fontSize:13, color:'var(--text3)', marginTop:4 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!usuario) return <Login onLogin={setUsuario} />

  const pages = {
    dashboard:               <Dashboard        usuarioId={usuario.id} recargar={recargar} onRegistrar={() => abrirForm()} />,
    flujo_dashboard:         <FlujoDashboard   usuarioId={usuario.id} onNavigate={setPage} onRegistrar={abrirForm} />,
    ingresos:                <Ingresos         usuarioId={usuario.id} />,
    gastos:                  <Gastos           usuarioId={usuario.id} />,
    deudas:                  <Deudas           usuarioId={usuario.id} />,
    reservas:                <Reservas         usuarioId={usuario.id} />,
    ahorro_programado:       <AhorroProgramado usuarioId={usuario.id} />,
    propiedades:             <Propiedades      usuarioId={usuario.id} />,
    presupuesto:             <Presupuesto      usuarioId={usuario.id} />,

    obligaciones_dashboard:  <Proximamente emoji="💳" color="#ef4444" titulo="Dashboard — Obligaciones"     descripcion="Vista consolidada de todas tus deudas e intereses acumulados." />,
    patrimonio_dashboard:    <Proximamente emoji="📊" color="#7c3aed" titulo="Dashboard — Patrimonio"       descripcion="Valor total de tus activos: reservas, ahorro programado, inversiones y propiedades." />,
    planificacion_dashboard: <Proximamente emoji="🗓️" color="#d97706" titulo="Dashboard — Planificación"    descripcion="Presupuesto mensual, metas y compromisos de pago en un solo lugar." />,
    inversiones:             <Proximamente emoji="📈" color="#7c3aed" titulo="Inversiones"                  descripcion="Acciones, ETFs, fondos mutuos, AFP, criptomonedas y negocios propios." />,
    metas:                   <Proximamente emoji="🎯" color="#db2777" titulo="Metas de ahorro"              descripcion="Objetivos financieros a plazo: viaje, depa, auto, jubilación." />,
    calendario:              <Proximamente emoji="🗓️" color="#0d9488" titulo="Calendario de pagos"          descripcion="Todos tus vencimientos en un solo lugar." />,
    reportes:                <Proximamente emoji="📉" color="#475569" titulo="Reportes"                     descripcion="Evolución patrimonial, comparativas y exportación." />,
    configuracion:           <Proximamente emoji="⚙️" color="#6d28d9" titulo="Configuración"                descripcion="Moneda, categorías, notificaciones y preferencias." />,
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar currentPage={page} onNavigate={setPage} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        <Topbar currentPage={page} onRegistrar={() => abrirForm()} onCerrarSesion={cerrarSesion} email={usuario.email} />
        <main style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
          {pages[page] || pages.dashboard}
        </main>
      </div>
      {mostrarForm && (
        <TransactionForm
          usuarioId={usuario.id} tipoInicial={tipoForm}
          onClose={() => { setMostrarForm(false); setTipoForm(null) }}
          onGuardado={() => setRecargar(r => r + 1)}
        />
      )}
    </div>
  )
}
