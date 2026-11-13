# Plano — produto focado no Mercado (persona única: diretor de futebol)

Motivo (13/11/2026): um amigo do autor abriu a home e ficou perdido. Três crachás = três escolhas antes de entender o produto.
Decisão: o job to be done é UM — **"assuma o seu clube e monte a janela de transferências 2027"**. Sem crachás, sem papéis.
A Prancheta vira ferramenta extra (fora do fluxo principal). O Olheiro vira parte da ida às compras (fase 3, por último).
Identidade visual não muda (feltro, papel, latão, carimbos, escudo Meu Elenco FC). Publicar a cada fase.

## Fase 1 — Home que diz o que fazer
Estrutura (curta, sem rolagem longa; celular primeiro):
1. Topo: logo + botão Entrar (como hoje).
2. Hero: eyebrow "Janela de transferências 2027"; H1 "Você é o diretor de futebol. **Monte o seu elenco.**" (ou equivalente curto e direto);
   sub: "Chega de só cornetar. Escolha o seu clube, decida quem fica, quem sai e quem chega, e mostre como se faz."
3. AÇÃO PRINCIPAL logo abaixo, impossível de errar:
   - Sem clube salvo: título "1º passo: escolha o seu clube" + grade dos 20 escudos NA PRÓPRIA HOME (toque no escudo → `/mercado/{slug}` direto, salva `mando:clube`). Busca opcional acima da grade no celular.
   - Com clube salvo: cartão grande "Continuar a janela do {clube}" (escudo, saldo e progresso se existirem em `mercado:{slug}:v1`: nº de decisões, contratações) com botão latão "Continuar →", e link "Trocar de clube" (abre ClubSheet → vai para o mercado do clube escolhido).
4. "Como funciona" em 3 passos visuais numa faixa (ícone/mini-arte + 1 linha cada): ① Decida o elenco (quem fica, vende, empresta) ② Vá às compras (23 ligas, valores reais) ③ Escale e compartilhe (gera a imagem do seu time). Pode reaproveitar as mini-artes da ficha carimbada e do campinho.
5. Prova visual: miniatura dos dois posts gerados (imagens estáticas em `public/brand/` geradas a partir dos posts reais) com legenda "No final, você posta a sua janela". Opcional se pesar na página.
6. Rodapé: "Ferramenta extra: Prancheta tática →" (link discreto para `/prancheta`, que segue a regra atual de redirecionamento), link do modo live para criadores, aviso de projeto independente.
Remover: crachás, textos "Escolha seu papel", cartão Olheiro, `?modulo=prancheta|olheiro` como caminho principal (manter compatibilidade: `?modulo=` continua funcionando para links antigos).
Arquivos: `src/home/Home.tsx`, `src/home/home.css` (+ assets em `public/brand/`). Título/descrição em `index.html` e manifest: foco em "monte a janela de transferências do seu clube".

## Fase 2 — Navegação e textos coerentes com o foco
- `ModuleHeader`: sai o seletor Prancheta | Mercado | Olheiro. No Mercado, o cabeçalho é: logo → home, clube (trocar), ações, conta, menu ⋯.
  Menu ⋯ do Mercado: Como funciona, Tour, "Prancheta tática (extra)", "Olheiro" (temporário até a fase 3), Trocar de clube, Início.
  Na Prancheta: cabeçalho com link claro "← Voltar à janela do {clube}" (para `/mercado/{slug}`) e a etiqueta "Ferramenta extra".
  No Olheiro (até a fase 3): mesmo link de volta ao Mercado.
- Guia inicial do Mercado e tour: revisar textos para a persona única (já é "diretor de futebol"); remover menções a crachá/papel.
- Na etapa 4 (Compartilhe), um atalho "Desenhar a tática deste time na prancheta →" (leva a `/{slug}`), como uso natural da ferramenta extra.
- README/PENDENCIAS atualizados.
Arquivos: `src/brand/ModuleHeader.tsx`, `module-header.css`, `nav.ts`, `src/market/MarketApp.tsx` (menu/atalho), `src/components/Board.tsx`/`MobileShell.tsx` (link de volta), `src/scout/ScoutApp.tsx` (link de volta).

## Fase 3 — Olheiro dentro da ida às compras (por último) — FEITA
- Etapa 2 "Mercado" ganha as ferramentas do olheiro: buscas prontas (Os óbvios, Não óbvios, Joias, Fim de contrato, Custo-benefício, Reposição, Cobrir a carência) como atalhos acima da lista; nota 0–100 em carimbo nas fichas; "Ver scout" abre o relatório (já existe).
- Prateleiras e Planos A/B/C viram uma sub-aba da etapa 2 ("Minha lista"), substituindo/absorvendo a estrela de "guardar para depois" do Mercado.
- `/olheiro/{slug}` redireciona para `/mercado/{slug}?aba=mercado`; estado `olheiro:{slug}:v1` é preservado e lido pelo Mercado.
- Remover o módulo Olheiro da navegação; manter `src/scout/metrics|searches|state|data` como biblioteca.

Decisões (fase 3):
- Etapa 2 = sub-abas **Procurar** (padrão) e **Minha lista** (com contador). Código em `src/market/Shopping.tsx`, carregado só ao abrir a etapa 2 (o chunk principal não cresceu; `ScoutApp`, `Radar`, `Boards`, `context` foram apagados).
- Atalhos rodam sobre a liga escolhida no seletor (e os filtros); o seletor de grupo do antigo Radar e os filtros extras (minutos, nota mín., valor máx.) saíram. "Reposição" pede um jogador do elenco.
- "Guardar na lista" substitui a ★. Minha lista usa o mesmo estado `olheiro:{slug}:v1`: Plano A/B/C = ordem em `plans[pos]` (B só existe se houver A; o novo A empurra o antigo para B); "Observando" = prateleira; descartados ficam ocultos. ★ antigo migrado uma vez (`mergeWatch`) e `watch` zerado.
- Comparador **fora** da interface (código e estado mantidos): não coube de forma simples. O perfil ("Ver scout") troca a "Mesa do olheiro" por "Minha lista" (prioridade, tirar, anotação).
- Correção: redirecionamentos no primeiro carregamento (`/mercado`, `/prancheta`, `/olheiro`) ficavam em branco; `useRoute` agora sincroniza ao assinar o `popstate`.

## Verificação por fase
tsc, vitest, build; Playwright 390×844 e 1360×900; `scrollWidth<=innerWidth`; jornada: abrir a home sem nada salvo → tocar num escudo → cair no guia do Mercado; voltar à home → "Continuar a janela". Depois de verde: commit, push, deploy.
