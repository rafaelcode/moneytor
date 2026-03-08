import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, MESES, rangoMes, saludFinanciera, CAT_MAP } from '../lib/flujoUtils'

export default function FlujoDashboard({ usuarioId, onNavigate, onRegistrar }) {
  const hoy     = new Date()
  const mesAct  = hoy.getMonth() + 1
  const anioAct = hoy.getFullYear()

  const [datos6m,  setDatos6m]  = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    // Últimos 6 meses
    const meses = []
    for (let i = 5; i >= 0; i--) {
      let m = mesAct - i, a = anioAct
      if (m <= 0) { m += 12; a -= 1 }
      meses.push({ mes: m, anio: a })
    }

    const resultados = await Promise.all(
      meses.map(async ({ mes, anio }) => {
        const { desde, hasta } = rangoMes(anio, mes)
        const { data } = await supabase
          .from('transacciones')
          .select('tipo, monto, categoria')
          .eq('usuario_id', usuarioId)
          .gte('fecha', desde).lte('fecha', hasta)
        const txs       = data || []
        const ingresos  = txs.filter(t => t.tipo === 'ingreso').reduce((s,t) => s + Number(t.monto), 0)
        const gastos    = txs.filter(t => t.tipo === 'gasto').reduce((s,t) => s + Number(t.monto), 0)
        return { mes, anio, ingresos, gastos, balance: ingresos - gastos, txs }
      })
    )
    setDatos6m(resultados)
    setCargando(false)
  }

  const mesActual   = datos6m[datos6m.length - 1] || { ingresos:0, gastos:0, balance:0, txs:[] }
  const mesAnterior = datos6m[datos6m.length - 2] || { ingresos:0, gastos:0, balance:0 }
  const salud       = saludFinanciera(mesActual.ingresos, mesActual.gastos)
  const tasaAhorro  = mesActual.ingresos > 0
    ? ((mesActual.balance / mesActual.ingresos) * 100).toFixed(1)
    : 0

  // Variación mes a mes
  function variacion(actual, anterior) {
    if (!anterior) return null
    const pct = ((actual - anterior) / anterior * 100).toFixed(1)
    return { pct, sube: actual >= anterior }
  }
  const varIng = variacion(mesActual.ingresos, mesAnterior.ingresos)
  const varGas = variacion(mesActual.gastos,   mesAnterior.gastos)

  // Top categorías gastos del mes
  const gastosXCat = {}
  mesActual.txs?.filter(t => t.tipo === 'gasto').forEach(t => {
    gastosXCat[t.categoria] = (gastosXCat[t.categoria] || 0) + Number(t.monto)
  })
  const topCats = Object.entries(gastosXCat)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)

  // Máximo para escalar barras
  const maxVal = Math.max(...datos6m.map(d => Math.max(d.ingresos, d.gastos)), 1)

  if (cargando) return (
    <div style={{ padding:28, display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{ fontSize:13, color:'var(--text3)' }}>Cargando datos...</div>
    </div>
  )

  return (
    <div style={{ padding:28 }}>

      {/* ── KPIs principales ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>

        <KpiCard emoji={salud.emoji} label="Salud financiera"
          value={salud.label} color={salud.color}
          bg={`${salud.color}12`}
          sub={`Gastas el ${mesActual.ingresos > 0 ? ((mesActual.gastos/mesActual.ingresos)*100).toFixed(0) : 0}% de lo que entra`}
        />

        <KpiCard emoji="↑" label="Ingresos del mes"
          value={fmt(mesActual.ingresos)} color="#16a34a" bg="#f0fdf4"
          sub={varIng ? `${varIng.sube?'▲':'▼'} ${Math.abs(varIng.pct)}% vs mes anterior` : 'primer mes'}
          subColor={varIng?.sube ? '#16a34a' : '#dc2626'}
        />

        <KpiCard emoji="↓" label="Gastos del mes"
          value={fmt(mesActual.gastos)} color="#dc2626" bg="#fef2f2"
          sub={varGas ? `${varGas.sube?'▲':'▼'} ${Math.abs(varGas.pct)}% vs mes anterior` : 'primer mes'}
          subColor={varGas?.sube ? '#dc2626' : '#16a34a'}
        />

        <KpiCard
          emoji={Number(tasaAhorro) >= 20 ? '🐷' : '⚠️'}
          label="Tasa de ahorro"
          value={`${tasaAhorro}%`}
          color={Number(tasaAhorro) >= 20 ? '#7c3aed' : Number(tasaAhorro) >= 0 ? '#d97706' : '#dc2626'}
          bg={Number(tasaAhorro) >= 20 ? '#f5f3ff' : '#fffbeb'}
          sub={Number(tasaAhorro) >= 20 ? '✅ Meta del 20% alcanzada' : 'Meta recomendada: 20%'}
        />
      </div>

      {/* ── Gráfico 6 meses ── */}
      <div style={{
        background:'white', borderRadius:16,
        border:'1.5px solid var(--border)',
        padding:'18px 22px', marginBottom:22,
        boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:15 }}>
              📊 Ingresos vs Gastos — últimos 6 meses
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              Balance acumulado: <strong style={{ color: datos6m.reduce((s,d)=>s+d.balance,0) >= 0 ? '#16a34a':'#dc2626' }}>
                {fmt(datos6m.reduce((s,d) => s + d.balance, 0))}
              </strong>
            </div>
          </div>
          <div style={{ display:'flex', gap:16, fontSize:12 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10,height:10,borderRadius:3,background:'#16a34a',display:'inline-block'}}/>
              Ingresos
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10,height:10,borderRadius:3,background:'#dc2626',display:'inline-block'}}/>
              Gastos
            </span>
          </div>
        </div>

        {/* Barras */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160 }}>
          {datos6m.map((d, i) => {
            const hIng = maxVal > 0 ? (d.ingresos / maxVal) * 140 : 0
            const hGas = maxVal > 0 ? (d.gastos   / maxVal) * 140 : 0
            const esMesActual = i === datos6m.length - 1
            return (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:140 }}>
                  {/* Barra ingresos */}
                  <div title={fmt(d.ingresos)} style={{
                    width:16, height: Math.max(hIng, 3),
                    background: esMesActual ? '#16a34a' : '#86efac',
                    borderRadius:'4px 4px 0 0',
                    transition:'height 0.5s',
                    cursor:'default',
                  }}/>
                  {/* Barra gastos */}
                  <div title={fmt(d.gastos)} style={{
                    width:16, height: Math.max(hGas, 3),
                    background: esMesActual ? '#dc2626' : '#fca5a5',
                    borderRadius:'4px 4px 0 0',
                    transition:'height 0.5s',
                    cursor:'default',
                  }}/>
                </div>
                <div style={{
                  fontSize:10, fontWeight: esMesActual ? 800 : 500,
                  color: esMesActual ? 'var(--text)' : 'var(--text3)',
                  textAlign:'center',
                }}>
                  {MESES[d.mes-1].slice(0,3)}
                </div>
                {/* Balance del mes */}
                <div style={{
                  fontSize:9, fontWeight:700,
                  color: d.balance >= 0 ? '#16a34a' : '#dc2626',
                }}>
                  {d.balance >= 0 ? '+' : ''}{fmt(d.balance).replace('S/. ','')}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Fila inferior: top categorías + accesos rápidos ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:18 }}>

        {/* Top categorías de gasto */}
        <div style={{
          background:'white', borderRadius:16,
          border:'1.5px solid var(--border)',
          padding:'18px 20px',
          boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, marginBottom:14 }}>
            🔥 Mayor gasto este mes por categoría
          </div>
          {topCats.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)', padding:'12px 0' }}>
              Sin gastos registrados este mes.
            </div>
          ) : topCats.map(([cat, total]) => {
            const info = CAT_MAP[cat] || { emoji:'📌', label:cat, color:'#64748b' }
            const pct  = mesActual.gastos > 0 ? (total / mesActual.gastos * 100) : 0
            return (
              <div key={cat} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                    <span>{info.emoji}</span>
                    <span style={{ fontWeight:600 }}>{info.label}</span>
                  </span>
                  <span style={{ fontFamily:'Nunito', fontWeight:800, fontSize:13, color: info.color }}>
                    {fmt(total)}
                  </span>
                </div>
                <div style={{ height:6, background:'var(--bg)', borderRadius:999, overflow:'hidden', border:'1px solid var(--border)' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:info.color, borderRadius:999, transition:'width 0.5s' }} />
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{pct.toFixed(1)}% del total de gastos</div>
              </div>
            )
          })}
        </div>

        {/* Accesos rápidos */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Botones rápidos */}
          <div style={{
            background:'white', borderRadius:16,
            border:'1.5px solid var(--border)',
            padding:'18px 20px',
            boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:14, marginBottom:12 }}>
              ⚡ Acciones rápidas
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={() => onRegistrar('ingreso')} style={btnAccion('#16a34a')}>
                ↑ Registrar ingreso
              </button>
              <button onClick={() => onRegistrar('gasto')} style={btnAccion('#dc2626')}>
                ↓ Registrar gasto
              </button>
              <button onClick={() => onNavigate('ingresos')} style={btnSecundario}>
                Ver todos los ingresos →
              </button>
              <button onClick={() => onNavigate('gastos')} style={btnSecundario}>
                Ver todos los gastos →
              </button>
            </div>
          </div>

          {/* Balance del mes */}
          <div style={{
            background: mesActual.balance >= 0 ? '#f0fdf4' : '#fef2f2',
            borderRadius:16,
            border:`1.5px solid ${mesActual.balance >= 0 ? '#86efac' : '#fca5a5'}`,
            padding:'16px 20px', textAlign:'center',
          }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:4 }}>
              BALANCE {MESES[mesAct-1].toUpperCase()}
            </div>
            <div style={{
              fontFamily:'Nunito', fontWeight:900, fontSize:26,
              color: mesActual.balance >= 0 ? '#16a34a' : '#dc2626',
              letterSpacing:'-1px',
            }}>
              {mesActual.balance >= 0 ? '+' : ''}{fmt(mesActual.balance)}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
              {mesActual.balance >= 0 ? '✅ Mes positivo' : '⚠️ Estás gastando más de lo que entra'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ emoji, label, value, color, bg, sub, subColor }) {
  return (
    <div style={{ background:bg, borderRadius:14, border:`1.5px solid ${color}30`, padding:18 }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{emoji}</div>
      <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:'Nunito', fontWeight:900, fontSize:20, color, letterSpacing:'-0.5px', marginBottom:3 }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color: subColor || `${color}90` }}>{sub}</div>
    </div>
  )
}

const btnAccion = color => ({
  width:'100%', padding:'10px 14px', border:'none', borderRadius:10,
  background:color, color:'white', fontFamily:'Poppins',
  fontWeight:700, fontSize:13, cursor:'pointer', textAlign:'left',
  boxShadow:`0 2px 8px ${color}30`,
})
const btnSecundario = {
  width:'100%', padding:'9px 14px',
  background:'var(--bg)', border:'1.5px solid var(--border)',
  borderRadius:10, fontFamily:'Poppins', fontWeight:600,
  fontSize:12, cursor:'pointer', textAlign:'left', color:'var(--text2)',
}
