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

## Despliegue en Vercel

1. Importa el repositorio en Vercel (preset Vite).
2. En Settings > Environment Variables añade `RAPIDAPI_KEY` con tu clave.
3. Despliega. La carpeta `api/` se publica como funciones serverless.
