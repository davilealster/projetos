# Plano — módulo Olheiro (scout) do Mando

Status: **planejado, não implementado** (sessão de 12/11/2026). Sem monetização por enquanto.

## 1. Objetivo
Terceiro crachá do Mando: **Olheiro** ("Crachá 03 · Departamento de análise"), substituindo o "Presidente — em breve".
O usuário monitora o mercado como um scout: acha os jogadores óbvios, os não óbvios, os de potencial e as oportunidades de preço,
separa em **prateleiras** e monta **Plano A / Plano B / Plano C** por posição — e leva isso para o Mercado.

## 2. Dados

### Fontes
- **API-Football** (api-sports.io, plano gratuito ~100 chamadas/dia; já usada no pipeline da prancheta) — estatísticas por jogador/temporada/competição.
- **Transfermarkt** (coletor Python já existente em `scripts/market/collect_transfermarkt.py`) — valor, contrato, idade, nacionalidade, foto, clube, liga (já em `src/data/market/leagues/*.json`).
- Sem Cartola. Sem dados pagos.

### Coleta (offline, como o mercado)
- Novo script `scripts/scout/collect_apifootball.ts` com cache em disco (`.cache/apifootball/`), retomável, respeitando o limite diário (roda em vários dias; GitHub Action semanal como `mercado-sync.yml`).
- Endpoint principal: `GET /players?league={id}&season={ano}&page={n}` (20 jogadores/página, traz `statistics[]` com games, shots, goals, passes, tackles, duels, dribbles, fouls, cards, penalty). Mapear as 23 ligas do Mercado → ids da API-Football em `scripts/scout/leagues.json`.
- Temporada: a mais recente com dados (Brasil = ano corrente; Europa = temporada 2025/26). Guardar `season` e `collectedAt`.
- **Casamento** API-Football ↔ Transfermarkt: por nome normalizado (+ data de nascimento quando houver; a API-Football traz `birth.date`) e clube. Reaproveitar `compatible()`/`normalize()` de `scripts/lib/core.ts` e `scripts/import-research.ts`. Relatório de não casados.
- Saída estática (igual ao mercado): `src/data/scout/leagues/{id}.json` com, por jogador: `id` (Transfermarkt), `afId`, `min`, `apps`, `starts`, e as contagens brutas abaixo. Carregamento por liga via `import.meta.glob`.

### Estatísticas brutas usadas (API-Football)
minutos, jogos, titular, nota média (`rating`), gols, assistências, finalizações (total/no alvo), passes (total, decisivos/key, precisão %), desarmes (total, bloqueios, interceptações), duelos (total/ganhos), dribles (tentados/certos), faltas (sofridas/cometidas), cartões, pênaltis (sofridos/convertidos/defendidos), goleiro: defesas (`goals.saves`), gols sofridos (`goals.conceded`).
> Sem xG, mapa de calor ou eventos com posição: indicadores precisam ser honestos com isso (rótulos "por 90 min", nunca "xG").

## 3. Indicadores (lógica pura em `src/scout/metrics.ts`, testada em `tests/scout.test.ts`)

### Regras gerais
- Tudo **por 90 minutos** (`stat / min * 90`), com **amostra mínima** (padrão 450 min; filtro ajustável). Abaixo disso: "amostra pequena" e fora dos rankings.
- **Percentil por posição e por liga-grupo** (comparar zagueiro com zagueiro; Brasil, América do Sul, Europa top 5, outros). Mostrar sempre o percentil (0–100) além do número.
- **Ajuste de força da liga** (simples, explícito e editável): coeficiente por liga (ex.: Premier 1.00, LaLiga 0.97 … Brasileirão 0.80 … MLS 0.72). Usado só nos índices compostos, nunca escondido.
- Nota da posição (0–100) = média ponderada dos percentis dos indicadores da posição (pesos abaixo).

### Indicadores por posição (pesos da nota)
| Posição | Indicadores (por 90 salvo indicação) |
|---|---|
| **GOL** | defesas/90 (25), % defesas = defesas/(defesas+sofridos) (35), gols sofridos/90 invertido (20), pênaltis defendidos (5), nota média (15) |
| **ZAG** | desarmes+interceptações/90 (30), % duelos ganhos (30), bloqueios/90 (10), precisão de passe % (15), faltas cometidas/90 invertido (5), nota (10) |
| **LD / LE** | desarmes+intercept./90 (20), % duelos ganhos (15), passes decisivos/90 (20), assistências/90 (15), dribles certos/90 (15), nota (15) |
| **VOL** | desarmes+intercept./90 (30), % duelos ganhos (20), precisão de passe % (20), passes/90 (volume) (15), faltas cometidas invertido (5), nota (10) |
| **MEI** | passes decisivos/90 (30), assistências/90 (20), gols+assist./90 (15), dribles certos/90 (10), precisão de passe % (10), nota (15) |
| **PON** | dribles certos/90 (25), passes decisivos/90 (20), gols+assist./90 (25), finalizações no alvo/90 (10), faltas sofridas/90 (5), nota (15) |
| **ATA** | gols/90 (35), finalizações no alvo/90 (15), % finalizações no alvo (10), gols por finalização (conversão) (15), assistências/90 (10), nota (15) |

