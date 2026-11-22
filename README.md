# TCG Trader

Web para encontrar intercambios equilibrados de cartas Pokémon usando los precios de Cardmarket (API TCGGO vía RapidAPI). Vite + React + TypeScript.

## Configurar la clave de la API

1. Consigue una clave de RapidAPI para `cardmarket-api-tcg.p.rapidapi.com`.
2. Copia `.env.example` a `.env.local` y rellena `RAPIDAPI_KEY=tu_clave`.

La clave solo la usa el servidor (proxies `/api/search` y `/api/episodes`); nunca llega al navegador. La lista de colecciones se cachea 7 días en localStorage del navegador.

El precio usado es el más bajo en estado Near Mint de Cardmarket según el idioma elegido en la app (EU, DE o ES); si no existe, la carta cuenta como "sin precio".

## Desarrollo

```
npm install
npm run dev
```

El servidor de Vite atiende `/api/search` y `/api/episodes` con el mismo código de normalización que la función de Vercel.

## Otros scripts

- `npm run build`: comprueba tipos y genera `dist/`.
- `npm run preview`: sirve el build.
- `npm test`: tests (vitest).

## Docker (siempre activo en localhost)

Requiere Docker Desktop y el archivo `.env.local` con `RAPIDAPI_KEY` (ver arriba).

```
docker compose up -d --build
```

La app queda en http://localhost:5173 y se reinicia sola (`restart: unless-stopped`). Para que arranque con el sistema, activa en Docker Desktop *Settings > General > Start Docker Desktop when you sign in*.

- Aplicar cambios del código: el mismo comando (`docker compose up -d --build`).
- Ver logs: `docker compose logs -f`.
- Parar: `docker compose down`.

Seguridad: la clave no se copia en la imagen (se pasa al arrancar desde `.env.local`), el puerto solo escucha en `127.0.0.1` y el contenedor corre sin root, con sistema de archivos de solo lectura y sin montar carpetas del equipo.

## Despliegue en Vercel

1. Importa el repositorio en Vercel (preset Vite).
2. En Settings > Environment Variables añade `RAPIDAPI_KEY` con tu clave.
3. Despliega. La carpeta `api/` se publica como funciones serverless.

### Credenciales propias (botón *Authenticate*)

En la tarjeta de búsqueda, **Authenticate** abre un modal para elegir el host de una lista fija y, opcionalmente, guardar una API key propia para ese host en el `localStorage` del navegador (una key por host). Se envían a `/api/*` en las cabeceras `x-tcg-host` (id del host, p. ej. `tcggo`) y `x-tcg-key`; si no hay key propia, el servidor usa la variable de entorno del host (`RAPIDAPI_KEY` para TCGGO). Con key propia, esa variable es opcional en el servidor.

### Hosts

Cada proveedor de cartas es una subclase de `CardHost` (`api/_hosts/CardHost.ts`), que define `searchCards` y `listEpisodes` y comparte la gestión de peticiones y errores. Hosts disponibles:

| Id | Proveedor | Variable de entorno |
|---|---|---|
| `tcggo` | TCGGO (`pokemon-tcg-api.p.rapidapi.com`) | `RAPIDAPI_KEY` |
| `apitcg` | API TCG (`api.apitcg.com`) | `APITCG_API_KEY` |

Los precios de API TCG son de TCGplayer en USD y se convierten a EUR con un tipo fijo (`USD_TO_EUR` en `api/_hosts/ApitcgHost.ts`).

Para añadir uno: añade su id a `HOST_IDS` y su entrada (nombre y capacidades: colecciones, ordenaciones, idiomas con precio) a `HOST_CATALOG` en `src/hostCatalog.ts`, crea la subclase en `api/_hosts/` y regístrala en `api/_hosts/index.ts`. La interfaz oculta lo que el host no admite.
