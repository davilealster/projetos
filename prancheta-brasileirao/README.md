# Prancheta Brasileirão

Prancheta tática online com os 20 clubes da Série A 2026. Projeto independente, sem vínculo com CBF ou clubes.

Stack: Vite + React + TypeScript (front estático) e scripts Node em TypeScript (`tsx`) para os dados.

## Rodar

```bash
npm install
cp .env.example .env   # preencha API_FOOTBALL_KEY
npm run sync -- --team=vasco   # só o Vasco, para conferir
npm run sync                   # os 20 times (1 + 20 requisições na API-Football)
npm run dev
```

## Pipeline de dados (`scripts/`)

| Script | O que faz | Saída |
| --- | --- | --- |
| `fetch:teams` | `/teams?league=71&season=2026`, trava o `apiId` de cada slug em `data/team-map.json` pelos aliases, baixa escudos | `data/raw/_teams.json`, `public/teams/{slug}/crest.webp` |
| `fetch:squads` | `/players/squads?team={id}`, 1,5 s entre chamadas, cache em `.cache/squads` | `data/raw/{slug}.json` |
| `fetch:sportsdb` | TheSportsDB: posição específica e nome completo como sugestão | `data/sportsdb/{slug}.json` |
| `fetch:photos` | baixa fotos, descarta o placeholder genérico (hash repetido), converte para webp 192x192 q80 | `public/players/{slug}/{id}.webp` |
| `build:data` | junta raw + overrides + sugestões, ordena por posição e número | `src/data/teams/{slug}.json`, `index.json` |
| `review` | tabela dos jogadores com posição genérica ou nome abreviado | terminal |
| `sync` | tudo acima em sequência + relatório de lacunas | |

Todos aceitam `--team=slug1,slug2` e `--force` (ignora cache e gasta cota). `fetch:teams -- --check-league` lista as ligas do Brasil para confirmar o id 71. `sync -- --no-sportsdb` pula o TheSportsDB.

### Plano gratuito da API-Football (verificado em 06/11/2026)

- `/players/squads` funciona no plano gratuito: um sync completo gasta ~21 das 100 requisições do dia.
- `/teams?league=71&season=2026` é bloqueado ("Free plans do not have access to this season"). O `fetch:teams` cai para `/teams?country=Brazil` e casa os 20 pelos aliases exatos. Os ids já estão travados em `data/team-map.json`, então isso só importa se um clube novo subir.
- Limite de 10 requisições por minuto: o cliente espera 61 s e tenta de novo quando recebe 429.
- O TheSportsDB com a chave gratuita devolve só 10 jogadores por time, então as sugestões de posição cobrem ~25% dos elencos. O resto vai por override.

Prioridade dos dados de cada jogador: `data/overrides/{slug}.json` > TheSportsDB > API-Football.

```json
{
  "12345": { "pos": "LD", "displayName": "PH", "number": 20 },
  "67890": { "hide": true }
}
```

Cores dos clubes: `data/team-colors.json` (preenchidas à mão, revise).

## Testes

```bash
npm test
```