Também: **minutos jogados %** (disponibilidade), **titularidade %**, **cartões/90** (disciplina) — exibidos no perfil, fora da nota.

### Índices compostos (cruzam com o Mercado)
- **Custo-benefício**: nota da posição ÷ log(valor de mercado) — "quem rende mais por real investido" (respeitando a moeda escolhida no Mercado).
- **Potencial**: idade ≤ 21 com nota ≥ percentil 70 da posição, ou ≤ 23 com ≥ 80; bônus para minutos crescentes (titular jovem).
- **Oportunidade de contrato**: contrato termina até 30/06 do próximo ano (livre ou barato) e nota ≥ 60.
- **Subvalorizado**: nota alta (≥ 75) e valor abaixo da mediana da posição na liga.
- **Liga de exportação**: bom em liga com coeficiente baixo (não óbvio para quem só olha a Europa).
- **Risco**: amostra pequena, muitos cartões, idade ≥ 32 com contrato longo/caro.

## 4. Ferramentas prontas ("Buscas do olheiro")
Atalhos de um toque, cada um é um conjunto de filtros + ordenação, sempre por posição:
1. **Os óbvios** — top 10 por nota da posição (ligas do grupo escolhido).
2. **Não óbvios** — nota ≥ 75 em ligas fora do top 5 europeu, valor ≤ mediana.
3. **Joias** (potencial) — sub-21/sub-23 pelo índice de potencial.
4. **Fim de contrato** — oportunidade de contrato, ordenado pela nota.
5. **Custo-benefício** — maior índice custo-benefício que **cabe no saldo** do Mercado do clube.
6. **Reposição** — "parecidos com" um jogador que vai sair (mesma posição, perfil de percentis próximo por distância euclidiana, mais barato/jovem).
7. **Cobrir a carência** — usa o `depthChart` do Mercado: posições abaixo do mínimo viram buscas sugeridas ("Faltam 2 LE").

Filtros manuais: posição (com alternativas), liga/grupo, idade, valor (máx. e "cabe no saldo"), contrato até, minutos mínimos, estrangeiro (sim/não, com aviso do limite de 8), pé/altura (se vierem da API), nota mínima.

## 5. Prateleiras e Planos (o fluxo do scout)
- **Prateleiras** (status do jogador no radar, salvos por clube em `localStorage` `olheiro:{slug}:v1`, mesmo padrão de `mercado:{slug}:v1`):
  `Monitorar` → `Observar de perto` → `Prioridade` → `Descartado` (com motivo curto opcional).
- **Plano A / B / C por posição**: para cada posição carente (ou escolhida), uma fila ordenável (arrastar no desktop, setas no celular) com até 3–5 nomes. Mostra custo total do plano vs. saldo do Mercado.
- **Comparador**: até 3 jogadores lado a lado — radar/barras de percentis da posição + valor, idade, contrato, minutos.
- **Notas do olheiro**: texto curto por jogador (local).

## 6. Telas (identidade Mando: feltro, papel, latão, carimbos)
Rota: `/olheiro/{slug}` (clube do usuário define saldo, carências e "cabe no saldo"). `/olheiro` segue a regra de redirecionamento de `/mercado` (clube salvo ou home com escolha). `ModuleHeader` ganha o terceiro módulo (`nav.ts`: `ModuleId` += `"olheiro"`; segmentado Prancheta | Mercado | Olheiro).

Abas do módulo (desktop: faixa de etapas como o Mercado; celular: barra de abas inferior):
1. **Radar** — buscas do olheiro (cards grandes de atalho) + lista de resultados (ficha compacta: rosto, posição, liga, idade, valor, nota da posição em carimbo, 3 mini-barras dos indicadores-chave, botões "Prateleira" e "Plano").
2. **Prateleiras** — colunas (kanban no desktop; abas no celular) Monitorar / Observar / Prioridade / Descartado.
3. **Planos** — por posição: Plano A, B, C, com custo vs. saldo e botão "Levar ao mercado".
4. **Comparar** — até 3 fichas lado a lado (celular: troca deslizante).
Perfil do jogador: folha (sheet) com percentis da posição em barras, por 90 + totais, contexto (liga, minutos, amostra), índices (custo-benefício, potencial, contrato), prateleira, plano, nota do olheiro.

