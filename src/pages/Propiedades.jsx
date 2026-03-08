import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  fmt, fmtFecha, TIPO_MAP, TIPOS_PROPIEDAD,
  patrimonioNeto, yieldBruto, plusvalia, plusvaliaPct, liquidezInfo,
} from '../lib/propiedadesUtils'
import PropiedadForm from '../components/PropiedadForm'

export default function Propiedades({ usuarioId }) {
  const [props,      setProps]      = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [filtro,     setFiltro]     = useState('todas')
  const [modal,      setModal]      = useState(false)
  const [editando,   setEditando]   = useState(null)
  const [revalId,    setRevalId]    = useState(null)
  const [revalMonto, setRevalMonto] = useState('')
  const [revalMotivo,setRevalMotivo]= useState('')
  const [detalleId,  setDetalleId]  = useState(null)
  const [historial,  setHistorial]  = useState({})

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('propiedades').select('*')
      .eq('usuario_id', usuarioId).eq('activa', true)
      .order('valor_estimado', { ascending: false })
    setProps(data || [])
    setCargando(false)
  }

  async function cargarHistorial(id) {
    if (historial[id]) return
    const { data } = await supabase
      .from('valorizaciones_propiedad').select('*')
      .eq('propiedad_id', id)
      .order('fecha', { ascending: false }).limit(10)
    setHistorial(prev => ({ ...prev, [id]: data || [] }))
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta propiedad?')) return
    await supabase.from('propiedades').update({ activa:false }).eq('id', id)
    cargar()
  }

  async function registrarRevalorizacion(p) {
    if (!revalMonto || Number(revalMonto) <= 0) return
    // Guardar historial
    await supabase.from('valorizaciones_propiedad').insert({
      propiedad_id:   p.id,
      usuario_id:     usuarioId,
      valor_anterior: p.valor_estimado,
      valor_nuevo:    Number(revalMonto),
      motivo:         revalMotivo || null,
      fecha:          new Date().toISOString().split('T')[0],
    })
    // Actualizar propiedad
    await supabase.from('propiedades').update({
      valor_estimado: Number(revalMonto),
      actualizado_en: new Date().toISOString(),
    }).eq('id', p.id)
    setRevalId(null); setRevalMonto(''); setRevalMotivo('')
    setHistorial(prev => ({ ...prev, [p.id]: undefined }))
    cargar()
  }

  // ── Totales dashboard ─────────────────────────────────────
  const activas          = props
  const valorTotal       = activas.reduce((s, p) => s + Number(p.valor_estimado || 0), 0)
  const deudaTotal       = activas.reduce((s, p) => s + Number(p.deuda_pendiente || 0), 0)
  const patrimonioTotal  = valorTotal - deudaTotal
  const realizables      = activas.filter(p => p.es_realizable)
  const valorRealizable  = realizables.reduce((s, p) => s + patrimonioNeto(p), 0)
  const rentaTotal       = activas.filter(p => p.genera_renta).reduce((s, p) => s + Number(p.renta_mensual || 0), 0)

  const FILTROS = [
    { v:'todas', label:'Todas' },
    ...TIPOS_PROPIEDAD.filter(t => activas.some(p => p.tipo===t.valor))
                      .map(t => ({ v:t.valor, label:`${t.emoji} ${t.label}` })),
  ]
  const lista = filtro==='todas' ? activas : activas.filter(p => p.tipo===filtro)

  return (
    <div style={{ padding:28 }}>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        <KpiCard emoji="🏠" label="Valor total activos" value={fmt(valorTotal)} color="#7c3aed" bg="#f5f3ff"
          sub={`${activas.length} propiedad${activas.length!==1?'es':''}`} />
        <KpiCard emoji="💎" label="Patrimonio neto" value={fmt(patrimonioTotal)} color="#2563eb" bg="#eff6ff"
          sub={deudaTotal>0 ? `Deuda: ${fmt(deudaTotal)}` : 'Sin deudas sobre activos'} />
        <KpiCard emoji="💡" label="Patrimonio realizable" value={fmt(valorRealizable)} color="#16a34a" bg="#f0fdf4"
          sub={`${realizables.length} activo${realizables.length!==1?'s':''} que podrías liquidar`} />
        <KpiCard emoji="💵" label="Renta mensual total" value={rentaTotal>0 ? fmt(rentaTotal) : '—'} color="#d97706" bg="#fffbeb"
          sub={rentaTotal>0 ? `${fmt(rentaTotal*12)}/año` : 'Sin propiedades en alquiler'} />
      </div>

      {/* ── Banner explicativo ── */}
      <div style={{
        background:'linear-gradient(135deg, #eff6ff, #f5f3ff)',
        border:'1.5px solid #bfdbfe', borderRadius:14,
        padding:'14px 18px', marginBottom:22,
        display:'flex', alignItems:'flex-start', gap:12,
      }}>
        <span style={{ fontSize:24, flexShrink:0 }}>💡</span>
        <div style={{ fontSize:12, color:'#1e3a5f', lineHeight:1.7 }}>
          <strong>¿Cuándo contar una propiedad como fondo de respaldo?</strong><br/>
          Solo cuando podrías venderla o hipotecarla en caso de necesidad real.
          Tu vivienda principal generalmente <em>no</em> cuenta — perderías donde vivir.
          Las propiedades marcadas como "realizables" aparecen en tu <strong>patrimonio realizable</strong> (S/. {fmt(valorRealizable).replace('S/. ','').replace('.00','')}).
        </div>
      </div>

      {/* ── Filtros + botón ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {FILTROS.map(f => (
            <div key={f.v} onClick={() => setFiltro(f.v)} style={{
              padding:'6px 13px', borderRadius:20, cursor:'pointer',
              fontSize:12, fontWeight:700,
              background: filtro===f.v ? '#7c3aed':'white',
              color:       filtro===f.v ? 'white':'var(--text2)',
              border:`1.5px solid ${filtro===f.v ? '#7c3aed':'var(--border)'}`,
              transition:'all 0.14s',
            }}>{f.label}</div>
          ))}
        </div>
        <button onClick={() => setModal(true)} style={{
          background:'#7c3aed', color:'white', border:'none',
          borderRadius:10, padding:'9px 18px', fontSize:13,
          fontWeight:700, cursor:'pointer', fontFamily:'Poppins',
          boxShadow:'0 3px 10px rgba(124,58,237,0.3)',
        }}>+ Registrar propiedad</button>
      </div>

      {/* ── Lista ── */}
      {cargando ? <Cargando /> : lista.length===0 ? (
        <EmptyState onNuevo={() => setModal(true)} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {lista.map(p => (
            <PropiedadCard
              key={p.id}
              p={p}
              onEditar={()  => setEditando(p)}
              onEliminar={()=> eliminar(p.id)}
              onRevaluar={()=> { setRevalId(p.id); setRevalMonto(p.valor_estimado) }}
              onDetalle={()  => {
                const nuevo = detalleId===p.id ? null : p.id
                setDetalleId(nuevo)
                if (nuevo) cargarHistorial(nuevo)
              }}
              abierto={detalleId===p.id}
              historial={historial[p.id] || []}
              // Modal revalorización inline
              revalAbierto={revalId===p.id}
              revalMonto={revalMonto}
              revalMotivo={revalMotivo}
              onRevalMonto={setRevalMonto}
              onRevalMotivo={setRevalMotivo}
              onRevalConfirm={() => registrarRevalorizacion(p)}
              onRevalCancel={() => { setRevalId(null); setRevalMonto(''); setRevalMotivo('') }}
            />
          ))}
        </div>
      )}

      {modal    && <PropiedadForm usuarioId={usuarioId} onClose={() => setModal(false)}    onGuardado={cargar} />}
      {editando && <PropiedadForm usuarioId={usuarioId} propiedad={editando} onClose={() => setEditando(null)} onGuardado={cargar} />}
    </div>
  )
}

