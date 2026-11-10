# Guía de contribución

Somos 4 personas trabajando en paralelo. Estas reglas evitan pisarnos.

## Ramas

```
main      ← versión estable (entregas)
 └─ develop   ← integración del equipo
     └─ feature/<modulo>-<descripcion>   ← una por tarea
```

- `main` y `develop` **no se tocan directamente**: todo entra por Pull Request.
- Nombre de las ramas de trabajo: `feature/<modulo>-<descripcion>` en minúsculas y con guiones.
  - `<modulo>` es uno de: `pedidos`, `zonas`, `rutas`, `repartidores`, `seguimiento`, `web`, `mobile`, `tests`, `infra`, `docs`.
  - Ejemplos: `feature/pedidos-validar-hora-entrega`, `feature/rutas-algoritmo-2opt`, `feature/web-mapa-seguimiento`.
- Para correcciones de errores se usa el mismo formato (`feature/zonas-corregir-superposicion`).

```bash
git checkout develop && git pull
git checkout -b feature/pedidos-validar-hora-entrega
# ... trabajar, commits pequeños ...
git push -u origin feature/pedidos-validar-hora-entrega
# abrir Pull Request hacia develop en GitHub
```

## Commits

En **español**, en imperativo o infinitivo corto, con prefijo:

| Prefijo | Uso |
|---|---|
| `feat:` | funcionalidad nueva |
| `fix:` | corrección de un error |
| `test:` | agregar o ajustar pruebas |
| `docs:` | documentación |
| `chore:` | configuración, dependencias, mantenimiento |

Ejemplos: `feat: validar fecha de entrega no anterior a hoy`, `fix: excluir la propia zona al editar superposición`,
`test: agregar prueba de concurrencia para el armado`, `docs: documentar el algoritmo de rutas`, `chore: actualizar springdoc`.

Un commit = un cambio con sentido. Evitar commits como "cambios" o "arreglos varios".

## Pull Requests

1. El PR apunta a **`develop`** (nunca a `main`; `develop` → `main` lo hace el equipo al cerrar una entrega).
2. Completar la plantilla del PR (se carga sola).
3. **Antes de abrirlo**, en tu máquina:
   - Backend: `cd backend && ./mvnw verify` (unitarias + integración, requiere Docker).
   - Web: `cd web && npm run lint && npm test`.
   - Móvil: `cd mobile && flutter analyze && flutter test`.
4. La integración continua (GitHub Actions) debe quedar en verde.
5. Al menos **una persona del equipo revisa y aprueba** antes de hacer merge. Resolver los comentarios en la misma rama.
6. Usar *Squash and merge* para mantener `develop` legible.

## Trabajo por módulo (sin chocar)

El backend está organizado **por módulo** (`pedidos`, `zonas`, `rutas`, `repartidores`, `seguimiento`): cada persona
trabaja en su carpeta. Si necesitas cambiar algo de otro módulo o de `common/`, avisa por el grupo y haz el cambio en un
PR pequeño y aparte. Las migraciones Flyway **nunca se editan**: se agrega un archivo nuevo `V3__...sql`, `V4__...sql`
(coordinar el número para no repetirlo).

## Reglas del proyecto

- **No se cambia el stack** (Java 21 + Spring Boot, PostgreSQL/PostGIS, React + Vite en JavaScript, Flutter,
  WebSocket/STOMP; Jest, no Vitest). Ver `CLAUDE.md`.
- Cada regla de negocio nueva lleva su prueba (unitaria y, si toca la base de datos, de integración).
- No subir secretos ni archivos `.env` (solo `.env.example`). Las API keys (NVD, Sonar) se pasan por parámetro o variable.
- No subir `target/`, `node_modules/`, `build/`, reportes generados (ya están en `.gitignore`).
- Lombok no se usa.
