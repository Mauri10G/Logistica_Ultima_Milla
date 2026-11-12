import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { compararValores, numerosDePagina, ordenarFilas } from '../hooks/useTabla'
import { coincide, normalizar } from '../utils/busqueda'
import Buscador from './Buscador'
import Tabla from './Tabla'

const COLUMNAS = [
  { clave: 'id', titulo: '#' },
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'edad', titulo: 'Edad' },
  { clave: 'acciones', titulo: 'Acciones' },
]
const VALORES = {
  id: (f) => f.id,
  nombre: (f) => f.nombre,
  edad: (f) => f.edad,
}
const ORDEN_ID = { clave: 'id', direccion: 'asc' }

function crearFilas(cantidad) {
  return Array.from({ length: cantidad }, (_, i) => ({ id: i + 1, nombre: `Persona ${String(i + 1).padStart(2, '0')}`, edad: 20 + (i % 7) }))
}

function Prueba({ filas, ...extra }) {
  return (
    <Tabla
      titulo="Personas"
      columnas={COLUMNAS}
      valores={VALORES}
      filas={filas}
      ordenInicial={ORDEN_ID}
      vacio={<span>Sin filas</span>}
      renderFila={(fila) => (
        <tr key={fila.id}>
          <td>{fila.id}</td>
          <td>{fila.nombre}</td>
          <td>{fila.edad}</td>
          <td />
        </tr>
      )}
      {...extra}
    />
  )
}

const ids = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((fila) => Number(fila.cells[0].textContent))

async function irAPagina3(user) {
  await user.click(screen.getByRole('button', { name: /Siguiente/ }))
  await user.click(screen.getByRole('button', { name: /Siguiente/ }))
}

describe('Tabla: paginación', () => {
  test('muestra 10 filas por página por defecto y el texto "Mostrando 1 a 10 de 24"', () => {
    render(<Prueba filas={crearFilas(24)} />)

    expect(ids()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(screen.getByText('Mostrando 1 a 10 de 24')).toBeInTheDocument()
    expect(screen.getByLabelText('Filas por página')).toHaveValue('10')
  })

  test('el selector ofrece 10, 25 y 50', () => {
    render(<Prueba filas={crearFilas(24)} />)

    const opciones = within(screen.getByLabelText('Filas por página')).getAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual(['10', '25', '50'])
  })

  test('cambiar las filas por página recalcula el texto y vuelve a la página 1', async () => {
    const user = userEvent.setup()
    render(<Prueba filas={crearFilas(60)} />)
    await irAPagina3(user)
    expect(screen.getByText('Mostrando 21 a 30 de 60')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filas por página'), '25')

    expect(screen.getByText('Mostrando 1 a 25 de 60')).toBeInTheDocument()
    expect(ids()).toHaveLength(25)
    await user.selectOptions(screen.getByLabelText('Filas por página'), '50')
    expect(screen.getByText('Mostrando 1 a 50 de 60')).toBeInTheDocument()
  })

  test('Siguiente y Anterior cambian de página y se desactivan en los extremos', async () => {
    const user = userEvent.setup()
    render(<Prueba filas={crearFilas(24)} />)

    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.getByText('Mostrando 11 a 20 de 24')).toBeInTheDocument()
    expect(ids()[0]).toBe(11)

    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.getByText('Mostrando 21 a 24 de 24')).toBeInTheDocument()
    expect(ids()).toEqual([21, 22, 23, 24])
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Anterior/ }))
    expect(screen.getByText('Mostrando 11 a 20 de 24')).toBeInTheDocument()
  })

  test('los números de página llevan a esa página y marcan la actual', async () => {
    const user = userEvent.setup()
    render(<Prueba filas={crearFilas(24)} />)

    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('button', { name: 'Página 3' }))

    expect(screen.getByRole('button', { name: 'Página 3' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Página 1' })).not.toHaveAttribute('aria-current')
    expect(ids()).toEqual([21, 22, 23, 24])
  })

  test('con muchas páginas se abrevian con puntos suspensivos', () => {
    render(<Prueba filas={crearFilas(500)} tamanoInicial={10} />)

    expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 50' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Página 25' })).not.toBeInTheDocument()
  })

  test('si bajan las filas y la página ya no existe, muestra la última', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Prueba filas={crearFilas(24)} />)
    await user.click(screen.getByRole('button', { name: 'Página 3' }))

    rerender(<Prueba filas={crearFilas(12)} />)

    expect(screen.getByText('Mostrando 11 a 12 de 12')).toBeInTheDocument()
  })

  test('vuelve a la página 1 cuando cambia un valor de reiniciarCon (filtro o búsqueda)', async () => {
    const user = userEvent.setup()
    function ConFiltro() {
      const [busqueda, setBusqueda] = useState('')
      const filas = crearFilas(40).filter((f) => coincide(busqueda, f.nombre))
      return (
        <>
          <Buscador id="b" etiqueta="Buscar" valor={busqueda} onCambiar={setBusqueda} />
          <Prueba filas={filas} reiniciarCon={[busqueda]} />
        </>
      )
    }
    render(<ConFiltro />)
    await irAPagina3(user)
    expect(screen.getByText('Mostrando 21 a 30 de 40')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Buscar'), 'persona 3')

    expect(screen.getByText('Mostrando 1 a 10 de 10')).toBeInTheDocument()
    expect(ids()[0]).toBe(30)
  })

  test('sin cambios en reiniciarCon la página elegida se conserva al llegar filas nuevas', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Prueba filas={crearFilas(40)} reiniciarCon={['a']} />)
    await user.click(screen.getByRole('button', { name: 'Página 2' }))

    rerender(<Prueba filas={crearFilas(41)} reiniciarCon={['a']} />)

    expect(screen.getByText('Mostrando 11 a 20 de 41')).toBeInTheDocument()
  })

  test('sin filas muestra el vacío y no la paginación', () => {
    render(<Prueba filas={[]} />)

    expect(screen.getByText('Sin filas')).toBeInTheDocument()
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filas por página')).not.toBeInTheDocument()
  })

  test('mientras carga muestra esqueletos, marca la tabla ocupada y no muestra el vacío ni la paginación', () => {
    render(<Prueba filas={[]} cargando />)

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Cargando datos…')).toBeInTheDocument()
    expect(screen.queryByText('Sin filas')).not.toBeInTheDocument()
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
  })
})

