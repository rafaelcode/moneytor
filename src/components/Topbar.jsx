const PAGE_INFO = {
  dashboard:               { titulo:'Resumen',              color:'var(--primary-blue)', btn:'+ Registrar' },
  flujo_dashboard:         { titulo:'Flujo de dinero',       color:'var(--info-blue)', btn:'+ Registrar' },
  quincena_resumen:        { titulo:'Resumen quincena',      color:'var(--info-blue)', btn:null },
  ingresos:                { titulo:'Ingresos',              color:'var(--success-green)', btn:'+ Ingreso', flecha:'↑' },
  gastos:                  { titulo:'Gastos',                color:'var(--red-alert)', btn:'+ Gasto',   flecha:'↓' },
  flujo_caja:              { titulo:'Flujo de caja',         color:'var(--success-green)', btn:null },
  obligaciones_dashboard:  { titulo:'Obligaciones',          color:'var(--red-alert)', btn:null },
  deudas:                  { titulo:'Deudas',                color:'var(--red-alert)', btn:'+ Deuda' },
  patrimonio_dashboard:    { titulo:'Patrimonio',            color:'var(--primary-blue)', btn:null },
  reservas:                { titulo:'Reservas',              color:'var(--info-blue)', btn:'+ Reserva' },
  ahorro_programado:       { titulo:'Ahorro programado',     color:'var(--info-blue)', btn:'+ Depósito' },
  inversiones:             { titulo:'Inversiones',           color:'var(--primary-blue)', btn:'+ Inversión' },
  propiedades:             { titulo:'Propiedades',           color:'var(--amber-accent)', btn:'+ Propiedad' },
  planificacion_dashboard: { titulo:'Planificación',         color:'var(--amber-accent)', btn:null },
  presupuesto:             { titulo:'Presupuesto',           color:'var(--amber-accent)', btn:'✏️ Editar' },
  metas:                   { titulo:'Metas',                 color:'var(--primary-blue)', btn:'+ Meta' },
  calendario:              { titulo:'Calendario',            color:'var(--success-green)', btn:null },
  reportes:                { titulo:'Reportes',              color:'var(--gray-600)', btn:'📥 Exportar' },
  configuracion:           { titulo:'Configuración',         color:'var(--primary-blue)', btn:'Guardar' },
  tarjetas:                { titulo:'Tarjetas',              color:'var(--red-alert)', btn:'+ Tarjeta' },
  cuentas:                 { titulo:'Cuentas bancarias',      color:'var(--primary-blue)', btn:'+ Cuenta' },
  efectivo:                { titulo:'Efectivo',               color:'var(--success-green)', btn:'+ Billetera' },
}

export default function Topbar({ currentPage, onRegistrar, onCerrarSesion, email, onMenuOpen }) {
  const info = PAGE_INFO[currentPage] || PAGE_INFO.dashboard

  return (
    <div className="topbar">
      {/* Izquierda */}
      <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
        {/* Hamburger — solo mobile/tablet */}
        <button className="show-mobile"
          onClick={onMenuOpen}
          style={{ 
            width:38, 
            height:38, 
            borderRadius:10, 
            background:'var(--bg)', 
            border:'1.5px solid var(--border)', 
            display:'flex', 
            flexDirection:'column', 
            alignItems:'center', 
            justifyContent:'center', 
            gap:4, 
            flexShrink:0,
            cursor:'pointer',
            transition:'all var(--transition-fast)'
          }}>
          <div style={{ width:16, height:2, background:'var(--text2)', borderRadius:1 }}/>
          <div style={{ width:16, height:2, background:'var(--text2)', borderRadius:1 }}/>
          <div style={{ width:16, height:2, background:'var(--text2)', borderRadius:1 }}/>
        </button>

        {/* Barra color + título */}
        <div style={{ width:3, height:28, borderRadius:3, background:info.color, flexShrink:0 }}/>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'var(--text)' }}>
            {info.titulo}
          </div>
        </div>
      </div>

      {/* Derecha */}
      <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
        {/* Email solo desktop */}
        {email && (
          <span className="hide-mobile" style={{ fontSize:11, color:'var(--text3)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {email}
          </span>
        )}
        {/* Salir */}
        <button onClick={onCerrarSesion} style={{ 
          background:'var(--bg)', 
          color:'var(--text2)', 
          border:'1.5px solid var(--border)', 
          borderRadius:7, 
          padding:'6px 10px', 
          fontSize:12, 
          fontWeight:600,
          cursor:'pointer',
          transition:'all var(--transition-fast)'
        }}>
          Salir
        </button>
        {/* Botón acción solo desktop */}
        {info.btn && (
          <button className="hide-mobile" onClick={onRegistrar} style={{ 
            background:info.color, 
            color:'white', 
            border:'none', 
            borderRadius:8, 
            padding:'7px 14px', 
            fontSize:12, 
            fontWeight:700, 
            boxShadow:`0 2px 8px ${info.color}40`, 
            display:'flex', 
            alignItems:'center', 
            gap:5,
            cursor:'pointer',
            transition:'all var(--transition-fast)'
          }}>
            {info.flecha && <span style={{ fontWeight:900, fontSize:14 }}>{info.flecha}</span>}
            {info.btn}
          </button>
        )}
      </div>
    </div>
  )
}