## 7. Integração com o Mercado (3 pontos)
1. **Mercado → Olheiro**: botão "Ver scout" nas fichas do mercado e do elenco → sheet compacta do perfil (mesmo componente do Olheiro), sem sair do Mercado.
2. **Olheiro → Mercado**: "Adicionar ao meu mercado" cria a contratação em `mercado:{slug}:v1` (`signings`, tipo compra/empréstimo/livre conforme contrato) e navega para `/mercado/{slug}` na aba Mercado; os Planos A/B/C podem ser levados em lote.
3. **Dados compartilhados**: o Olheiro lê `MarketPlayer` (valor, contrato, foto, estrangeiro) e o estado do Mercado (saldo, carências via `depthChart`, moeda/cotação via `setMoneyMode`).

Home: o crachá 03 vira **Olheiro** ("Crachá 03 · Análise de mercado"; arte: prancheta com lupa/carimbo "Prioridade"); "Presidente" sai ou vira crachá 04 "em breve".

## 8. Execução sugerida (para a próxima sessão)
Fable planeja os detalhes finos se necessário; Opus executa em paralelo com posse estrita de arquivos:
- **Agente Dados**: `scripts/scout/*` (coletor API-Football com cache, mapa de ligas, casamento com Transfermarkt, build para `src/data/scout/`), testes de casamento. Precisa da chave da API-Football (pedir com `request_credential` para `v3.football.api-sports.io` se não estiver no ambiente) e liberar o host na rede.
- **Agente Lógica**: `src/scout/metrics.ts`, `src/scout/searches.ts`, `src/scout/state.ts` + `tests/scout.test.ts` (por 90, percentis por posição, índices, buscas, prateleiras/planos). Pode trabalhar com fixture sintética local nos testes (não commitar dados fictícios em `src/data`).
- **Agente UI**: `src/scout/ScoutApp.tsx`, `scout.css`, componentes (Radar, Prateleiras, Planos, Comparar, PlayerSheet), rotas (`router.ts`, `App.tsx`), `src/brand/nav.ts`/`ModuleHeader` (terceiro módulo), Home (crachá 03).
- **Integração Mercado** (depois): botão "Ver scout" e "Adicionar ao meu mercado" em `src/market/*`.
Verificação: tsc, vitest, build, Playwright 390×844 e 1360×900, `scrollWidth<=innerWidth`, jornadas (home → Olheiro → busca → prateleira → plano → levar ao mercado → contratação aparece no balancete).

## 9. Riscos / decisões em aberto
- Limite gratuito da API-Football (100/dia): ~12 mil jogadores em 23 ligas ≈ 600+ páginas → coleta em vários dias com cache; começar por Brasil + América do Sul + top 5.
- Plano gratuito pode restringir temporadas recentes — **testar a temporada atual antes de tudo**.
- Casamento de nomes entre fontes: meta ≥ 90% casados nas ligas principais; resto aparece só com dados do Transfermarkt.
- Coeficientes de liga são opinião: deixar visíveis e editáveis.
- Monetização (assinatura/passe da janela, anúncios, licença de dados e imagens) fica para depois — ver conversa de 12/11/2026.

---

## 10. Ajuste de 12/11/2026 — dados só do Transfermarkt (decisão do usuário)
Teste real: o plano gratuito da API-Football só libera temporadas 2022–2024 (2025/2026 dão erro) e a conta aparece "suspensa".
Decisão: construir o Olheiro **agora com o Transfermarkt** (temporada atual) e deixar a camada de dados pronta para plugar a API-Football paga depois.

Dados por jogador (contrato em `src/scout/types.ts`): jogos, minutos, gols, assistências, cartões, gols sofridos e jogos sem sofrer gol **com o jogador em campo**, minutos em todas as competições, valor há 12 meses e pico de valor (`player_stats` + `player_market_value` do SDK `transfermarkt-api`).
Temporada: por liga, o maior `season_id` presente nos dados da liga (todos os jogadores comparados na mesma temporada).

Indicadores por posição (substituem a tabela da seção 3; sempre por 90 min, amostra mínima, percentil por posição):
| Posição | Indicadores |
|---|---|
| GOL | gols sofridos/90 (inverso), % jogos sem sofrer gol, % minutos jogados |
| ZAG | gols sofridos/90 em campo (inverso), % jogos sem sofrer gol, % minutos, gols/90 (bola parada), disciplina |
| LD/LE | assistências/90, G+A/90, gols sofridos/90 em campo (inverso), % minutos |
| VOL | % minutos, gols sofridos/90 em campo (inverso), G+A/90, disciplina |
| MEI | assistências/90, G+A/90, % minutos |
| PON | G+A/90, gols/90, assistências/90, % minutos |
| ATA | gols/90, G+A/90, % minutos |
Mais, para todos: **valorização em 12 meses** (%), idade, contrato, valor. Rótulos honestos ("gols sofridos com ele em campo", nunca "xG"/"desarmes").
