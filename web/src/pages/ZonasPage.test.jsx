import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { manejadoresMapa } from 'react-leaflet'
import { actualizarZona, crearZona, listarZonas } from '../api/zonasApi'
import ZonasPage from './ZonasPage'

jest.mock('../api/zonasApi')

const AREA = {
  type: 'Polygon',
  coordinates: [
    [
      [-78.62, -1.25],
      [-78.6, -1.25],
      [-78.6, -1.27],
      [-78.62, -1.25],
    ],
  ],
}
const AREA_NUEVA = {
  type: 'Polygon',
  coordinates: [
    [
      [-78.6, -1.2],
      [-78.5, -1.2],
      [-78.5, -1.3],
      [-78.6, -1.2],
    ],
  ],
}
const AREA_EDITADA = {
  type: 'Polygon',
  coordinates: [
    [
      [-78.7, -1.1],
      [-78.4, -1.1],
      [-78.4, -1.4],
      [-78.7, -1.1],
    ],
  ],
}
const ZONAS = [
  { id: 1, nombre: 'Centro', activa: true, area: AREA },
  { id: 2, nombre: 'Norte', activa: false, area: AREA },
]

function errorHttp(status, codigo, mensaje) {
  return { response: { status, data: { codigo, mensaje } } }
}

function clic(lat, lng) {
  act(() => manejadoresMapa.actual.click({ latlng: { lat, lng } }))
}

async function dibujar() {
  render(<ZonasPage />)
  await screen.findByRole('cell', { name: 'Centro' })
}

async function dibujarYGuardarZonaNueva(user) {
  await user.type(screen.getByLabelText('Nombre de la zona'), 'Ficoa')
  clic(-1.2, -78.6)
  clic(-1.2, -78.5)
  clic(-1.3, -78.5)
  await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
  await user.click(screen.getByRole('button', { name: 'Guardar zona' }))
}

beforeEach(() => {
  jest.resetAllMocks()
  listarZonas.mockResolvedValue(ZONAS)
  crearZona.mockResolvedValue({ id: 3 })
  actualizarZona.mockResolvedValue({ id: 1 })
})

