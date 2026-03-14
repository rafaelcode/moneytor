import { useEffect } from 'react'
import { useState } from 'react'

const MENU = [
  { id:'inicio', label:'INICIO', items:[
    { id:'dashboard',        emoji:'🏠', label:'Inicio' },
  ]},
  { id:'flujo', label:'FLUJO DE DINERO', items:[
    { id:'flujo_caja',       emoji:'💸', label:'Flujo de caja' },
    { id:'movimientos',      emoji:'🔁', label:'Movimientos' },
  ]},
  { id:'obligaciones', label:'OBLIGACIONES', items:[
    { id:'deudas', emoji:'💳', label:'Deudas' },
  ]},
  { id:'patrimonio', label:'PATRIMONIO', items:[
    { id:'reservas',             emoji:'🏦', label:'Reservas' },
    { id:'ahorro_programado',    emoji:'📅', label:'Ahorro programado' },
    { id:'inversiones',          emoji:'📈', label:'Inversiones' },
    { id:'propiedades',          emoji:'🏠', label:'Propiedades' },
  ]},
  { id:'planificacion', label:'PLANIFICACIÓN', items:[
    { id:'presupuesto',  emoji:'📋', label:'Presupuesto' },
    { id:'metas',        emoji:'🎯', label:'Metas' },
    { id:'calendario',   emoji:'🗓️', label:'Calendario' },
  ]},
  { id:'analisis', label:'ANÁLISIS', items:[
    { id:'reportes',      emoji:'📉', label:'Reportes' },
    { id:'configuracion', emoji:'⚙️', label:'Configuración' },
  ]},
]

function NavContent({ currentPage, onNavigate, onClose }) {
  const [collapsed, setCollapsed] = useState({})
  const toggle = id => setCollapsed(c => ({ ...c, [id]: !c[id] }))
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* Logo */}
      <div style={{ padding:'18px 16px 14px', borderBottom:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div onClick={() => { onNavigate('dashboard'); onClose?.() }} style={{ cursor:'pointer' }}>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:19, letterSpacing:'-0.5px' }}>
            Money<span style={{ color:'#6c63ff' }}>Tor</span>
          </div>
          <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>Finanzas personales</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', fontSize:20, color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
        )}
      </div>
      {/* Nav items */}
      <nav style={{ flex:1, overflowY:'auto', padding:'8px 0', overscrollBehavior:'contain' }}>
        {MENU.map(group => {
          const col = collapsed[group.id]
          return (
            <div key={group.id} style={{ marginBottom:2 }}>
              {group.id !== 'inicio' && (
                <div onClick={() => toggle(group.id)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 16px 3px', cursor:'pointer', userSelect:'none' }}>
                  <span style={{ fontSize:9, fontWeight:800, letterSpacing:'1.2px', color:'var(--text3)', textTransform:'uppercase' }}>{group.label}</span>
                  <span style={{ fontSize:10, color:'var(--text3)', display:'inline-block', transition:'transform 0.15s', transform: col ? 'rotate(-90deg)' : 'none' }}>▾</span>
                </div>
              )}
              {!col && group.items.map(item => {
                const activo = currentPage === item.id
                return (
                  <div key={item.id}
                    onClick={() => { onNavigate(item.id); onClose?.() }}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 16px', cursor:'pointer', userSelect:'none', background: activo ? '#f5f3ff' : 'transparent', borderRight: activo ? '3px solid #6c63ff' : '3px solid transparent' }}>
                    <span style={{ fontSize:15, width:20, textAlign:'center', flexShrink:0 }}>{item.emoji}</span>
                    <span style={{ fontSize:12.5, fontWeight: activo ? 700 : 500, color: activo ? '#6c63ff' : 'var(--text2)', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.label}</span>
                    {activo && <div style={{ width:6, height:6, borderRadius:'50%', background:'#6c63ff', flexShrink:0 }}/>}
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
