import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Sidebar   from './components/Sidebar'
import Topbar    from './components/Topbar'
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import Deudas    from './pages/Deudas'
import Reservas  from './pages/Reservas'
import TransactionForm from './components/TransactionForm'

function Proximamente({ titulo, emoji, color, descripcion }) {
  return (
    <div style={{ padding:32 }}>
      <div style={{
        background:'white', borderRadius:18,
        border:'1.5px solid var(--border)',
        padding:'52px 32px', textAlign:'center',
        maxWidth:480, margin:'0 auto',
        boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width:64, height:64, borderRadius:18, margin:'0 auto 16px',
          background:`${color}15`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:30,
        }}>{emoji}</div>
        <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, marginBottom:8 }}>{titulo}</div>
        <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.6, marginBottom:20 }}>{descripcion}</div>
        <div style={{
          display:'inline-block',
          background:`${color}15`, color,
          border:`1.5px solid ${color}40`,
          borderRadius:20, padding:'5px 16px',
          fontSize:12, fontWeight:700,
        }}>🔨 En construcción</div>
      </div>
    </div>
  )
}

function buildPages(usuarioId, recargar, onRegistrar) {
  return {
    dashboard: <Dashboard usuarioId={usuarioId} recargar={recargar} onRegistrar={onRegistrar} />,

    // Dashboards de grupo
    flujo_dashboard:        <Proximamente emoji="💹" color="#0f766e" titulo="Dashboard — Flujo de dinero"       descripcion="Resumen mensual de ingresos y egresos, gráficos de evolución y desglose por categoría." />,
    obligaciones_dashboard: <Proximamente emoji="💳" color="#ef4444" titulo="Dashboard — Obligaciones"          descripcion="Vista consolidada de todas tus deudas, intereses acumulados y calendario de pagos." />,
    patrimonio_dashboard:   <Proximamente emoji="📊" color="#7c3aed" titulo="Dashboard — Patrimonio"            descripcion="Valor total de tus activos: reservas, ahorro programado, inversiones y propiedades." />,
    planificacion_dashboard:<Proximamente emoji="🗓️" color="#d97706" titulo="Dashboard — Planificación"         descripcion="Estado de tu presupuesto mensual, avance de metas y próximos compromisos de pago." />,

    // Flujo
    ingresos: <Proximamente emoji="↑" color="#16a34a" titulo="Ingresos" descripcion="Registra y analiza todo el dinero que entra: sueldo, honorarios, alquiler cobrado, dividendos y más." />,
    gastos:   <Proximamente emoji="↓" color="#dc2626" titulo="Gastos"   descripcion="Registra y categoriza cada gasto. Compara contra tu presupuesto en tiempo real." />,

    // Obligaciones
    deudas: <Deudas usuarioId={usuarioId} />,

    // Patrimonio — ACTIVO
    reservas: <Reservas usuarioId={usuarioId} />,

    // Patrimonio — próximamente
    ahorro_programado: <Proximamente emoji="📅" color="#0891b2" titulo="Ahorro programado" descripcion="Controla tus depósitos a plazo fijo, CTS y fondos de ahorro con fecha y tasa garantizada." />,
    inversiones:       <Proximamente emoji="📈" color="#7c3aed" titulo="Inversiones"        descripcion="Monitorea tus acciones, ETFs, fondos mutuos, AFP, criptomonedas y negocios propios." />,
    propiedades:       <Proximamente emoji="🏠" color="#b45309" titulo="Propiedades"        descripcion="Registra el valor estimado de tus inmuebles, vehículos y otros activos físicos." />,

    // Planificación
    presupuesto: <Proximamente emoji="📊" color="#d97706" titulo="Presupuesto mensual" descripcion="Define cuánto quieres gastar en cada categoría. Recibe alertas antes de excederte." />,
    metas:       <Proximamente emoji="🎯" color="#db2777" titulo="Metas de ahorro"     descripcion="Crea objetivos: viaje, departamento, auto, jubilación. Monitorea tu avance mes a mes." />,
    calendario:  <Proximamente emoji="🗓️" color="#0d9488" titulo="Calendario de pagos" descripcion="Visualiza todos tus vencimientos en un calendario. Nunca más olvides una fecha de pago." />,

    // Análisis
    reportes:      <Proximamente emoji="📉" color="#475569" titulo="Reportes"      descripcion="Gráficos de evolución patrimonial, comparativas mensuales y exportación a PDF/Excel." />,
    configuracion: <Proximamente emoji="⚙️" color="#6d28d9" titulo="Configuración" descripcion="Personaliza MoneyTor: moneda, categorías, notificaciones y preferencias del menú." />,
  }
}

export default function App() {
  const [usuario,     setUsuario]     = useState(null)
  const [cargando,    setCargando]    = useState(true)
  const [page,        setPage]        = useState('dashboard')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [recargar,    setRecargar]    = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null)
      setCargando(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUsuario(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUsuario(null)
    setPage('dashboard')
  }

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

  const pages        = buildPages(usuario.id, recargar, () => setMostrarForm(true))
  const paginaActual = pages[page] || pages.dashboard

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar currentPage={page} onNavigate={setPage} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        <Topbar
          currentPage={page}
          onRegistrar={() => setMostrarForm(true)}
          onCerrarSesion={cerrarSesion}
          email={usuario.email}
        />
        <main style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
          {paginaActual}
        </main>
      </div>

      {mostrarForm && (
        <TransactionForm
          usuarioId={usuario.id}
          onClose={() => setMostrarForm(false)}
          onGuardado={() => setRecargar(r => r + 1)}
        />
      )}
    </div>
  )
}
