import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { manejadoresMapa } from 'react-leaflet'
import ZonaForm, { MENSAJE_POCOS_PUNTOS, MENSAJE_SIN_CERRAR } from './ZonaForm'

function clic(lat, lng) {
  act(() => manejadoresMapa.actual.click({ latlng: { lat, lng } }))
}

function dibujarTresPuntos() {
  clic(-1.25, -78.62)
  clic(-1.25, -78.6)
  clic(-1.27, -78.6)
}

const ZONA = {
  id: 4,
  nombre: 'Ficoa',
  activa: true,
  area: {
    type: 'Polygon',
    coordinates: [
      [
        [-78.62, -1.25],
        [-78.6, -1.25],
        [-78.6, -1.27],
        [-78.62, -1.25],
      ],
    ],
  },
}

describe('ZonaForm (zona nueva)', () => {
  test('los controles tienen label y los botones del mapa empiezan deshabilitados', () => {
    render(<ZonaForm onGuardar={jest.fn()} />)

    expect(screen.getByLabelText('Nombre de la zona')).toBeInTheDocument()
    expect(screen.getByLabelText('Zona activa')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Deshacer punto' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cerrar polígono' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeDisabled()
  })

  test('cada clic en el mapa agrega un punto', () => {
    render(<ZonaForm onGuardar={jest.fn()} />)

    clic(-1.25, -78.62)
    clic(-1.25, -78.6)

    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('2 agregado(s)')
  })

  test('Deshacer punto quita el último', async () => {
    const user = userEvent.setup()
    render(<ZonaForm onGuardar={jest.fn()} />)
    dibujarTresPuntos()

    await user.click(screen.getByRole('button', { name: 'Deshacer punto' }))

    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(2)
  })

  test('Limpiar quita todos los puntos', async () => {
    const user = userEvent.setup()
    render(<ZonaForm onGuardar={jest.fn()} />)
    dibujarTresPuntos()

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))

    expect(screen.queryByTestId('marcador-circulo')).not.toBeInTheDocument()
  })

  test('Cerrar polígono exige al menos 3 puntos', async () => {
    const user = userEvent.setup()
    render(<ZonaForm onGuardar={jest.fn()} />)
    clic(-1.25, -78.62)
    clic(-1.25, -78.6)

    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE_POCOS_PUNTOS)
    expect(screen.queryByTestId('poligono')).not.toBeInTheDocument()
  })

  test('con 3 puntos Cerrar polígono lo dibuja y ya no se agregan más', async () => {
    const user = userEvent.setup()
    render(<ZonaForm onGuardar={jest.fn()} />)
    dibujarTresPuntos()

    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
    clic(-1.3, -78.5)

    expect(screen.getByTestId('poligono')).toBeInTheDocument()
    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(3)
    expect(screen.getByRole('status')).toHaveTextContent('Polígono cerrado con 3 puntos')
    expect(screen.getByRole('button', { name: 'Cerrar polígono' })).toBeDisabled()
  })

  test('Deshacer sobre un polígono cerrado lo vuelve a abrir', async () => {
    const user = userEvent.setup()
    render(<ZonaForm onGuardar={jest.fn()} />)
    dibujarTresPuntos()
    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))

    await user.click(screen.getByRole('button', { name: 'Deshacer punto' }))

    expect(screen.queryByTestId('poligono')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(2)
  })

  test('no guarda sin puntos suficientes', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Nombre de la zona'), 'Nueva')
    clic(-1.25, -78.62)
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE_POCOS_PUNTOS)
  })

  test('no guarda un polígono sin cerrar', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Nombre de la zona'), 'Nueva')
    dibujarTresPuntos()
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE_SIN_CERRAR)
  })

  test('guarda nombre y polígono GeoJSON cerrado', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Nombre de la zona'), '  Nueva  ')
    dibujarTresPuntos()
    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    expect(onGuardar).toHaveBeenCalledTimes(1)
    const [datos, confirmar] = onGuardar.mock.calls[0]
    expect(confirmar).toBe(false)
    expect(datos.nombre).toBe('Nueva')
    expect(datos.activa).toBe(true)
    expect(datos.area.type).toBe('Polygon')
    expect(datos.area.coordinates[0]).toHaveLength(4) // 3 puntos + cierre
    expect(datos.area.coordinates[0][0]).toEqual([-78.62, -1.25]) // [lng, lat]
    expect(datos.area.coordinates[0][3]).toEqual(datos.area.coordinates[0][0])
  })

  test('se puede guardar una zona inactiva', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Nombre de la zona'), 'Reserva')
    await user.click(screen.getByLabelText('Zona activa'))
    dibujarTresPuntos()
    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    expect(onGuardar.mock.calls[0][0].activa).toBe(false)
  })

  test('avisa a onEditar cada vez que el usuario cambia algo', async () => {
    const user = userEvent.setup()
    const onEditar = jest.fn()
    render(<ZonaForm onGuardar={jest.fn()} onEditar={onEditar} />)

    await user.type(screen.getByLabelText('Nombre de la zona'), 'A')
    clic(-1.25, -78.62)

    expect(onEditar).toHaveBeenCalledTimes(2)
  })

  test('muestra el error del backend y bloquea el botón mientras guarda', () => {
    render(<ZonaForm onGuardar={jest.fn()} guardando error="Ya existe una zona con el nombre Centro" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una zona con el nombre Centro')
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  })

  test('sin onCancelar no hay botón Cancelar', () => {
    render(<ZonaForm onGuardar={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument()
  })
})

describe('ZonaForm (superposición, CP-08)', () => {
  test('la advertencia ofrece Guardar de todas formas y reenvía confirmando', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm zona={ZONA} onGuardar={onGuardar} advertencia="El area se superpone con: Centro" />)

    expect(screen.getByRole('alert')).toHaveTextContent('El area se superpone con: Centro')
    await user.click(screen.getByRole('button', { name: 'Guardar de todas formas' }))

    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar.mock.calls[0][0].nombre).toBe('Ficoa')
    expect(onGuardar.mock.calls[0][1]).toBe(true)
  })

  test('sin advertencia no existe ese botón', () => {
    render(<ZonaForm onGuardar={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Guardar de todas formas' })).not.toBeInTheDocument()
  })
})

describe('ZonaForm (edición, CP-07)', () => {
  test('carga el nombre y el polígono de la zona, ya cerrado', () => {
    render(<ZonaForm zona={ZONA} onGuardar={jest.fn()} />)

    expect(screen.getByRole('form', { name: 'Editar zona' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la zona')).toHaveValue('Ficoa')
    expect(screen.getByTestId('poligono')).toBeInTheDocument()
    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(3)
    expect(screen.getByRole('status')).toHaveTextContent('Polígono cerrado con 3 puntos')
  })

  test('guardar cambios entrega los nuevos límites', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm zona={ZONA} onGuardar={onGuardar} />)

    await user.click(screen.getByRole('button', { name: 'Deshacer punto' })) // abre el polígono
    clic(-1.3, -78.55)
    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const datos = onGuardar.mock.calls[0][0]
    expect(datos.area.coordinates[0]).toContainEqual([-78.55, -1.3])
  })

  test('Cancelar edición avisa a quien lo usa', async () => {
    const user = userEvent.setup()
    const onCancelar = jest.fn()
    render(<ZonaForm zona={ZONA} onGuardar={jest.fn()} onCancelar={onCancelar} />)

    await user.click(screen.getByRole('button', { name: 'Cancelar edición' }))

    expect(onCancelar).toHaveBeenCalled()
  })
})
