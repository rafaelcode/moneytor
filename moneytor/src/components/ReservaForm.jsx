import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIPOS_RESERVA, BANCOS_PERU } from '../lib/reservasUtils'

const EMPTY = {
  nombre: '', tipo: '', saldo_actual: '',
  moneda: 'PEN', banco: '', numero_cuenta: '', tasa_anual: '',
  meta_monto: '', contacto_nombre: '', contacto_email: '',
  fecha_devolucion: '', notas_admin: '', notas: '',
  color: '#2563eb', emoji: '🏦',
}

export default function ReservaForm({ usuarioId, reserva, onClose, onGuardado }) {
  const [form,    setForm]    = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const esEdicion = !!reserva

  useEffect(() => {
    if (reserva) setForm({ ...EMPTY, ...reserva })
  }, [reserva])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function seleccionarTipo(tipo) {
    const t = TIPOS_RESERVA.find(t => t.valor === tipo)
    setForm(f => ({ ...f, tipo, color: t.color, emoji: t.emoji }))
  }

  async function guardar() {
    setError('')
    if (!form.nombre.trim()) return setError('Escribe un nombre para esta reserva.')
    if (!form.tipo)          return setError('Selecciona el tipo de reserva.')
    if (form.saldo_actual === '' || isNaN(form.saldo_actual))
      return setError('Ingresa el saldo actual.')

    setLoading(true)
    const payload = {
      usuario_id:       usuarioId,
      nombre:           form.nombre.trim(),
      tipo:             form.tipo,
      saldo_actual:     Number(form.saldo_actual),
      moneda:           form.moneda,
      banco:            form.banco || null,
      numero_cuenta:    form.numero_cuenta || null,
      tasa_anual:       form.tasa_anual ? Number(form.tasa_anual) : null,
      meta_monto:       form.meta_monto ? Number(form.meta_monto) : null,
      contacto_nombre:  form.contacto_nombre || null,
      contacto_email:   form.contacto_email  || null,
      fecha_devolucion: form.fecha_devolucion || null,
      notas_admin:      form.notas_admin || null,
      notas:            form.notas || null,
      color:            form.color,
      emoji:            form.emoji,
      actualizado_en:   new Date().toISOString(),
    }

    let err
    if (esEdicion) {
      ;({ error: err } = await supabase.from('reservas').update(payload).eq('id', reserva.id))
    } else {
      ;({ error: err } = await supabase.from('reservas').insert({ ...payload, activa: true }))
    }

    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); console.error(err) }
    else     { onGuardado(); onClose() }
    setLoading(false)
  }

  const tipoSel = TIPOS_RESERVA.find(t => t.valor === form.tipo)
  const colorActivo = tipoSel?.color || '#2563eb'
  const esBanco     = ['cuenta_ahorros','cuenta_corriente'].includes(form.tipo)
  const esFondo     = form.tipo === 'fondo_emergencia'
  const esAdmin     = form.tipo === 'reserva_administrada'

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBase, maxWidth: 480 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:18 }}>
              {esEdicion ? '✏️ Editar reserva' : '🏦 Nueva reserva'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Registra el dinero que tienes disponible
            </div>
          </div>
          <div onClick={onClose} style={closeBtnStyle}>×</div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14, maxHeight:'72vh', overflowY:'auto', paddingRight:2 }}>

          {/* Tipo de reserva */}
          <div>
            <label style={lbl}>🏷️ ¿Qué tipo de reserva es?</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              {TIPOS_RESERVA.map(t => (
                <div key={t.valor} onClick={() => seleccionarTipo(t.valor)} style={{
                  padding:'10px 12px', borderRadius:10, cursor:'pointer',
                  border:`1.5px solid ${form.tipo===t.valor ? t.color : 'var(--border)'}`,
                  background: form.tipo===t.valor ? `${t.color}12` : 'var(--bg)',
                  transition:'all 0.12s',
                }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>{t.emoji}</div>
                  <div style={{
                    fontSize:12, fontWeight: form.tipo===t.valor ? 700 : 500,
                    color: form.tipo===t.valor ? t.color : 'var(--text2)',
                    marginBottom:2,
                  }}>{t.label}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', lineHeight:1.4 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label style={lbl}>📝 Nombre de esta reserva</label>
            <input value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder={
                form.tipo === 'cuenta_ahorros'       ? 'Ej: Cuenta BCP ahorros' :
                form.tipo === 'cuenta_corriente'      ? 'Ej: Cuenta corriente BBVA' :
                form.tipo === 'efectivo'              ? 'Ej: Billetera, Caja chica oficina' :
                form.tipo === 'fondo_emergencia'      ? 'Ej: Mi fondo de emergencia' :
                form.tipo === 'reserva_administrada'  ? 'Ej: Efectivo con mamá' :
                'Dale un nombre descriptivo'
              }
              style={inp} />
          </div>

          {/* Saldo + Moneda */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10 }}>
            <div>
              <label style={lbl}>💰 Saldo actual</label>
              <div style={{ position:'relative' }}>
                <span style={prefixStyle(colorActivo)}>
                  {form.moneda === 'USD' ? 'US$' : form.moneda === 'EUR' ? '€' : 'S/.'}
                </span>
                <input type="number" value={form.saldo_actual}
                  onChange={e => set('saldo_actual', e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...inp, paddingLeft:46, fontSize:18, fontWeight:700, color:colorActivo }} />
              </div>
            </div>
            <div>
              <label style={lbl}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                style={{ ...inp, width:80 }}>
                <option value="PEN">S/. PEN</option>
                <option value="USD">US$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
          </div>

          {/* Campos bancarios */}
          {esBanco && (
            <div style={{ background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:12, padding:14 }}>
              <label style={{ ...lbl, color:'#1d4ed8' }}>🏦 Datos bancarios</label>
              <div style={{ marginBottom:10 }}>
                <label style={{ ...lbl, fontSize:11 }}>Banco</label>
                <select value={form.banco} onChange={e => set('banco', e.target.value)} style={inp}>
                  <option value="">Selecciona un banco</option>
                  {BANCOS_PERU.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>N° de cuenta (opcional)</label>
                  <input value={form.numero_cuenta}
                    onChange={e => set('numero_cuenta', e.target.value)}
                    placeholder="••••••••" style={inp} />
                </div>
                {form.tipo === 'cuenta_ahorros' && (
                  <div>
                    <label style={{ ...lbl, fontSize:11 }}>Tasa anual % (opcional)</label>
                    <input type="number" value={form.tasa_anual}
                      onChange={e => set('tasa_anual', e.target.value)}
                      placeholder="Ej: 2.5" min="0" step="0.01" style={inp} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta fondo de emergencia */}
          {esFondo && (
            <div style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:12, padding:14 }}>
              <label style={{ ...lbl, color:'#6d28d9' }}>🎯 Meta del fondo</label>
              <div style={{ fontSize:12, color:'#6d28d9', marginBottom:8, fontWeight:500 }}>
                Se recomienda tener entre 3 y 6 meses de tus gastos fijos guardados.
              </div>
              <div style={{ position:'relative' }}>
                <span style={prefixStyle('#7c3aed')}>S/.</span>
                <input type="number" value={form.meta_monto}
                  onChange={e => set('meta_monto', e.target.value)}
                  placeholder="Ej: 15000" min="0" step="100"
                  style={{ ...inp, paddingLeft:46 }} />
              </div>
            </div>
          )}

          {/* Reserva administrada */}
          {esAdmin && (
            <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:12, padding:14 }}>
              <label style={{ ...lbl, color:'#92400e' }}>🤝 Persona que administra el dinero</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Nombre</label>
                  <input value={form.contacto_nombre}
                    onChange={e => set('contacto_nombre', e.target.value)}
                    placeholder="Nombre completo" style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize:11 }}>Email (opcional)</label>
                  <input type="email" value={form.contacto_email}
                    onChange={e => set('contacto_email', e.target.value)}
                    placeholder="correo@email.com" style={inp} />
                </div>
              </div>
              <div>
                <label style={{ ...lbl, fontSize:11 }}>Fecha esperada de devolución (opcional)</label>
                <input type="date" value={form.fecha_devolucion}
                  onChange={e => set('fecha_devolucion', e.target.value)} style={inp} />
              </div>
              <div style={{ marginTop:10 }}>
                <label style={{ ...lbl, fontSize:11 }}>Notas o condiciones</label>
                <textarea value={form.notas_admin}
                  onChange={e => set('notas_admin', e.target.value)}
                  placeholder="Ej: Para guardar mientras viajo, sin tocar salvo emergencia..."
                  rows={2} style={{ ...inp, resize:'vertical' }} />
              </div>
              <div style={{ marginTop:8, fontSize:11, color:'#92400e', fontWeight:500 }}>
                💡 A futuro, si esta persona usa MoneyTor podrás vincularlo como usuario y tener seguimiento compartido.
              </div>
            </div>
          )}

          {/* Notas generales */}
          <div>
            <label style={lbl}>📝 Notas (opcional)</label>
            <input value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Cualquier detalle adicional..." style={inp} />
          </div>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onClose} style={btnCancel}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{
            ...btnPrimary, background: loading ? '#d1d5db' : colorActivo,
          }}>
            {loading ? 'Guardando...' : esEdicion ? '💾 Guardar cambios' : '🏦 Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Estilos
const overlayStyle = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
  display:'flex', alignItems:'center', justifyContent:'center',
  zIndex:1000, padding:20,
}
const modalBase = {
  background:'white', borderRadius:20, border:'1.5px solid var(--border)',
  padding:'26px', width:'100%',
  boxShadow:'0 16px 48px rgba(0,0,0,0.15)',
}
const closeBtnStyle = {
  width:32, height:32, borderRadius:8, background:'var(--bg)',
  border:'1.5px solid var(--border)', display:'flex',
  alignItems:'center', justifyContent:'center',
  cursor:'pointer', fontSize:18, color:'var(--text3)',
}
export const lbl = {
  fontSize:12, fontWeight:700, color:'var(--text2)',
  display:'block', marginBottom:7,
}
export const inp = {
  width:'100%', padding:'10px 13px',
  background:'var(--bg)', border:'1.5px solid var(--border)',
  borderRadius:10, fontSize:13, color:'var(--text)',
  fontFamily:'Poppins', outline:'none', boxSizing:'border-box',
}
const prefixStyle = (color) => ({
  position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
  fontFamily:'Nunito', fontWeight:900, fontSize:14, color,
})
const errorBox = {
  background:'#fef2f2', border:'1.5px solid #fecaca', color:'#991b1b',
  borderRadius:10, padding:'10px 14px', fontSize:13, marginTop:12,
}
const btnCancel = {
  flex:1, padding:11, background:'var(--bg)',
  border:'1.5px solid var(--border)', borderRadius:10,
  fontSize:13, fontWeight:700, cursor:'pointer',
  color:'var(--text2)', fontFamily:'Poppins',
}
const btnPrimary = {
  flex:2, padding:11, border:'none', borderRadius:10,
  fontSize:13, fontWeight:700, cursor:'pointer',
  color:'white', fontFamily:'Poppins', transition:'all 0.15s',
}
