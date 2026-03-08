import { useState } from 'react'

const MENU = [
  {
    id: 'inicio',
    grupo: null,
    items: [
      { id: 'dashboard', emoji: '🏠', label: 'Inicio', color: '#6c63ff' },
    ],
  },
  {
    id: 'flujo',
    grupo: 'FLUJO DE DINERO',
    dashboardId: 'flujo_dashboard',
    color: '#0f766e',
    items: [
      { id: 'ingresos', flecha: '↑', label: 'Ingresos', color: '#16a34a' },
      { id: 'gastos',   flecha: '↓', label: 'Gastos',   color: '#dc2626' },
    ],
  },
  {
    id: 'obligaciones',
    grupo: 'OBLIGACIONES',
    dashboardId: 'obligaciones_dashboard',
    color: '#ef4444',
    items: [
      { id: 'deudas', emoji: '💳', label: 'Deudas', color: '#ef4444' },
    ],
  },
  {
    id: 'patrimonio',
    grupo: 'PATRIMONIO',
    dashboardId: 'patrimonio_dashboard',
    color: '#7c3aed',
    items: [
      { id: 'reservas',          emoji: '🏦', label: 'Reservas',          color: '#2563eb' },
      { id: 'ahorro_programado', emoji: '📅', label: 'Ahorro programado', color: '#0891b2' },
      { id: 'inversiones',       emoji: '📈', label: 'Inversiones',       color: '#7c3aed' },
      { id: 'propiedades',       emoji: '🏠', label: 'Propiedades',       color: '#b45309' },
    ],
  },
  {
    id: 'planificacion',
    grupo: 'PLANIFICACIÓN',
    dashboardId: 'planificacion_dashboard',
    color: '#d97706',
    items: [
      { id: 'presupuesto', emoji: '📊', label: 'Presupuesto mensual', color: '#d97706' },
      { id: 'metas',       emoji: '🎯', label: 'Metas de ahorro',     color: '#db2777' },
      { id: 'calendario',  emoji: '🗓️', label: 'Calendario de pagos', color: '#0d9488', badge: '3' },
    ],
  },
  {
    id: 'analisis',
    grupo: 'ANÁLISIS',
    dashboardId: null, // sin dashboard propio
    color: '#475569',
    items: [
      { id: 'reportes',      emoji: '📉', label: 'Reportes',      color: '#475569' },
      { id: 'configuracion', emoji: '⚙️', label: 'Configuración', color: '#6d28d9' },
    ],
  },
]