describe('Tabla: orden', () => {
  test('viene ordenada por la columna inicial con la flecha marcada (aria-sort)', () => {
    render(<Prueba filas={[...crearFilas(5)].reverse()} />)

    expect(ids()).toEqual([1, 2, 3, 4, 5])
    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).not.toHaveAttribute('aria-sort')
  })

  test('clic en un encabezado ordena ascendente y otro clic descendente', async () => {
    const user = userEvent.setup()
    render(<Prueba filas={crearFilas(5)} />)

    await user.click(screen.getByRole('button', { name: 'Nombre' }))
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: '#' })).not.toHaveAttribute('aria-sort')
    expect(ids()).toEqual([1, 2, 3, 4, 5])

    await user.click(screen.getByRole('button', { name: 'Nombre' }))
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'descending')
    expect(ids()).toEqual([5, 4, 3, 2, 1])
  })

  test('clic en # cuando ya está ascendente la pasa a descendente', async () => {
    const user = userEvent.setup()
    render(<Prueba filas={crearFilas(5)} />)

    await user.click(screen.getByRole('button', { name: '#' }))

    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'descending')
    expect(ids()).toEqual([5, 4, 3, 2, 1])
  })

  test('los números se ordenan como números, no como texto', async () => {
    const user = userEvent.setup()
    render(<Prueba filas={[{ id: 2, nombre: 'b', edad: 9 }, { id: 10, nombre: 'a', edad: 100 }, { id: 1, nombre: 'c', edad: 20 }]} />)

    await user.click(screen.getByRole('button', { name: 'Edad' }))

    expect(ids()).toEqual([2, 1, 10])
  })

  test('ordenar vuelve a la página 1 y ordena todas las filas, no solo la página', async () => {
    const user = userEvent.setup()
    render(<Prueba filas={crearFilas(24)} />)
    await user.click(screen.getByRole('button', { name: 'Página 3' }))

    await user.click(screen.getByRole('button', { name: '#' }))

    expect(screen.getByText('Mostrando 1 a 10 de 24')).toBeInTheDocument()
    expect(ids()[0]).toBe(24)
  })

  test('una columna sin valor de orden (Acciones) no es un botón', () => {
    render(<Prueba filas={crearFilas(3)} />)

    expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument()
  })

  test('una columna con ordenable: false tampoco', () => {
    render(<Prueba filas={crearFilas(3)} columnas={COLUMNAS.map((c) => (c.clave === 'edad' ? { ...c, ordenable: false } : c))} />)

    expect(screen.queryByRole('button', { name: 'Edad' })).not.toBeInTheDocument()
  })

  test('al volver a montar la tabla (recargar) el orden vuelve al inicial', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Prueba filas={crearFilas(5)} />)
    await user.click(screen.getByRole('button', { name: 'Nombre' }))
    await user.click(screen.getByRole('button', { name: 'Nombre' }))
    expect(ids()).toEqual([5, 4, 3, 2, 1])

    unmount()
    render(<Prueba filas={crearFilas(5)} />)

    expect(ids()).toEqual([1, 2, 3, 4, 5])
    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'ascending')
  })

  test('sin ordenInicial respeta el orden en que llegan las filas', () => {
    render(<Prueba filas={[{ id: 3, nombre: 'c', edad: 1 }, { id: 1, nombre: 'a', edad: 1 }]} ordenInicial={undefined} />)

    expect(ids()).toEqual([3, 1])
  })
})

