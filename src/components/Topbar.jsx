const PAGE_INFO = {
  // ── Inicio ──────────────────────────────────────────────
  dashboard: {
    titulo: 'Inicio',
    sub: 'Tu resumen financiero personalizado',
    color: '#6c63ff', btn: '+ Registrar movimiento',
  },

  // ── Dashboards de grupo ──────────────────────────────────
  flujo_dashboard: {
    titulo: 'Flujo de dinero',
    sub: 'Resumen de ingresos y egresos del mes',
    color: '#0f766e', btn: '+ Registrar movimiento',
  },
  obligaciones_dashboard: {
    titulo: 'Obligaciones',
    sub: 'Resumen de todas tus deudas activas',
    color: '#ef4444', btn: '+ Nueva deuda',
  },
  patrimonio_dashboard: {
    titulo: 'Patrimonio',
    sub: 'Valor total de lo que tienes',
    color: '#7c3aed', btn: '+ Actualizar activo',
  },
  planificacion_dashboard: {
    titulo: 'Planificación financiera',
    sub: 'Presupuesto, metas y calendario del mes',
    color: '#d97706', btn: '+ Nueva planificación',
  },

  // ── Flujo ────────────────────────────────────────────────
  ingresos: {
    titulo: 'Ingresos',
    sub: 'Todo el dinero que entra a tu cuenta',
    color: '#16a34a', btn: '+ Registrar ingreso',
    flecha: '↑',
  },
  gastos: {
    titulo: 'Gastos',
    sub: 'Todo el dinero que sale de tu cuenta',
    color: '#dc2626', btn: '+ Registrar gasto',
    flecha: '↓',
  },

  // ── Obligaciones ─────────────────────────────────────────
  deudas: {
    titulo: 'Deudas',
    sub: 'Gestión de obligaciones financieras',
    color: '#ef4444', btn: '+ Nueva deuda',
  },

  // ── Patrimonio ───────────────────────────────────────────
  reservas: {
    titulo: 'Reservas',
    sub: 'Dinero disponible en cualquier momento',
    color: '#2563eb', btn: '+ Actualizar saldo',
  },
  ahorro_programado: {
    titulo: 'Ahorro programado',
    sub: 'Depósitos a plazo con fecha y tasa fija',
    color: '#0891b2', btn: '+ Nuevo depósito',
  },
  inversiones: {
    titulo: 'Inversiones',
    sub: 'Activos financieros con rentabilidad variable',
    color: '#7c3aed', btn: '+ Nueva inversión',
  },
  propiedades: {
    titulo: 'Propiedades',
    sub: 'Activos físicos que posees',
    color: '#b45309', btn: '+ Agregar propiedad',
  },

  // ── Planificación ─────────────────────────────────────────
  presupuesto: {
    titulo: 'Presupuesto mensual',
    sub: 'Define límites de gasto por categoría',
    color: '#d97706', btn: '✏️ Editar presupuesto',
  },
  metas: {
    titulo: 'Metas de ahorro',
    sub: 'Objetivos financieros a plazo definido',
    color: '#db2777', btn: '+ Nueva meta',
  },
  calendario: {
    titulo: 'Calendario de pagos',
    sub: 'Vencimientos y compromisos del mes',
    color: '#0d9488', btn: '+ Agregar pago fijo',
  },

  // ── Análisis ─────────────────────────────────────────────
  reportes: {
    titulo: 'Reportes',
    sub: 'Análisis y tendencias de tu dinero',
    color: '#475569', btn: '📥 Exportar',
  },
  configuracion: {
    titulo: 'Configuración',
    sub: 'Personaliza tu experiencia en MoneyTor',
    color: '#6d28d9', btn: 'Guardar cambios',
  },
}

export default function Topbar({ currentPage, onRegistrar, onCerrarSesion, email }) {
  const info     = PAGE_INFO[currentPage] || PAGE_INFO.dashboard
  const esFlecha = !!info.flecha

  return (
    <div style={{
      background: 'white',
      borderBottom: '1.5px solid var(--border)',
      padding: '13px 26px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
    }}>

      {/* ── Izquierda: título ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Barra de color lateral */}
        <div style={{
          width: 4, height: 34, borderRadius: 4,
          background: info.color, flexShrink: 0,
        }} />

        {/* Ícono de flecha para ingresos/gastos */}
        {esFlecha && (
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: `${info.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Nunito', fontWeight: 900, fontSize: 18,
            color: info.color,
          }}>
            {info.flecha}
          </div>
        )}

        <div>
          <div style={{
            fontFamily: 'Nunito', fontWeight: 900, fontSize: 17, lineHeight: 1.2,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {info.titulo}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
            {info.sub}
          </div>
        </div>
      </div>

      {/* ── Derecha: acciones ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Email (solo desktop) */}
        {email && (
          <span style={{
            fontSize: 11, color: 'var(--text3)', fontWeight: 500,
            maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {email}
          </span>
        )}

        {/* Salir */}
        <button onClick={onCerrarSesion} style={{
          background: 'var(--bg)', color: 'var(--text2)',
          border: '1.5px solid var(--border)', borderRadius: 7,
          padding: '6px 12px', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'Poppins',
        }}>
          Salir
        </button>

        {/* Botón principal */}
        <button onClick={onRegistrar} style={{
          background: info.color, color: 'white',
          border: 'none', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Poppins',
          boxShadow: `0 3px 10px ${info.color}40`,
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 5px 16px ${info.color}50` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 3px 10px ${info.color}40` }}
        >
          {esFlecha && (
            <span style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 16 }}>
              {info.flecha}
            </span>
          )}
          {info.btn}
        </button>
      </div>
    </div>
  )
}