export default function Sidebar({ currentPage, onNavigate, deudasCount = 0 }) {
  // Todo expandido por defecto
  const [colapsados, setColapsados] = useState({})

  function toggleColapso(seccionId, e) {
    e.stopPropagation()
    setColapsados(prev => ({ ...prev, [seccionId]: !prev[seccionId] }))
  }

  function estaActivo(id) {
    return currentPage === id
  }

  // Si algún ítem del grupo o su dashboard está activo
  function grupoActivo(seccion) {
    return seccion.items.some(i => i.id === currentPage) ||
           seccion.dashboardId === currentPage
  }

  return (
    <aside style={{
      width: 230, minWidth: 230,
      background: 'white',
      borderRight: '1.5px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      overflowY: 'auto', overflowX: 'hidden',
      scrollbarWidth: 'thin',
    }}>

      {/* ── Logo ── */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1.5px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #6c63ff, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
            boxShadow: '0 3px 10px rgba(108,99,255,0.25)',
          }}>📊</div>
          <div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>
              Money<span style={{ color: '#6c63ff' }}>Tor</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
              Gestión financiera personal
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '6px 8px 10px' }}>
        {MENU.map(seccion => {
          const colapsado     = !!colapsados[seccion.id]
          const activo        = grupoActivo(seccion)
          const dashActivo    = estaActivo(seccion.dashboardId)
          const tieneDash     = !!seccion.dashboardId

          return (
            <div key={seccion.id} style={{ marginBottom: 2 }}>

              {/* ── Título de grupo ── */}
              {seccion.grupo && (
                <div
                  onClick={() => tieneDash && onNavigate(seccion.dashboardId)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 8px 5px',
                    cursor: tieneDash ? 'pointer' : 'default',
                    borderRadius: 8,
                    userSelect: 'none',
                    transition: 'background 0.15s',
                    background: dashActivo ? `${seccion.color}12` : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (tieneDash && !dashActivo)
                      e.currentTarget.style.background = `${seccion.color}08`
                  }}
                  onMouseLeave={e => {
                    if (!dashActivo)
                      e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Texto del grupo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Punto de color activo */}
                    {activo && (
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: seccion.color, flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: dashActivo
                        ? seccion.color
                        : activo
                          ? '#475569'
                          : 'var(--text3)',
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                      transition: 'color 0.15s',
                    }}>
                      {seccion.grupo}
                    </span>
                    {/* Hint visual de que es clickeable */}
                    {tieneDash && !dashActivo && (
                      <span style={{
                        fontSize: 9, color: 'var(--text3)',
                        opacity: 0,
                        transition: 'opacity 0.15s',
                      }}
                        className="dash-hint"
                      >›</span>
                    )}
                  </div>

                  {/* Botón colapsar (separado del clic al dashboard) */}
                  <div
                    onClick={e => toggleColapso(seccion.id, e)}
                    style={{
                      padding: '2px 5px', borderRadius: 5,
                      cursor: 'pointer',
                      color: 'var(--text3)',
                      fontSize: 11, lineHeight: 1,
                      transition: 'background 0.12s, transform 0.2s',
                      transform: colapsado ? 'rotate(-90deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Colapsar grupo"
                  >
                    ▾
                  </div>
                </div>
              )}

              {/* ── Ítems del grupo ── */}
              {!colapsado && (
                <div style={{
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease',
                }}>
                  {seccion.items.map(item => {
                    const activo     = estaActivo(item.id)
                    const badgeVal   = item.id === 'deudas' && deudasCount > 0
                                       ? deudasCount
                                       : item.badge

                    return (
                      <div
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 9px', borderRadius: 9,
                          cursor: 'pointer', marginBottom: 1,
                          background: activo ? item.color : 'transparent',
                          color: activo ? 'white' : 'var(--text2)',
                          fontWeight: activo ? 700 : 500,
                          fontSize: 13,
                          transition: 'all 0.14s',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => { if (!activo) e.currentTarget.style.background = 'var(--bg)' }}
                        onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent' }}
                      >
                        {/* Ícono */}
                        <div style={{
                          width: 27, height: 27, borderRadius: 7, flexShrink: 0,
                          background: activo ? 'rgba(255,255,255,0.2)' : `${item.color}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: item.flecha ? 14 : 13,
                          fontFamily: item.flecha ? 'Nunito' : 'inherit',
                          fontWeight: item.flecha ? 900 : 'normal',
                          color: activo ? 'white' : item.flecha ? item.color : 'inherit',
                        }}>
                          {item.flecha || item.emoji}
                        </div>

                        {/* Label */}
                        <span style={{
                          flex: 1, lineHeight: 1.2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.label}
                        </span>

                        {/* Badge */}
                        {badgeVal && (
                          <span style={{
                            background: activo ? 'rgba(255,255,255,0.3)' : '#ef4444',
                            color: 'white', fontSize: 10, fontWeight: 700,
                            padding: '1px 6px', borderRadius: 20,
                            minWidth: 18, textAlign: 'center', flexShrink: 0,
                          }}>
                            {badgeVal}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Separador entre grupos */}
              {seccion.grupo && (
                <div style={{
                  height: 1, background: 'var(--border)',
                  margin: '5px 6px 3px',
                }} />
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Footer usuario ── */}
      <div style={{
        padding: '10px 10px',
        borderTop: '1.5px solid var(--border)',
        flexShrink: 0,
      }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg)', borderRadius: 9, padding: '8px 10px',
            border: '1.5px solid var(--border)', cursor: 'pointer',
            transition: 'background 0.14s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#edf0f8'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6c63ff, #db2777)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Nunito', fontWeight: 900, fontSize: 11, color: 'white',
          }}>U</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Mi cuenta
            </div>
            <div style={{ fontSize: 10, color: '#db2777', fontWeight: 700 }}>⭐ MoneyTor</div>
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>⋯</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: none; }
        }
        aside nav div:hover .dash-hint {
          opacity: 1 !important;
        }
      `}</style>
    </aside>
  )
}