// ── Tarjeta ────────────────────────────────────────────────
function PropiedadCard({ p, onEditar, onEliminar, onRevaluar, onDetalle, abierto, historial,
  revalAbierto, revalMonto, revalMotivo, onRevalMonto, onRevalMotivo, onRevalConfirm, onRevalCancel }) {

  const tipo      = TIPO_MAP[p.tipo] || { emoji:'🏠', label:p.tipo, color:'#7c3aed' }
  const patNeto   = patrimonioNeto(p)
  const yld       = yieldBruto(p)
  const pv        = plusvalia(p)
  const pvPct     = plusvaliaPct(p)
  const liq       = liquidezInfo(p.es_realizable ? p.liquidez_estimada_dias : null)
  const simbolo   = p.moneda==='USD' ? 'US$' : 'S/.'

  return (
    <div style={{
      background:'white', borderRadius:18,
      border:`1.5px solid ${abierto ? tipo.color+'50':'var(--border)'}`,
      boxShadow:'0 2px 10px rgba(0,0,0,0.06)',
      overflow:'hidden',
    }}>
      <div style={{ padding:'18px 20px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>

          {/* Ícono */}
          <div style={{
            width:50, height:50, borderRadius:14, flexShrink:0,
            background:`${tipo.color}15`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:24, border:`1.5px solid ${tipo.color}30`,
          }}>{tipo.emoji}</div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:5 }}>
              <span style={{ fontFamily:'Nunito', fontWeight:900, fontSize:16 }}>{p.nombre}</span>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${tipo.color}12`, color:tipo.color }}>{tipo.label}</span>
              {p.es_vivienda_propia && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#eff6ff', color:'#2563eb' }}>🏠 Vivienda propia</span>}
              {p.es_realizable && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${liq.color}12`, color:liq.color }}>{liq.emoji} {liq.label}</span>}
              {!p.tiene_escritura && <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'#fef3c7', color:'#92400e' }}>⚠️ Sin escritura</span>}
              {!p.tiene_seguro    && <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'#fef2f2', color:'#dc2626' }}>🛡️ Sin seguro</span>}
            </div>

            <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, color:'var(--text2)' }}>
              {p.ciudad && <span>📍 {p.ciudad}{p.pais ? `, ${p.pais}`:''}</span>}
              {p.fecha_adquisicion && <span>📅 Desde {fmtFecha(p.fecha_adquisicion)}</span>}
              {p.genera_renta && p.renta_mensual && (
                <span style={{ color:'#16a34a', fontWeight:700 }}>
                  💵 Renta: {fmt(p.renta_mensual, p.renta_moneda)}/mes
                  {yld && ` (${yld.toFixed(2)}% yield)`}
                </span>
              )}
            </div>

            {/* Plusvalía */}
            {pv !== null && (
              <div style={{ marginTop:6, fontSize:12, fontWeight:600, color: pv>=0?'#16a34a':'#dc2626' }}>
                📈 Plusvalía: {pv>=0?'+':''}{fmt(pv, p.moneda)}
                {pvPct && ` (${pvPct>=0?'+':''}${pvPct.toFixed(1)}%)`}
                <span style={{ color:'var(--text3)', fontWeight:400, marginLeft:6 }}>
                  vs compra {fmt(p.valor_compra, p.moneda)}
                </span>
              </div>
            )}
          </div>

          {/* Valores */}
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:24, color:tipo.color, letterSpacing:'-1px' }}>
              {fmt(p.valor_estimado, p.moneda)}
            </div>
            {p.tiene_deuda && p.deuda_pendiente && (
              <div style={{ fontSize:12, color:'#ef4444', fontWeight:600 }}>
                Deuda: -{fmt(p.deuda_pendiente, p.moneda)}
              </div>
            )}
            <div style={{ fontSize:13, fontWeight:700, color: patNeto>=0?'#2563eb':'#dc2626', marginTop:2 }}>
              Neto: {fmt(patNeto, p.moneda)}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
              {new Date(p.actualizado_en).toLocaleDateString('es-PE')}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display:'flex', gap:7, marginTop:14, flexWrap:'wrap' }}>
          <button onClick={onRevaluar} style={btnPrimario(tipo.color)}>
            📈 Actualizar valor
          </button>
          <button onClick={onEditar}  style={btnSec}>✏️ Editar</button>
          <button onClick={onDetalle} style={btnSec}>{abierto?'▲ Ocultar':'▼ Historial'}</button>
          <button onClick={onEliminar} style={btnDanger}>🗑️</button>
        </div>
      </div>

      {/* ── Panel revalorización ── */}
      {revalAbierto && (
        <div style={{ borderTop:'1.5px solid var(--border)', background:'#f5f3ff', padding:'16px 20px' }}>
          <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:14, marginBottom:12, color:'#6d28d9' }}>
            📈 Actualizar valor estimado
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr auto auto', gap:10, alignItems:'flex-end' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:6 }}>Nuevo valor</div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontFamily:'Nunito', fontWeight:900, fontSize:13, color:'#7c3aed' }}>{simbolo}</span>
                <input type="number" value={revalMonto} onChange={e => onRevalMonto(e.target.value)}
                  min="0" style={{ width:'100%', padding:'9px 11px 9px 38px', background:'white', border:'1.5px solid #c4b5fd', borderRadius:10, fontSize:14, fontWeight:700, color:'#7c3aed', fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:6 }}>Motivo (opcional)</div>
              <input value={revalMotivo} onChange={e => onRevalMotivo(e.target.value)}
                placeholder="Ej: Tasación, oferta recibida, mercado..."
                style={{ width:'100%', padding:'9px 11px', background:'white', border:'1.5px solid #c4b5fd', borderRadius:10, fontSize:12, fontFamily:'Poppins', outline:'none', boxSizing:'border-box' }} />
            </div>
            <button onClick={onRevalConfirm} style={{ padding:'9px 16px', background:'#7c3aed', color:'white', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              ✅ Confirmar
            </button>
            <button onClick={onRevalCancel} style={{ padding:'9px 12px', background:'white', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, cursor:'pointer', color:'var(--text3)' }}>
              ✕
            </button>
          </div>
          {revalMonto && (
            <div style={{ marginTop:10, fontSize:12, color:'#6d28d9', fontWeight:600 }}>
              Cambio: {Number(revalMonto) >= Number(p.valor_estimado) ? '▲' : '▼'}{' '}
              <span style={{ color: Number(revalMonto)>=Number(p.valor_estimado)?'#16a34a':'#dc2626' }}>
                {fmt(Math.abs(Number(revalMonto)-Number(p.valor_estimado)), p.moneda)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Historial ── */}
      {abierto && (
        <div style={{ borderTop:'1.5px solid var(--border)', background:'var(--bg)', padding:'14px 20px' }}>
          <div style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13, marginBottom:10 }}>
            📋 Historial de valorizaciones
          </div>
          {historial.length===0 ? (
            <div style={{ fontSize:13, color:'var(--text3)' }}>Sin cambios de valor registrados.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {historial.map(h => {
                const sube = Number(h.valor_nuevo) >= Number(h.valor_anterior)
                return (
                  <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, background:'white', borderRadius:8, padding:'8px 12px', border:'1px solid var(--border)', fontSize:13 }}>
                    <span style={{ color: sube?'#16a34a':'#dc2626', fontSize:16 }}>{sube?'▲':'▼'}</span>
                    <span style={{ color:'var(--text3)', fontSize:12, fontWeight:600, minWidth:90 }}>
                      {new Date(h.fecha+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})}
                    </span>
                    <span style={{ flex:1, color:'var(--text2)', fontSize:12 }}>{h.motivo || 'Actualización de valor'}</span>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>{fmt(h.valor_anterior,'PEN')} →</span>
                    <span style={{ fontFamily:'Nunito', fontWeight:800, fontSize:14, color: sube?'#16a34a':'#dc2626' }}>
                      {fmt(h.valor_nuevo,'PEN')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

// ── Helpers UI ────────────────────────────────────────────
function KpiCard({ emoji, label, value, color, bg, sub }) {
  return (
    <div style={{ background:bg, borderRadius:14, border:`1.5px solid ${color}30`, padding:18 }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{emoji}</div>
      <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, color, letterSpacing:'-0.5px', marginBottom:3 }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:`${color}90` }}>{sub}</div>
    </div>
  )
}
function Cargando() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {[1,2].map(i=>(
        <div key={i} style={{ background:'white', borderRadius:16, height:120, border:'1.5px solid var(--border)', animation:'pulse 1.5s ease-in-out infinite' }}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
function EmptyState({ onNuevo }) {
  return (
    <div style={{ background:'white', borderRadius:16, border:'1.5px solid var(--border)', padding:'52px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:12 }}>🏠</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18, marginBottom:6 }}>Sin propiedades registradas</div>
      <div style={{ fontSize:13, color:'var(--text3)', marginBottom:20, maxWidth:400, margin:'0 auto 20px', lineHeight:1.6 }}>
        Registra tus inmuebles, vehículos y otros activos físicos para conocer tu patrimonio real y cuánto podrías liquidar en una emergencia.
      </div>
      <button onClick={onNuevo} style={{ background:'#7c3aed', color:'white', border:'none', borderRadius:10, padding:'10px 22px', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 3px 10px rgba(124,58,237,0.3)' }}>
        🏠 Registrar primera propiedad
      </button>
    </div>
  )
}
const btnPrimario = color => ({ padding:'7px 14px', borderRadius:8, border:'none', background:color, color:'white', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Poppins', boxShadow:`0 2px 8px ${color}30` })
const btnSec    = { padding:'7px 12px', borderRadius:8, background:'var(--bg)', border:'1.5px solid var(--border)', fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--text2)', fontFamily:'Poppins' }
const btnDanger = { padding:'7px 10px', borderRadius:8, background:'#fef2f2', border:'1.5px solid #fecaca', fontSize:12, fontWeight:700, cursor:'pointer', color:'#dc2626', fontFamily:'Poppins', marginLeft:'auto' }
