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
