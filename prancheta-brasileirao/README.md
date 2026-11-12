# Meu Elenco FC

**O clube é seu. Você decide.** Assuma um dos 20 clubes da Série A 2026 e escolha o seu papel: no campo como técnico (Prancheta tática) ou no mercado como diretor de futebol (Mercado da bola). Sem cadastro. Projeto independente, sem vínculo com CBF ou clubes.

## Módulos

| Papel | Módulo | Rota |
| --- | --- | --- |
| Técnico | **Prancheta tática**: monta a escalação, arrasta os jogadores e desenha a jogada | `/prancheta`, `/{slug}` |
| Diretor de futebol | **Mercado da bola**: define o orçamento, decide quem fica e quem sai e contrata | `/mercado`, `/mercado/{slug}` |
| Olheiro | **Radar de mercado**: acha os óbvios e os não óbvios, separa em prateleiras e monta o Plano A, B e C | `/olheiro`, `/olheiro/{slug}` |

A home (`/`) apresenta os papéis e deixa escolher o clube; a escolha fica salva no navegador em `mando:clube` (também atualizada ao abrir a prancheta ou o mercado de um clube) e personaliza os atalhos. As chaves já existentes (`prancheta:*`, `mercado:*`) não mudaram de nome.

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
| `/` | Home do Meu Elenco FC: papéis (técnico, diretor de futebol, olheiro) e escolha do clube |
| `/prancheta` | Prancheta tática: os 20 clubes, com busca |
| `/{slug}` | Prancheta do clube (ex.: `/vasco`). Escalação compartilhada vem em `#s=...` |
| `/{slug}/live` | Modo Live para OBS: `?bg=grass\|solid\|chroma\|transparent&ratio=16x9\|9x16&size=P\|M\|G&safe=1&creator=@handle&ui=0&score=1` |
| `/creator` | Página para influenciadores: gerador de URL do OBS, atalhos e aviso de imagens |
| `/admin` | Painel com login: editar nome, número, posição principal, 2 alternativas, ocultar e marcar revisado, por clube; editar nome e cores do clube; trocar senha; exportar backup |

## Mercado da bola (`/mercado`)

Módulo separado da prancheta: o usuário escolhe um clube da Série A, define o orçamento (em euros, com conversão para reais), decide o destino de cada jogador e contrata nos outros mercados para montar o elenco da próxima temporada. As decisões ficam salvas no navegador.

- **Elenco atual:** valor de mercado, fim de contrato, situação (do clube, emprestado ao clube, emprestado fora) e como chegou (comprado de X por €, livre, empréstimo, base).
- **Decisões:** do clube → mantém, vende, empresta ou dispensa; contrato terminando → renova, deixa sair livre ou vende; chegou emprestado → mantém o empréstimo, devolve ou compra em definitivo; emprestado fora → traz de volta, segue emprestado ou vende. Vendas e compras aceitam valor próprio.
- **Moeda:** euro ou real (seletor € | R$ no balancete e no passo a passo). Em euro, os valores vêm com a referência em reais; a cotação é editável. Os dados ficam em euros, só a exibição muda.
- **Técnico:** mantém ou demite; se demitir, contrata um dos técnicos das 23 ligas coletadas.
- **Mercado:** 23 ligas (Brasil, América do Sul, top 5 da Europa, outros europeus, MLS, México, Arábia, Catar, Emirados). Filtros por liga, nome, posição, idade, valor e "só livres" (contrato terminando). Compra, empréstimo ou contratação livre.
- **Resumo:** receitas, gastos, saldo, valor e idade média do elenco, chegadas, saídas, decisões pendentes e alertas de elenco (goleiros, laterais etc.).
- **Escalação:** escolhe a formação e monta o time ideal num campo em perspectiva (titulares com foto, até 2 reservas por posição e 12 no banco). Avisa quando há mais de 8 estrangeiros entre os relacionados (limite de 2027). Gera duas imagens verticais para o story (1080×1920): o campinho "Meu elenco ideal 2027" nas cores do clube e o quadro de quem chega, quem sai e quem fica. As fotos do Transfermarkt passam pelo `/api/img` para poderem entrar na imagem.

### Design do módulo

