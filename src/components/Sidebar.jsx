import { useEffect, useState } from 'react'

const MENU = [
  {
    id: 'inicio', label: 'INICIO',
    color: '#ef4444',
    items: [
      { id: 'dashboard', emoji: '🏠', label: 'Resumen' },
    ],
  },
  {
    id: 'flujo', label: 'FLUJO DE DINERO',
    color: '#2563eb',
    items: [
      { id: 'flujo_caja',       emoji: '💸', label: 'Flujo de caja' },
      { id: 'movimientos',      emoji: '🔁', label: 'Movimientos' },
    ],
  },
  {
    id: 'obligaciones', label: 'OBLIGACIONES',
    color: '#f97316',
    items: [
      { id: 'deudas',    emoji: '💳', label: 'Deudas' },
      { id: 'prestamos', emoji: '📥', label: 'Préstamos' },
    ],
  },
  {
    id: 'relaciones', label: 'RELACIONES FINANCIERAS',
    color: '#7c3aed',
    items: [
      { id: 'efectivo', emoji: '💵', label: 'Efectivo' },
      { id: 'cuentas',  emoji: '🏦', label: 'Cuentas bancarias' },
      { id: 'tarjetas', emoji: '💳', label: 'Tarjetas' },
    ],
  },
  {
    id: 'patrimonio', label: 'PATRIMONIO',
    color: '#16a34a',
    items: [
      { id: 'reservas',          emoji: '🏦', label: 'Reservas' },
      { id: 'ahorro_programado', emoji: '📅', label: 'Ahorro programado' },
      { id: 'inversiones',       emoji: '📈', label: 'Inversiones' },
      { id: 'propiedades',       emoji: '🏠', label: 'Propiedades' },
    ],
  },
  {
    id: 'planificacion', label: 'PLANIFICACIÓN',
    color: '#d97706',
    items: [
      { id: 'presupuesto', emoji: '📋', label: 'Presupuesto' },
      { id: 'metas',       emoji: '🎯', label: 'Metas' },
      { id: 'calendario',  emoji: '🗓️', label: 'Calendario' },
    ],
  },
  {
    id: 'analisis', label: 'ANÁLISIS',
    color: '#64748b',
    items: [
      { id: 'reportes',      emoji: '📉', label: 'Reportes' },
      { id: 'configuracion', emoji: '⚙️', label: 'Configuración' },
    ],
  },
]

function NavContent({ currentPage, onNavigate, onClose }) {
  const [collapsed, setCollapsed] = useState({})
  const toggle = id => setCollapsed(c => ({ ...c, [id]: !c[id] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Logo */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div onClick={() => { onNavigate('dashboard'); onClose?.() }} style={{ cursor: 'pointer' }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: 19, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            Money<span style={{ color: 'var(--primary-blue)' }}>Tor</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>Finanzas personales</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--bg)', border: '1.5px solid var(--border)',
            fontSize: 20, color: 'var(--text3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
          }}>×</button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0', overscrollBehavior: 'contain' }}>
        {MENU.map(group => {
          const col = collapsed[group.id]
          const isInicio = group.id === 'inicio'
          return (
            <div key={group.id} style={{ marginBottom: 2 }}>
              {/* Separador de grupo */}
              {!isInicio && (
                <div
                  onClick={() => toggle(group.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px 4px',
                    cursor: 'pointer', userSelect: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: group.color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '1.2px',
                      color: 'var(--text3)', textTransform: 'uppercase',
                    }}>
                      {group.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, color: 'var(--text3)',
                    transform: col ? 'rotate(-90deg)' : 'none',
                    transition: 'transform 0.15s',
                    display: 'inline-block',
                  }}>▾</span>
                </div>
              )}

              {/* Items */}
              {!col && group.items.map(item => {
                const activo = currentPage === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onClose?.() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '9px 16px',
                      cursor: 'pointer', userSelect: 'none',
                      background: activo ? `${group.color}12` : 'transparent',
                      borderRight: activo ? `3px solid ${group.color}` : '3px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>
                      {item.emoji}
                    </span>
                    <span style={{
                      fontSize: 12.5,
                      fontWeight: activo ? 700 : 500,
                      color: activo ? group.color : 'var(--text2)',
                      flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      transition: 'color 0.15s',
                    }}>
                      {item.label}
                    </span>
                    {activo && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: group.color, flexShrink: 0,
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </nav>
    </div>
  )
}

export default function Sidebar({ currentPage, onNavigate, drawerOpen, onDrawerClose }) {
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    if (!drawerOpen) return
    const h = e => { if (e.key === 'Escape') onDrawerClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [drawerOpen])

  return (
    <>
      {/* Desktop */}
      <div className="sidebar-desktop">
        <NavContent currentPage={currentPage} onNavigate={onNavigate} />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={onDrawerClose}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <NavContent currentPage={currentPage} onNavigate={onNavigate} onClose={onDrawerClose} />
          </div>
        </div>
      )}
    </>
  )
}