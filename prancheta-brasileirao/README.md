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

## Páginas

| Rota | O que é |
| --- | --- |
| `/` | Os 20 clubes, com busca |
| `/{slug}` | Prancheta do clube (ex.: `/vasco`). Escalação compartilhada vem em `#s=...` |
| `/{slug}/live` | Modo Live para OBS: `?bg=grass\|solid\|chroma\|transparent&ratio=16x9\|9x16&size=P\|M\|G&safe=1&creator=@handle&ui=0&score=1` |
| `/creator` | Página para influenciadores: gerador de URL do OBS, atalhos e aviso de imagens |
| `/admin` | Painel com login: editar nome, número, posição principal, 2 alternativas, ocultar e marcar revisado, por clube; editar nome e cores do clube; trocar senha; exportar backup |

## Posições: principal + 2 alternativas

Cada jogador tem uma posição principal e até duas alternativas. Na prancheta, **um clique** no jogador em campo abre um seletor para escolher em que posição ele joga naquela escalação (o selo na peça mostra a escolha); **dois cliques** tiram do campo. As formações automáticas usam as alternativas para encaixar o jogador.

De onde vêm as posições, em ordem de prioridade:

1. **Painel admin** (`/admin`): grava no Vercel Blob privado e vale na hora, sem deploy. Indexado pelo id do jogador na API-Football, então acompanha o jogador entre temporadas e clubes.
2. **Overrides do repositório** (`data/overrides/{slug}.json`): correções manuais e o rascunho da pesquisa (`"draft": true`).
3. **TheSportsDB** e, por último, a **API-Football** (só GOL/ZAG/MEI/ATA).

O rascunho veio da Wikipédia (fichas dos jogadores, pt e en), guardado em `data/research/{slug}.json` e convertido por `npm run import:research`. A importação nunca sobrescreve um override manual.

## Admin

- Login padrão: usuário e senha nas variáveis de ambiente da Vercel `ADMIN_USER` / `ADMIN_PASSWORD`. Depois de trocar a senha no painel, vale a nova (hash scrypt no Blob privado). `ADMIN_SECRET` assina o cookie da sessão (7 dias).
- Local: `npm run dev` atende `/api/*` com os mesmos arquivos de `api/`, guardando em `.cache/admin-store`. Senha local: `prancheta-dev`.

Atalhos: `1`–`6` formações, `D` desenhar, `E` apagar desenhos, `C` limpar campo, `H` esconder controles, `S` lista de substituições, `Ctrl+Z` desfazer.

Pendências e decisões em aberto: [PENDENCIAS.md](PENDENCIAS.md).

## Pipeline de dados (`scripts/`)

| Script | O que faz | Saída |
| --- | --- | --- |
| `fetch:teams` | `/teams?league=71&season=2026`, trava o `apiId` de cada slug em `data/team-map.json` pelos aliases, baixa escudos | `.cache/teams.json`, `public/teams/{slug}/crest.webp` |
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