describe('utilidades de orden y paginación', () => {
  test('compararValores: números como números y texto sin acentos ni mayúsculas', () => {
    expect(compararValores(2, 10)).toBeLessThan(0)
    expect(compararValores('álvaro', 'Alvaro')).toBe(0)
    expect(compararValores('Pedido 2', 'Pedido 10')).toBeLessThan(0)
  })

  test('ordenarFilas deja los vacíos al final en ambas direcciones y no modifica la entrada', () => {
    const filas = [{ v: null }, { v: 'b' }, { v: 'a' }, { v: '' }]
    const copia = [...filas]

    expect(ordenarFilas(filas, (f) => f.v, 'asc').map((f) => f.v)).toEqual(['a', 'b', null, ''])
    expect(ordenarFilas(filas, (f) => f.v, 'desc').map((f) => f.v)).toEqual(['b', 'a', null, ''])
    expect(filas).toEqual(copia)
  })

  test('numerosDePagina muestra primera, última y vecinas', () => {
    expect(numerosDePagina(1, 1)).toEqual([1])
    expect(numerosDePagina(2, 3)).toEqual([1, 2, 3])
    expect(numerosDePagina(1, 20)).toEqual([1, 2, '…', 20])
    expect(numerosDePagina(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20])
    expect(numerosDePagina(20, 20)).toEqual([1, '…', 19, 20])
  })
})

describe('Buscador y búsqueda', () => {
  test('normalizar quita acentos y mayúsculas; coincide ignora ambos y una búsqueda vacía coincide con todo', () => {
    expect(normalizar('  BolÍvar ')).toBe('bolivar')
    expect(normalizar(null)).toBe('')
    expect(coincide('bolivar', 'Av. Bolívar y Mera')).toBe(true)
    expect(coincide('xyz', 'Maria', 'Bolívar')).toBe(false)
    expect(coincide('  ', 'cualquiera')).toBe(true)
    expect(coincide('mer', null, 'Mera')).toBe(true)
  })

  test('el buscador tiene label visible, es un campo de búsqueda y avisa cada cambio', () => {
    const onCambiar = jest.fn()
    render(<Buscador id="buscar" etiqueta="Buscar por cliente" valor="" onCambiar={onCambiar} />)

    const campo = screen.getByRole('searchbox', { name: 'Buscar por cliente' })
    fireEvent.change(campo, { target: { value: 'ana' } })

    expect(onCambiar).toHaveBeenCalledWith('ana')
  })
})
