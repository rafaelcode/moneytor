import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_INVERSION, PLATAFORMAS, fmt, calcularValorTotal, ganancia, gananciaPct } from '../lib/inversionesUtils'

const EMPTY = {
  nombre:'', tipo:'', ticker:'', moneda:'USD',
  cantidad:'', precio_compra:'', precio_actual:'',
  valor_total:'', plataforma:'', fecha_compra:'', notas:'',
}

export default function InversionForm({ usuarioId, inversion, onClose, onGuardado }) {
  const [form,    setForm]    = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const esEdicion = !!inversion

  useEffect(() => { if (inversion) setForm({ ...EMPTY, ...inversion }) }, [inversion])

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  const tipo = TIPOS_INVERSION.find(t=>t.valor===form.tipo)
  const color = tipo?.color||'#0891b2'
  const usaPrecio = ['acciones','etf','cripto'].includes(form.tipo)
  const usaCuotas = ['fondo_mutuo','afp'].includes(form.tipo)
  const usaValorTotal = ['negocio','otro'].includes(form.tipo)
  const simbolo = form.moneda==='USD'?'US$':form.moneda==='EUR'?'€':'S/.'

  // Cálculos en tiempo real
  const valorActual = usaPrecio&&form.precio_actual&&form.cantidad
    ? Number(form.precio_actual)*Number(form.cantidad) : null
  const valorCompra = usaPrecio&&form.precio_compra&&form.cantidad
    ? Number(form.precio_compra)*Number(form.cantidad) : null
  const gan = valorActual&&valorCompra ? valorActual-valorCompra : null
  const ganPct = valorCompra&&valorCompra>0&&gan!==null ? (gan/valorCompra)*100 : null

  // Para fondos: valor cuota × cuotas
  const valorFondo = usaCuotas&&form.precio_actual&&form.cantidad
    ? Number(form.precio_actual)*Number(form.cantidad) : null

  async function guardar() {
    setError('')
    if (!form.nombre.trim()) return setError('Escribe un nombre.')
    if (!form.tipo)          return setError('Selecciona el tipo.')

    // Validar según tipo
    if (usaPrecio && (!form.cantidad||!form.precio_actual))
      return setError('Ingresa la cantidad y el precio actual.')
    if (usaCuotas && (!form.cantidad||!form.precio_actual))
      return setError('Ingresa el número de cuotas y el valor de cuota.')
    if (usaValorTotal && !form.valor_total)
      return setError('Ingresa el valor estimado.')

    setLoading(true)
    const vtotal = usaPrecio||usaCuotas
      ? Number(form.precio_actual)*Number(form.cantidad)
      : Number(form.valor_total||0)

    const payload = {
      usuario_id:     usuarioId,
      nombre:         form.nombre.trim(),
      tipo:           form.tipo,
      ticker:         form.ticker||null,
      cantidad:       form.cantidad ? Number(form.cantidad) : null,
      precio_compra:  form.precio_compra ? Number(form.precio_compra) : null,
      precio_actual:  form.precio_actual ? Number(form.precio_actual) : null,
      valor_total:    vtotal||null,
      moneda:         form.moneda,
      plataforma:     form.plataforma||null,
      fecha_compra:   form.fecha_compra||null,
      notas:          form.notas||null,
      activa:         true,
      actualizado_en: new Date().toISOString(),
    }

    let err
    if (esEdicion) {
      ;({error:err} = await supabase.from('inversiones').update(payload).eq('id',inversion.id))
    } else {
      ;({error:err} = await supabase.from('inversiones').insert(payload))
    }

    if (err) { setError('No se pudo guardar.'); console.error(err) }
    else     { onGuardado(); onClose() }
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e=>e.stopPropagation()} style={modal}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:18}}>
              {esEdicion?'✏️ Editar inversión':'📈 Nueva inversión'}
            </div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:1}}>Registra activos financieros</div>
          </div>
          <div onClick={onClose} style={closeBtn}>×</div>
        </div>

        <div style={{maxHeight:'72vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:14,paddingRight:2}}>

          {/* Tipo */}
          <div>
            <label style={lbl}>🏷️ Tipo de inversión</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>
              {TIPOS_INVERSION.map(t=>(
                <div key={t.valor} onClick={()=>set('tipo',t.valor)} style={{
                  padding:'10px 6px',borderRadius:11,cursor:'pointer',textAlign:'center',
                  border:`1.5px solid ${form.tipo===t.valor?t.color:'var(--border)'}`,
                  background: form.tipo===t.valor?`${t.color}12`:'var(--bg)',
                  transition:'all 0.12s',
                }}>
                  <div style={{fontSize:18,marginBottom:3}}>{t.emoji}</div>
                  <div style={{fontSize:10,fontWeight:form.tipo===t.valor?700:500,color:form.tipo===t.valor?t.color:'var(--text2)',lineHeight:1.3}}>{t.label}</div>
                </div>
              ))}
            </div>
            {tipo&&<div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>{tipo.desc}</div>}
          </div>

          {/* Nombre + Ticker */}
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10}}>
            <div>
              <label style={lbl}>📝 Nombre</label>
              <input value={form.nombre} onChange={e=>set('nombre',e.target.value)}
                placeholder={
                  form.tipo==='acciones'?'Ej: Apple Inc.':
                  form.tipo==='cripto'?'Ej: Bitcoin':
                  form.tipo==='negocio'?'Ej: Participación Empresa XYZ':
                  form.tipo==='afp'?'Ej: AFP Prima — Fondo 2':
                  'Nombre de la inversión'
                }
                style={inp} />
            </div>
            {(usaPrecio||usaCuotas) && (
              <div style={{minWidth:90}}>
                <label style={lbl}>Ticker / Código</label>
                <input value={form.ticker} onChange={e=>set('ticker',e.target.value.toUpperCase())}
                  placeholder="AAPL" style={inp} />
              </div>
            )}
          </div>

          {/* Moneda + Plataforma */}
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:10}}>
            <div>
              <label style={lbl}>Moneda</label>
              <select value={form.moneda} onChange={e=>set('moneda',e.target.value)} style={{...inp,width:100}}>
                <option value="USD">US$ USD</option>
                <option value="PEN">S/. PEN</option>
              </select>
            </div>
            <div>
              <label style={lbl}>🏦 Plataforma / Broker</label>
              <select value={form.plataforma} onChange={e=>set('plataforma',e.target.value)} style={inp}>
                <option value="">Selecciona</option>
                {PLATAFORMAS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* ── Campos según tipo ── */}

          {/* Acciones, ETF, Cripto */}
          {usaPrecio && (
            <div style={{background:`${color}08`,border:`1.5px solid ${color}25`,borderRadius:14,padding:16}}>
              <label style={{...lbl,color}}>📊 Posición</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                <div>
                  <label style={{...lbl,fontSize:11}}>Cantidad / Unidades</label>
                  <input type="number" value={form.cantidad} onChange={e=>set('cantidad',e.target.value)}
                    placeholder="Ej: 10" min="0" step="any" style={inp} />
                </div>
                <div>
                  <label style={{...lbl,fontSize:11}}>Precio de compra</label>
                  <div style={{position:'relative'}}>
                    <span style={pfx(color)}>{simbolo}</span>
                    <input type="number" value={form.precio_compra} onChange={e=>set('precio_compra',e.target.value)}
                      placeholder="0.00" min="0" step="any"
                      style={{...inp,paddingLeft:42}} />
                  </div>
                </div>
                <div>
                  <label style={{...lbl,fontSize:11}}>Precio actual</label>
                  <div style={{position:'relative'}}>
                    <span style={pfx(color)}>{simbolo}</span>
                    <input type="number" value={form.precio_actual} onChange={e=>set('precio_actual',e.target.value)}
                      placeholder="0.00" min="0" step="any"
                      style={{...inp,paddingLeft:42}} />
                  </div>
                </div>
              </div>

              {/* Resumen en tiempo real */}
              {valorActual!==null && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  {[
                    {label:'Costo de compra', value:fmt(valorCompra,form.moneda), color:'var(--text2)'},
                    {label:'Valor actual',     value:fmt(valorActual,form.moneda), color},
                    {label:'Ganancia/Pérdida', value:`${gan>=0?'+':''}${fmt(gan,form.moneda)} (${ganPct>=0?'+':''}${ganPct?.toFixed(1)}%)`, color:gan>=0?'#16a34a':'#dc2626'},
                  ].map((r,i)=>(
                    <div key={i} style={{background:'white',borderRadius:10,padding:'9px 12px',textAlign:'center'}}>
                      <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,marginBottom:3}}>{r.label}</div>
                      <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:13,color:r.color}}>{r.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fondo mutuo, AFP */}
          {usaCuotas && (
            <div style={{background:`${color}08`,border:`1.5px solid ${color}25`,borderRadius:14,padding:16}}>
              <label style={{...lbl,color}}>📊 Posición en el fondo</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{...lbl,fontSize:11}}>Número de cuotas</label>
                  <input type="number" value={form.cantidad} onChange={e=>set('cantidad',e.target.value)}
                    placeholder="Ej: 1250.33" min="0" step="any" style={inp} />
                </div>
                <div>
                  <label style={{...lbl,fontSize:11}}>Valor cuota actual</label>
                  <div style={{position:'relative'}}>
                    <span style={pfx(color)}>{simbolo}</span>
                    <input type="number" value={form.precio_actual} onChange={e=>set('precio_actual',e.target.value)}
                      placeholder="0.0000" min="0" step="any"
                      style={{...inp,paddingLeft:42}} />
                  </div>
                </div>
              </div>
              {valorFondo!==null && (
                <div style={{marginTop:12,background:'white',borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>💰 Valor total del fondo</span>
                  <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:18,color}}>{fmt(valorFondo,form.moneda)}</span>
                </div>
              )}
            </div>
          )}

          {/* Negocio, Otro */}
          {usaValorTotal && (
            <div style={{background:`${color}08`,border:`1.5px solid ${color}25`,borderRadius:14,padding:16}}>
              <label style={{...lbl,color}}>💰 Valor estimado</label>
              <div style={{position:'relative'}}>
                <span style={pfx(color)}>{simbolo}</span>
                <input type="number" value={form.valor_total} onChange={e=>set('valor_total',e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  style={{...inp,paddingLeft:42,fontSize:18,fontWeight:700,color}} />
              </div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>
                Ingresa tu estimación del valor de mercado o tu participación.
              </div>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label style={lbl}>📅 Fecha de compra / inicio (opcional)</label>
            <input type="date" value={form.fecha_compra} onChange={e=>set('fecha_compra',e.target.value)} style={inp} />
          </div>

          {/* Notas */}
          <div>
            <label style={lbl}>📝 Notas (opcional)</label>
            <input value={form.notas} onChange={e=>set('notas',e.target.value)}
              placeholder="Estrategia, recordatorios, condiciones especiales..." style={inp} />
          </div>
        </div>

        {error&&<div style={errorBox}>{error}</div>}

        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button onClick={onClose} style={btnCan}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{...btnPri,background:loading?'#d1d5db':color}}>
            {loading?'Guardando...':esEdicion?'💾 Guardar cambios':'📈 Registrar inversión'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = {position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}
const modal   = {background:'white',borderRadius:20,border:'1.5px solid var(--border)',padding:'26px',width:'100%',maxWidth:520,boxShadow:'0 16px 48px rgba(0,0,0,0.15)'}
const closeBtn= {width:32,height:32,borderRadius:8,background:'var(--bg)',border:'1.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:18,color:'var(--text3)',flexShrink:0}
const lbl     = {fontSize:12,fontWeight:700,color:'var(--text2)',display:'block',marginBottom:7}
const inp     = {width:'100%',padding:'10px 13px',background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:10,fontSize:13,color:'var(--text)',fontFamily:'Poppins',outline:'none',boxSizing:'border-box'}
const pfx     = c=>({position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontFamily:'Nunito',fontWeight:900,fontSize:13,color:c})
const errorBox= {background:'#fef2f2',border:'1.5px solid #fecaca',color:'#991b1b',borderRadius:10,padding:'10px 14px',fontSize:13,marginTop:12}
const btnCan  = {flex:1,padding:11,background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',color:'var(--text2)',fontFamily:'Poppins'}
const btnPri  = {flex:2,padding:11,border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',color:'white',fontFamily:'Poppins',transition:'all 0.15s'}
