import { useState } from 'react'
import Ingresos from './Ingresos'
import Gastos from './Gastos'

export default function Movimientos({ usuarioId }) {
  const [seccion, setSeccion] = useState('ingresos')

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSeccion('ingresos')}
          style={{
            padding: '10px 16px', borderRadius: 10, border: '1.5px solid',
            background: seccion === 'ingresos' ? '#f0fdf4' : 'white',
            borderColor: seccion === 'ingresos' ? '#86efac' : 'var(--border)',
            color: seccion === 'ingresos' ? '#166534' : 'var(--text3)',
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          ↑ Ingresos
        </button>
        <button
          onClick={() => setSeccion('gastos')}
          style={{
            padding: '10px 16px', borderRadius: 10, border: '1.5px solid',
            background: seccion === 'gastos' ? '#fef2f2' : 'white',
            borderColor: seccion === 'gastos' ? '#fca5a5' : 'var(--border)',
            color: seccion === 'gastos' ? '#991b1b' : 'var(--text3)',
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          ↓ Gastos
        </button>
      </div>

      {seccion === 'ingresos' ? (
        <Ingresos usuarioId={usuarioId} />
      ) : (
        <Gastos usuarioId={usuarioId} />
      )}
    </div>
  )
}
