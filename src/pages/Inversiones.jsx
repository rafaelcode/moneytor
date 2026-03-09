import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, TIPO_MAP, TIPOS_INVERSION,
  calcularValorTotal, ganancia, gananciaPct, costoCompra,
} from '../lib/inversionesUtils'
import InversionForm from '../components/InversionForm'

export default function Inversiones({ usuarioId }) {
  const [inversiones, setInversiones] = useState([])
  const [cargando,    setCargando]    = useState(true)
  const [filtro,      setFiltro]      = useState('todos')
  const [modal,       setModal]       = useState(false)
  const [editando,    setEditando]    = useState(null)

  useEffect(()=>{ cargar() },[])

  async function cargar() {
    setCargando(true)
    const {data} = await supabase
      .from('inversiones').select('*')
      .eq('usuario_id',usuarioId).eq('activa',true)
      .order('valor_total',{ascending:false})
    setInversiones(data||[])
    setCargando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta inversión?')) return
    await supabase.from('inversiones').update({activa:false}).eq('id',id)
    cargar()
  }

  async function actualizarPrecio(inv, nuevoPrecio) {
    const vt = inv.cantidad ? Number(nuevoPrecio)*Number(inv.cantidad) : Number(nuevoPrecio)
    await supabase.from('inversiones').update({
      precio_actual:  Number(nuevoPrecio),
      valor_total:    vt,
      actualizado_en: new Date().toISOString(),
    }).eq('id',inv.id)
    cargar()
  }

  // ── Totales ───────────────────────────────────────────────
  const activas       = inversiones
  const valorTotal    = activas.reduce((s,i)=>s+Number(calcularValorTotal(i)||0),0)
  const costoTotal    = activas.reduce((s,i)=>s+Number(costoCompra(i)||calcularValorTotal(i)||0),0)
  const gananciaTotal = valorTotal - costoTotal
  const ganPctTotal   = costoTotal>0 ? (gananciaTotal/costoTotal)*100 : 0

  // Por tipo
  const xTipo = {}
  activas.forEach(i=>{
    xTipo[i.tipo]=(xTipo[i.tipo]||0)+Number(calcularValorTotal(i)||0)
  })

  const FILTROS = [
    {v:'todos',label:'Todos'},
    ...TIPOS_INVERSION.filter(t=>activas.some(i=>i.tipo===t.valor))
      .map(t=>({v:t.valor,label:`${t.emoji} ${t.label}`})),
  ]
  const lista = filtro==='todos' ? activas : activas.filter(i=>i.tipo===filtro)

  return (
    <div style={{padding:28}}>

      {/* ── KPIs ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:22}}>
        <KpiCard emoji="💼" label="Portafolio total" value={fmt(valorTotal,'USD')} color="#16a34a" bg="#f0fdf4"
          sub={`${activas.length} inversión${activas.length!==1?'es':''} activa${activas.length!==1?'s':''}`}/>
        <KpiCard emoji="💸" label="Costo invertido" value={fmt(costoTotal,'USD')} color="#0891b2" bg="#ecfeff"
          sub="Capital total comprometido"/>
        <KpiCard
          emoji={gananciaTotal>=0?'📈':'📉'}
          label="Ganancia / Pérdida"
          value={`${gananciaTotal>=0?'+':''}${fmt(gananciaTotal,'USD')}`}
          color={gananciaTotal>=0?'#16a34a':'#dc2626'}
          bg={gananciaTotal>=0?'#f0fdf4':'#fef2f2'}
          sub={`${ganPctTotal>=0?'+':''}${ganPctTotal.toFixed(2)}% total`}/>
        <KpiCard emoji="🗂️" label="Tipos en portafolio"
          value={Object.keys(xTipo).length}
          color="#7c3aed" bg="#f5f3ff"
          sub="Nivel de diversificación"/>
      </div>

      {/* ── Distribución del portafolio ── */}
      {Object.keys(xTipo).length>0 && (
        <div style={{background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'16px 20px',marginBottom:22,boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:14,marginBottom:14}}>📊 Distribución del portafolio</div>
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            {Object.entries(xTipo).sort((a,b)=>b[1]-a[1]).map(([tipo,valor])=>{
              const t   = TIPO_MAP[tipo]||{emoji:'📦',label:tipo,color:'#64748b'}
              const pct = valorTotal>0?(valor/valorTotal*100):0
              return (
                <div key={tipo} style={{
                  padding:'6px 12px',borderRadius:20,
                  background:`${t.color}12`,color:t.color,
                  border:`1.5px solid ${t.color}30`,
                  fontSize:12,fontWeight:700,
                }}>
                  {t.emoji} {t.label} · {pct.toFixed(1)}%
                </div>
              )
            })}
          </div>
          {/* Barra apilada */}
          <div style={{height:14,borderRadius:999,overflow:'hidden',display:'flex',border:'1px solid var(--border)'}}>
            {Object.entries(xTipo).sort((a,b)=>b[1]-a[1]).map(([tipo,valor])=>{
              const t   = TIPO_MAP[tipo]||{color:'#64748b'}
              const pct = valorTotal>0?(valor/valorTotal*100):0
              return <div key={tipo} title={`${TIPO_MAP[tipo]?.label||tipo}: ${pct.toFixed(1)}%`}
                style={{width:`${pct}%`,background:t.color,transition:'width 0.5s'}}/>
            })}
          </div>
        </div>
      )}

      {/* ── Controles ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {FILTROS.map(f=>(
            <div key={f.v} onClick={()=>setFiltro(f.v)} style={{
              padding:'6px 13px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:700,
              background:filtro===f.v?'#16a34a':'white',
              color:filtro===f.v?'white':'var(--text2)',
              border:`1.5px solid ${filtro===f.v?'#16a34a':'var(--border)'}`,
              transition:'all 0.14s',
            }}>{f.label}</div>
          ))}
        </div>
        <button onClick={()=>setModal(true)} style={{
          background:'#16a34a',color:'white',border:'none',borderRadius:10,
          padding:'9px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Poppins',
          boxShadow:'0 3px 10px rgba(22,163,74,0.3)',
        }}>+ Añadir inversión</button>
      </div>

      {/* ── Lista ── */}
      {cargando?<Cargando/>:lista.length===0?(
        <EmptyState onNuevo={()=>setModal(true)}/>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {lista.map(inv=>(
            <InversionCard key={inv.id} inv={inv}
              onEditar={()=>setEditando(inv)}
              onEliminar={()=>eliminar(inv.id)}
              onActualizarPrecio={nuevoPrecio=>actualizarPrecio(inv,nuevoPrecio)}
              totalPortafolio={valorTotal}
            />
          ))}
        </div>
      )}

      {modal    && <InversionForm usuarioId={usuarioId} onClose={()=>setModal(false)} onGuardado={cargar}/>}
      {editando && <InversionForm usuarioId={usuarioId} inversion={editando} onClose={()=>setEditando(null)} onGuardado={cargar}/>}
    </div>
  )
}

