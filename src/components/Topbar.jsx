const PAGE_INFO = {
  dashboard:               { titulo:'Inicio',               color:'#6c63ff', btn:'+ Registrar' },
  flujo_dashboard:         { titulo:'Flujo de dinero',       color:'#0f766e', btn:'+ Registrar' },
  quincena_resumen:        { titulo:'Resumen quincena',      color:'#0891b2', btn:null },
  ingresos:                { titulo:'Ingresos',              color:'#16a34a', btn:'+ Ingreso', flecha:'↑' },
  gastos:                  { titulo:'Gastos',                color:'#dc2626', btn:'+ Gasto',   flecha:'↓' },
  flujo_caja:              { titulo:'Flujo de caja',         color:'#16a34a', btn:null },
  obligaciones_dashboard:  { titulo:'Obligaciones',          color:'#ef4444', btn:null },
  deudas:                  { titulo:'Deudas',                color:'#ef4444', btn:'+ Deuda' },
  patrimonio_dashboard:    { titulo:'Patrimonio',            color:'#7c3aed', btn:null },
  reservas:                { titulo:'Reservas',              color:'#2563eb', btn:'+ Reserva' },
  ahorro_programado:       { titulo:'Ahorro programado',     color:'#0891b2', btn:'+ Depósito' },
  inversiones:             { titulo:'Inversiones',           color:'#7c3aed', btn:'+ Inversión' },
  propiedades:             { titulo:'Propiedades',           color:'#b45309', btn:'+ Propiedad' },
  planificacion_dashboard: { titulo:'Planificación',         color:'#d97706', btn:null },
  presupuesto:             { titulo:'Presupuesto',           color:'#d97706', btn:'✏️ Editar' },
  metas:                   { titulo:'Metas',                 color:'#db2777', btn:'+ Meta' },
  calendario:              { titulo:'Calendario',            color:'#0d9488', btn:null },
  reportes:                { titulo:'Reportes',              color:'#475569', btn:'📥 Exportar' },
  configuracion:           { titulo:'Configuración',         color:'#6d28d9', btn:'Guardar' },
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
          style={{ width:38, height:38, borderRadius:10, background:'var(--bg)', border:'1.5px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, flexShrink:0 }}>
          <div style={{ width:16, height:2, background:'var(--text2)', borderRadius:1 }}/>
          <div style={{ width:16, height:2, background:'var(--text2)', borderRadius:1 }}/>
          <div style={{ width:10, height:2, background:'var(--text2)', borderRadius:1, alignSelf:'flex-start', marginLeft:3 }}/>
        </button>

        {/* Barra color + título */}
        <div style={{ width:3, height:28, borderRadius:3, background:info.color, flexShrink:0 }}/>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
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
        <button onClick={onCerrarSesion} style={{ background:'var(--bg)', color:'var(--text2)', border:'1.5px solid var(--border)', borderRadius:7, padding:'6px 10px', fontSize:12, fontWeight:600 }}>
          Salir
        </button>
        {/* Botón acción solo desktop */}
        {info.btn && (
          <button className="hide-mobile" onClick={onRegistrar} style={{ background:info.color, color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, boxShadow:`0 2px 8px ${info.color}40`, display:'flex', alignItems:'center', gap:5 }}>
            {info.flecha && <span style={{ fontWeight:900, fontSize:14 }}>{info.flecha}</span>}
            {info.btn}
          </button>
        )}
      </div>
    </div>
  )
}