O Mercado tem identidade própria (`src/market/market.css`), com os tokens de cor e as fontes compartilhados com a home em `src/brand/brand.css`: a mesa do dirigente em feltro verde, cada jogador numa ficha de papel e cada decisão num carimbo (clicar no carimbo desfaz). Fontes embutidas via `@fontsource`: Big Shoulders (títulos e carimbos), Hanken Grotesk (texto) e DM Mono (valores). O fluxo é em quatro etapas (Elenco → Mercado → Fechamento → Escalação), com passo a passo na primeira visita, balancete lateral sempre visível (barra fixa no celular) e quatro gráficos no fechamento: cascata do dinheiro, profundidade por posição, fim dos contratos por ano e idade × valor. As cores dos gráficos foram validadas para daltonismo, e quem sai/chega também se distingue pela forma.

### Dados (Transfermarkt)

Os dados vêm do Transfermarkt pelo pacote aberto [transfermarkt-api](https://github.com/felipeall/transfermarkt-api) (MIT). **O código é livre, os dados são do Transfermarkt**: confira os termos de uso dele antes de publicar ou monetizar.

```bash
pip install "transfermarkt-api==5.*"          # Python 3.12 ou 3.13
python scripts/market/collect_transfermarkt.py  # todas as ligas (~1 a 2 h); --only BRA1,GB1 para algumas
npm run build:market                            # gera src/data/market
```

O coletor guarda cada chamada em `.cache/tm/`: se o Transfermarkt bloquear no meio, rodar de novo continua de onde parou. As ligas estão em `scripts/market/competitions.json` (as sem código são procuradas pelo nome e travadas em `data/market/competitions.lock.json`). Há também a GitHub Action semanal "Mercado" (`.github/workflows/mercado-sync.yml`), que coleta e abre um PR. O Transfermarkt pode bloquear IPs de servidores; nesse caso, rode na sua máquina.

Como a situação é deduzida (`scripts/lib/market.ts`): a última transferência concluída diz se o jogador chegou emprestado ("loan" para o clube) ou está emprestado fora ("loan" saindo do clube); a chegada é a última entrada no clube que não seja retorno de empréstimo; sem entrada no histórico = cria da base. Emprestados fora só aparecem se estiverem num clube das ligas coletadas. "Terminando" = contrato (ou empréstimo) que acaba antes de 01/01/2027 (`MARKET_NEXT_SEASON` muda a data).

## Olheiro (`/olheiro`)

Terceiro crachá: o usuário faz o papel de scout do clube. Plano completo em `docs/PLANO-OLHEIRO.md` (seção 10: só dados do Transfermarkt).

- **Nota da posição (0–100):** média ponderada dos percentis de cada indicador, comparando com a mesma posição no mesmo grupo de ligas (Brasil, América do Sul, top 5…), só entre quem tem 450+ min. Indicadores sempre por 90 min e com rótulo honesto: gols, assistências, G+A, gols sofridos e jogos sem sofrer gol **com o jogador em campo**, % dos minutos possíveis e cartões. Pesos por posição em `src/scout/metrics.ts` (`POS_WEIGHTS`). Sem xG, desarmes ou passes.
- **Índices:** custo-benefício (nota ÷ log do valor, em percentil), potencial/joia, oportunidade de contrato, subvalorizado, liga de exportação (coeficientes editáveis em `LEAGUE_COEF`) e riscos. Valorização em 12 meses e distância do pico.
- **Buscas prontas:** os óbvios, não óbvios, joias, fim de contrato, custo-benefício que cabe no saldo, reposição (perfil parecido com um jogador do elenco) e cobrir a carência (do balancete do Mercado), mais filtros manuais.
- **Prateleiras** (Monitorar → Observar de perto → Prioridade → Descartado, com motivo), **Planos A/B/C** por posição (até 5), **Comparador** (até 3) e nota do olheiro, salvos por clube em `olheiro:{slug}:v1`.
- **Integração:** "Adicionar ao meu mercado" grava a contratação em `mercado:{slug}:v1` (livre se o contrato acaba antes da próxima temporada, senão compra pelo valor; sem duplicar) e abre o Mercado; os Planos A vão em lote. No Mercado, "Ver scout" abre o mesmo perfil sem sair da tela.
- **Dados:** `src/data/scout/` (`npm run collect:scout` + `npm run build:scout`); carregados por grupo de ligas. Sem dados, a tela mostra como coletar.

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
