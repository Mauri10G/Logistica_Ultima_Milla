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
