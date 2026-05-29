# Orange Days - web app tornei live

Questa versione supporta più fogli CSV separati per torneo e fase.

## Struttura consigliata Google Sheet

Puoi usare tab separati come:

- `Calcio-Over35`
- `Calcio-12H-Gironi`
- `Calcio-12H-Finali`
- `Basket-Gironi`
- `Basket-Finali`
- `Volley-Gironi`
- `Volley-Gold`
- `Volley-Silver`

## Colonne supportate

Per i fogli partita usa colonne come:

```text
id | girone | data | ora | campo | squadra_1 | squadra_2 | gol_squadra_1 | gol_squadra_2 | stato | note
```

oppure per basket/volley:

```text
id | girone | data | ora | campo | squadra_1 | squadra_2 | arbitro | pti_squadra_1 | pti_squadra_2 | stato | note
```

La colonna `girone` viene usata anche per il turno della fase finale, ad esempio:

```text
Semifinale 1
Semifinale 2
Finale 3/4
Finale 1/2
Gold
Silver
```

## Collegamento CSV

1. In Google Sheets vai su **File > Condividi > Pubblica sul web**.
2. Pubblica ogni foglio come **CSV**.
3. Copia gli URL in `config.js`, dentro la fase corrispondente.
4. Pubblica la cartella su GitHub Pages / Cloudflare Pages / Vercel.
5. Incorpora l'URL in Google Sites.

## Parser CSV

La web app usa `@vanillaes/csv` via CDN:

```js
import { parse } from 'https://cdn.jsdelivr.net/npm/@vanillaes/csv@latest/src/index.min.js';
```

Serve quindi un hosting web. L'apertura locale di `index.html` può non funzionare.