// ── Tarjeta de inversión ───────────────────────────────────
function InversionCard({inv, onEditar, onEliminar, onActualizarPrecio, totalPortafolio}) {
  const [editandoPrecio, setEditandoPrecio] = useState(false)
  const [nuevoPrecio,    setNuevoPrecio]    = useState(inv.precio_actual||inv.valor_total||'')

  const tipo    = TIPO_MAP[inv.tipo]||{emoji:'📦',label:inv.tipo,color:'#16a34a'}
  const vt      = calcularValorTotal(inv)
  const gan     = ganancia(inv)
  const ganPct  = gananciaPct(inv)
  const cc      = costoCompra(inv)
  const pctPort = totalPortafolio>0 ? (vt/totalPortafolio*100) : 0
  const simbolo = inv.moneda==='USD'?'US$':'S/.'

  return (
    <div style={{
      background:'white',borderRadius:16,
      border:`1.5px solid ${tipo.color}25`,
      boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
      overflow:'hidden',
    }}>
      <div style={{padding:'16px 20px'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:14}}>

          {/* Ícono */}
          <div style={{
            width:48,height:48,borderRadius:13,flexShrink:0,
            background:`${tipo.color}15`,display:'flex',alignItems:'center',
            justifyContent:'center',fontSize:22,border:`1.5px solid ${tipo.color}30`,
          }}>{tipo.emoji}</div>

          {/* Info */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:5}}>
              <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:16}}>{inv.nombre}</span>
              {inv.ticker&&<span style={{fontSize:11,fontWeight:800,padding:'2px 7px',borderRadius:6,background:`${tipo.color}12`,color:tipo.color,fontFamily:'monospace'}}>{inv.ticker}</span>}
              <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:`${tipo.color}12`,color:tipo.color}}>{tipo.label}</span>
              {inv.plataforma&&<span style={{fontSize:11,color:'var(--text3)'}}>🏦 {inv.plataforma}</span>}
            </div>

            <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text2)',flexWrap:'wrap'}}>
              {inv.cantidad&&<span>Cantidad: <strong>{Number(inv.cantidad).toLocaleString('es-PE',{maximumFractionDigits:4})}</strong></span>}
              {inv.precio_compra&&<span>Compra: <strong>{simbolo} {Number(inv.precio_compra).toLocaleString('es-PE',{minimumFractionDigits:2})}</strong></span>}
              {inv.fecha_compra&&<span>📅 {fmtFecha(inv.fecha_compra)}</span>}
              <span style={{color:'var(--text3)'}}>Portafolio: <strong>{pctPort.toFixed(1)}%</strong></span>
            </div>

            {/* Ganancia */}
            {gan!==null&&(
              <div style={{
                display:'inline-flex',alignItems:'center',gap:6,
                marginTop:6,padding:'4px 10px',borderRadius:8,
                background:gan>=0?'#f0fdf4':'#fef2f2',
                border:`1px solid ${gan>=0?'#86efac':'#fca5a5'}`,
              }}>
                <span style={{fontSize:13}}>{gan>=0?'▲':'▼'}</span>
                <span style={{fontSize:12,fontWeight:700,color:gan>=0?'#16a34a':'#dc2626'}}>
                  {gan>=0?'+':''}{fmt(gan,inv.moneda)}
                  {ganPct!==null&&` (${ganPct>=0?'+':''}${ganPct.toFixed(2)}%)`}
                </span>
              </div>
            )}
          </div>

          {/* Valor actual */}
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:22,color:tipo.color,letterSpacing:'-0.5px'}}>
              {fmt(vt,inv.moneda)}
            </div>
            {cc&&<div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Invertido: {fmt(cc,inv.moneda)}</div>}
            {inv.precio_actual&&inv.cantidad&&(
              <div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                @ {simbolo} {Number(inv.precio_actual).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:4})}
              </div>
            )}
          </div>
        </div>

        {/* Barra de peso en portafolio */}
        <div style={{marginTop:12,marginBottom:10}}>
          <div style={{height:4,background:'var(--bg)',borderRadius:999,overflow:'hidden',border:'1px solid var(--border)'}}>
            <div style={{height:'100%',width:`${Math.min(pctPort,100)}%`,background:tipo.color,borderRadius:999,transition:'width 0.5s'}}/>
          </div>
        </div>

        {/* Acciones */}
        <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
          {/* Actualizar precio rápido */}
          {(inv.precio_actual||inv.valor_total)&&!editandoPrecio&&(
            <button onClick={()=>{setEditandoPrecio(true);setNuevoPrecio(inv.precio_actual||inv.valor_total)}} style={btnSec}>
              💱 Actualizar precio
            </button>
          )}
          <button onClick={onEditar} style={btnSec}>✏️ Editar</button>
          <button onClick={onEliminar} style={{...btnSec,color:'#dc2626',borderColor:'#fecaca',marginLeft:'auto'}}>🗑️</button>
        </div>

        {/* Panel actualización rápida precio */}
        {editandoPrecio&&(
          <div style={{marginTop:12,background:'var(--bg)',borderRadius:12,padding:'12px 14px',border:'1.5px solid var(--border)',display:'flex',gap:10,alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:700,color:'var(--text2)',whiteSpace:'nowrap'}}>
              {inv.cantidad?'Nuevo precio por unidad:':'Nuevo valor total:'}
            </span>
            <div style={{position:'relative',flex:1}}>
              <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:11,fontWeight:700,color:tipo.color}}>{simbolo}</span>
              <input type="number" value={nuevoPrecio} onChange={e=>setNuevoPrecio(e.target.value)}
                min="0" step="any" autoFocus
                style={{width:'100%',padding:'7px 8px 7px 30px',background:'white',border:`1.5px solid ${tipo.color}40`,borderRadius:8,fontSize:13,fontWeight:700,color:tipo.color,fontFamily:'Poppins',outline:'none',boxSizing:'border-box'}}/>
            </div>
            {inv.cantidad&&nuevoPrecio&&(
              <span style={{fontSize:12,fontWeight:700,color:tipo.color,whiteSpace:'nowrap'}}>
                = {fmt(Number(nuevoPrecio)*Number(inv.cantidad),inv.moneda)}
              </span>
            )}
            <button onClick={()=>{onActualizarPrecio(nuevoPrecio);setEditandoPrecio(false)}}
              style={{padding:'7px 13px',background:tipo.color,color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
              ✅ OK
            </button>
            <button onClick={()=>setEditandoPrecio(false)}
              style={{padding:'7px 10px',background:'white',border:'1.5px solid var(--border)',borderRadius:8,fontSize:12,cursor:'pointer'}}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({emoji,label,value,color,bg,sub}) {
  return (
    <div style={{background:bg,borderRadius:14,border:`1.5px solid ${color}30`,padding:18}}>
      <div style={{fontSize:22,marginBottom:6}}>{emoji}</div>
      <div style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3}}>{label}</div>
      <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:18,color,letterSpacing:'-0.5px',marginBottom:3}}>{value}</div>
      <div style={{fontSize:11,fontWeight:600,color:`${color}90`}}>{sub}</div>
    </div>
  )
}
function Cargando() {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {[1,2,3].map(i=><div key={i} style={{background:'white',borderRadius:12,height:100,border:'1.5px solid var(--border)',animation:'pulse 1.5s ease-in-out infinite'}}/>)}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
function EmptyState({onNuevo}) {
  return (
    <div style={{background:'white',borderRadius:16,border:'1.5px solid var(--border)',padding:'52px 24px',textAlign:'center'}}>
      <div style={{fontSize:52,marginBottom:12}}>📈</div>
      <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:18,marginBottom:6}}>Sin inversiones registradas</div>
      <div style={{fontSize:13,color:'var(--text3)',marginBottom:20,maxWidth:380,margin:'0 auto 20px',lineHeight:1.6}}>
        Registra tus acciones, ETFs, fondos mutuos, AFP, criptomonedas y negocios para ver el rendimiento de tu portafolio.
      </div>
      <button onClick={onNuevo} style={{background:'#16a34a',color:'white',border:'none',borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 3px 10px rgba(22,163,74,0.3)'}}>
        📈 Añadir primera inversión
      </button>
    </div>
  )
}
const btnSec={padding:'7px 12px',borderRadius:8,background:'var(--bg)',border:'1.5px solid var(--border)',fontSize:12,fontWeight:700,cursor:'pointer',color:'var(--text2)',fontFamily:'Poppins'}
