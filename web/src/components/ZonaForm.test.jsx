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

  test('la advertencia explica cómo dibujar zonas pegadas sin cruzarse', () => {
    render(<ZonaForm onGuardar={jest.fn()} advertencia="El area se superpone con: Centro (se cruza)" />)

    expect(screen.getByRole('alert')).toHaveTextContent(/cerca de los vértices de la zona vecina/)
  })

  test('sin advertencia no existe ese botón', () => {
    render(<ZonaForm onGuardar={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Guardar de todas formas' })).not.toBeInTheDocument()
  })
})

// Zona vecina para el efecto imán: vértices [longitud, latitud].
const VECINA = {
  id: 1,
  nombre: 'Centro',
  activa: true,
  area: {
    type: 'Polygon',
    coordinates: [
      [
        [-78.625, -1.2468],
        [-78.605, -1.2474],
        [-78.605, -1.2346],
        [-78.625, -1.2354],
        [-78.625, -1.2468],
      ],
    ],
  },
}
// ~0.0002° ≈ 22 m (dentro del imán de 30 m) y ~0.0005° ≈ 55 m (fuera)
const CERCA = 0.0002
const LEJOS = 0.0005

describe('ZonaForm (efecto imán)', () => {
  test('un clic a menos de 30 m de un vértice de otra zona se pega exacto a ese vértice', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm zonasReferencia={[VECINA]} onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Nombre de la zona'), 'Vecina')
    clic(-1.2468 + 0.00012, -78.625 - 0.00012) // en diagonal, ~18 m del vértice (-78.625, -1.2468)
    clic(-1.2354, -78.64)
    clic(-1.2354 + CERCA, -78.625) // cerca del vértice (-78.625, -1.2354)
    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    const anillo = onGuardar.mock.calls[0][0].area.coordinates[0]
    expect(anillo[0]).toEqual([-78.625, -1.2468]) // exacto, [lng, lat]
    expect(anillo[1]).toEqual([-78.64, -1.2354]) // este punto no estaba cerca de nada: queda donde se hizo clic
    expect(anillo[2]).toEqual([-78.625, -1.2354])
  })

  test('muestra un aviso pequeño con el nombre de la zona cuando se pegó', () => {
    render(<ZonaForm zonasReferencia={[VECINA]} onGuardar={jest.fn()} />)

    clic(-1.2468 + CERCA, -78.625)

    expect(screen.getByText('Punto pegado a un vértice de la zona «Centro».')).toBeInTheDocument()
    expect(screen.getAllByTestId('marcador-circulo')).toHaveLength(1)
  })

  test('a más de 30 m no se pega ni hay aviso', async () => {
    const user = userEvent.setup()
    const onGuardar = jest.fn()
    render(<ZonaForm zonasReferencia={[VECINA]} onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Nombre de la zona'), 'Lejana')
    clic(-1.2468 + LEJOS, -78.625)
    clic(-1.3, -78.5)
    clic(-1.3, -78.6)
    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    expect(screen.queryByText(/Punto pegado/)).not.toBeInTheDocument()
    expect(onGuardar.mock.calls[0][0].area.coordinates[0][0]).toEqual([-78.625, -1.2463])
  })

  test('el aviso se quita al hacer otro clic que no se pega, al deshacer y al limpiar', async () => {
    const user = userEvent.setup()
    render(<ZonaForm zonasReferencia={[VECINA]} onGuardar={jest.fn()} />)

    clic(-1.2468, -78.625)
    expect(screen.getByText(/Punto pegado/)).toBeInTheDocument()
    clic(-1.3, -78.5)
    expect(screen.queryByText(/Punto pegado/)).not.toBeInTheDocument()

    clic(-1.2354, -78.625)
    expect(screen.getByText(/Punto pegado/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer punto' }))
    expect(screen.queryByText(/Punto pegado/)).not.toBeInTheDocument()

    clic(-1.2354, -78.625)
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.queryByText(/Punto pegado/)).not.toBeInTheDocument()
  })

  test('las zonas inactivas no atraen los puntos', () => {
    render(<ZonaForm zonasReferencia={[{ ...VECINA, activa: false }]} onGuardar={jest.fn()} />)

    clic(-1.2468 + CERCA, -78.625)

    expect(screen.queryByText(/Punto pegado/)).not.toBeInTheDocument()
  })

  test('sin zonas de referencia no hay imán ni la sugerencia', () => {
    render(<ZonaForm onGuardar={jest.fn()} />)

    clic(-1.2468, -78.625)

    expect(screen.queryByText(/Punto pegado/)).not.toBeInTheDocument()
    expect(screen.queryByText(/se pega solo/)).not.toBeInTheDocument()
  })

  test('con zonas de referencia explica el imán de 30 m', () => {
    render(<ZonaForm zonasReferencia={[VECINA]} onGuardar={jest.fn()} />)

    expect(screen.getByText(/a menos de 30 m de un vértice de otra zona/)).toBeInTheDocument()
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