describe('ZonasPage', () => {
  test('lista las zonas y si están activas', async () => {
    await dibujar()

    expect(screen.getByText('Norte')).toBeInTheDocument()
    expect(screen.getByText('Sí')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  test('sin zonas lo dice', async () => {
    listarZonas.mockResolvedValue([])
    render(<ZonasPage />)

    expect(await screen.findByText('No hay zonas configuradas.')).toBeInTheDocument()
  })

  test('muestra el error si falla la carga', async () => {
    listarZonas.mockRejectedValue(errorHttp(500, 'ERROR_INTERNO', 'Ocurrio un error interno'))
    render(<ZonasPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrio un error interno')
  })

  test('las zonas activas se dibujan como referencia en el mapa', async () => {
    await dibujar()

    expect(screen.getAllByTestId('geojson')).toHaveLength(1)
  })

  test('CP-06: crea una zona dibujada en el mapa', async () => {
    const user = userEvent.setup()
    await dibujar()

    await dibujarYGuardarZonaNueva(user)

    await waitFor(() => expect(crearZona).toHaveBeenCalledTimes(1))
    const [datos, confirmar] = crearZona.mock.calls[0]
    expect(datos.nombre).toBe('Ficoa')
    expect(datos.area.type).toBe('Polygon')
    expect(datos.area.coordinates[0]).toHaveLength(4)
    expect(confirmar).toBe(false)
    expect(await screen.findByText('Zona "Ficoa" creada.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la zona')).toHaveValue('') // el formulario se vació
  })

  test('no envía una zona con menos de 3 puntos', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.type(screen.getByLabelText('Nombre de la zona'), 'Corta')
    clic(-1.2, -78.6)
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    expect(crearZona).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 3 puntos')
  })

  test('CP-08: una superposición muestra la advertencia y Guardar de todas formas reenvía confirmando', async () => {
    const user = userEvent.setup()
    crearZona.mockRejectedValueOnce(errorHttp(409, 'ZONA_SUPERPUESTA', 'El area se superpone con: Centro'))
    await dibujar()

    await dibujarYGuardarZonaNueva(user)

    expect(await screen.findByText(/El area se superpone con: Centro/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar de todas formas' }))

    await waitFor(() => expect(crearZona).toHaveBeenCalledTimes(2))
    expect(crearZona.mock.calls[1][1]).toBe(true)
    expect(await screen.findByText('Zona "Ficoa" creada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar de todas formas' })).not.toBeInTheDocument()
  })

  test('imán: al dibujar una zona nueva, los puntos cerca de un vértice de una zona activa se pegan a él', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.type(screen.getByLabelText('Nombre de la zona'), 'Vecina')
    clic(-1.25 + 0.00012, -78.62 - 0.00012) // ~18 m del vértice (-78.62, -1.25) de Centro
    clic(-1.3, -78.7)
    clic(-1.27, -78.6 + 0.00015) // ~17 m del vértice (-78.6, -1.27) de Centro
    expect(screen.getByText('Punto pegado a un vértice de la zona «Centro».')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar polígono' }))
    await user.click(screen.getByRole('button', { name: 'Guardar zona' }))

    const anillo = crearZona.mock.calls[0][0].area.coordinates[0]
    expect(anillo[0]).toEqual([-78.62, -1.25])
    expect(anillo[1]).toEqual([-78.7, -1.3])
    expect(anillo[2]).toEqual([-78.6, -1.27])
  })

  test('imán: las zonas inactivas y la propia zona en edición no atraen los puntos', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))
    await user.click(screen.getByRole('button', { name: 'Deshacer punto' }))
    clic(-1.25 + 0.00012, -78.62 - 0.00012) // cerca de un vértice de Centro (la propia) y de Norte (inactiva)

    expect(screen.queryByText(/Punto pegado/)).not.toBeInTheDocument()
  })

  test('la advertencia desaparece si se modifica el dibujo', async () => {
    const user = userEvent.setup()
    crearZona.mockRejectedValueOnce(errorHttp(409, 'ZONA_SUPERPUESTA', 'El area se superpone con: Centro'))
    await dibujar()
    await dibujarYGuardarZonaNueva(user)
    await screen.findByRole('button', { name: 'Guardar de todas formas' })

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))

    expect(screen.queryByRole('button', { name: 'Guardar de todas formas' })).not.toBeInTheDocument()
  })

  test('otro 409 (nombre duplicado) es un error normal, sin opción de forzar', async () => {
    const user = userEvent.setup()
    crearZona.mockRejectedValue(errorHttp(409, 'ZONA_DUPLICADA', 'Ya existe una zona con el nombre Ficoa'))
    await dibujar()

    await dibujarYGuardarZonaNueva(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una zona con el nombre Ficoa')
    expect(screen.queryByRole('button', { name: 'Guardar de todas formas' })).not.toBeInTheDocument()
  })

  test('CP-07: editar carga el polígono de la zona y guarda los nuevos límites', async () => {
    const user = userEvent.setup()
    await dibujar()

    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))
    expect(screen.getByRole('form', { name: 'Editar zona' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la zona')).toHaveValue('Centro')
    expect(screen.getByTestId('poligono')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Nombre de la zona'))
    await user.type(screen.getByLabelText('Nombre de la zona'), 'Centro ampliado')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(actualizarZona).toHaveBeenCalledTimes(1))
    const [id, datos, confirmar] = actualizarZona.mock.calls[0]
    expect(id).toBe(1)
    expect(datos.nombre).toBe('Centro ampliado')
    expect(datos.area.coordinates[0]).toHaveLength(4)
    expect(confirmar).toBe(false)
    expect(await screen.findByText('Zona "Centro ampliado" actualizada.')).toBeInTheDocument()
  })

  test('al editar, la propia zona no se dibuja como referencia', async () => {
    const user = userEvent.setup()
    await dibujar()
    expect(screen.getAllByTestId('geojson')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))

    expect(screen.queryByTestId('geojson')).not.toBeInTheDocument()
  })

  test('CP-08 también al editar: reenvía con confirmación', async () => {
    const user = userEvent.setup()
    actualizarZona.mockRejectedValueOnce(errorHttp(409, 'ZONA_SUPERPUESTA', 'El area se superpone con: Norte'))
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await user.click(await screen.findByRole('button', { name: 'Guardar de todas formas' }))

    await waitFor(() => expect(actualizarZona).toHaveBeenCalledTimes(2))
    expect(actualizarZona.mock.calls[1][2]).toBe(true)
  })

  test('Nueva zona y Cancelar edición vuelven al formulario vacío', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))

    await user.click(screen.getByRole('button', { name: 'Nueva zona' }))

    expect(screen.getByRole('form', { name: 'Nueva zona' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la zona')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Editar zona Norte' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar edición' }))
    expect(screen.getByRole('form', { name: 'Nueva zona' })).toBeInTheDocument()
  })
})

function areasDelMapa() {
  return screen.getAllByTestId('geojson').map((capa) => JSON.parse(capa.dataset.data))
}

describe('ZonasPage: el mapa se actualiza al instante, sin recargar la página', () => {
  test('el mapa recibe la zona nueva sin recargar', async () => {
    const user = userEvent.setup()
    await dibujar()
    expect(areasDelMapa()).toEqual([AREA])
    listarZonas.mockResolvedValue([...ZONAS, { id: 3, nombre: 'Ficoa', activa: true, area: AREA_NUEVA }])

    await dibujarYGuardarZonaNueva(user)

    await waitFor(() => expect(screen.getAllByTestId('geojson')).toHaveLength(2))
    expect(areasDelMapa()).toContainEqual(AREA_NUEVA)
    expect(screen.getByRole('cell', { name: 'Ficoa' })).toBeInTheDocument() // y la lista también
  })

  test('al editar una zona, su polígono nuevo se dibuja en el mapa (no queda el viejo)', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))
    listarZonas.mockResolvedValue([{ ...ZONAS[0], area: AREA_EDITADA }, ZONAS[1]])

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(areasDelMapa()).toEqual([AREA_EDITADA]))
  })

  test('al renombrar una zona el mapa muestra el nombre nuevo', async () => {
    const user = userEvent.setup()
    await dibujar()
    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))
    listarZonas.mockResolvedValue([{ ...ZONAS[0], nombre: 'Centro histórico' }, ZONAS[1]])
    await user.clear(screen.getByLabelText('Nombre de la zona'))
    await user.type(screen.getByLabelText('Nombre de la zona'), 'Centro histórico')

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Centro histórico', { selector: '[data-testid="tooltip"]' })).toBeInTheDocument()
    expect(screen.queryByText('Centro', { selector: '[data-testid="tooltip"]' })).not.toBeInTheDocument()
  })

  test('al dar de baja una zona desaparece del mapa', async () => {
    const user = userEvent.setup()
    const activas = [ZONAS[0], { ...ZONAS[1], activa: true }]
    listarZonas.mockResolvedValue(activas)
    await dibujar()
    expect(screen.getAllByTestId('geojson')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))
    listarZonas.mockResolvedValue([{ ...ZONAS[0], activa: false }, activas[1]])
    await user.click(screen.getByLabelText('Zona activa'))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(screen.getAllByTestId('geojson')).toHaveLength(1))
    expect(screen.getByText('Norte', { selector: '[data-testid="tooltip"]' })).toBeInTheDocument()
  })

  test('al reactivar una zona vuelve a aparecer en el mapa', async () => {
    const user = userEvent.setup()
    await dibujar()
    expect(screen.getAllByTestId('geojson')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Editar zona Norte' }))
    listarZonas.mockResolvedValue([ZONAS[0], { ...ZONAS[1], activa: true }])
    await user.click(screen.getByLabelText('Zona activa'))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(screen.getAllByTestId('geojson')).toHaveLength(2))
  })

  test('el formulario se vacía solo después de que llegó la lista nueva', async () => {
    const user = userEvent.setup()
    await dibujar()
    let entregarLista
    await user.click(screen.getByRole('button', { name: 'Editar zona Centro' }))
    listarZonas.mockReturnValue(new Promise((resolver) => (entregarLista = resolver)))

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Zona "Centro" actualizada.')
    expect(screen.getByRole('form', { name: 'Editar zona' })).toBeInTheDocument() // aún editando

    await act(async () => entregarLista([{ ...ZONAS[0], area: AREA_EDITADA }, ZONAS[1]]))

    await waitFor(() => expect(screen.getByRole('form', { name: 'Nueva zona' })).toBeInTheDocument())
    expect(areasDelMapa()).toEqual([AREA_EDITADA])
  })
})
