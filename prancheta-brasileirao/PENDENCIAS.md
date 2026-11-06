# Pendências

Atualizado em 06/11/2026. O que está feito vai no fim do arquivo.

## Precisam de você

1. **Posições detalhadas (o maior buraco dos dados).** 523 dos 735 jogadores estão com posição genérica (ZAG/MEI/ATA), porque a API-Football só informa Defender/Midfielder/Attacker e o TheSportsDB gratuito cobre ~9 jogadores por time. Na prática: laterais aparecem como ZAG, volantes e pontas como MEI/ATA, e as formações automáticas escalam errado (no Vasco, o Lucas Piton entra de zagueiro).
   - Opção A: você preenche `data/overrides/{slug}.json` (o `npm run review -- --team=vasco` lista id, nome e posição atual).
   - Opção B: eu monto um rascunho de LD/LE/VOL/PON e apelidos por time e você só revisa. Recomendo começar pelos times das lives que você já tem em vista.
2. **134 nomes abreviados** ("J. Rojas", "A. Gómez"). Corrige no mesmo override com `displayName`.
3. **Domínio e nome do site.** A marca d'água usa o endereço em que o site está rodando. Falta decidir o nome/domínio definitivo (ex.: `pranchetabrasileirao.com.br`). "Prancheta Brasileirão" é provisório.
4. **Deploy na Vercel.** O `vercel.json` já está pronto (diretório raiz do projeto: `prancheta-brasileirao`). Preciso que você conecte o repositório na Vercel, ou me passe um token, para eu publicar e te mandar a URL para testar no OBS.
5. **Secret `API_FOOTBALL_KEY` no GitHub** (Settings → Secrets → Actions) para a sincronização semanal funcionar.
6. **Revisar as cores dos clubes** em `data/team-colors.json` (preenchidas de memória).
7. **Termos da API-Football sobre exibir as fotos publicamente** (seção 8 do plano). Não verifiquei. Se houver restrição, deixo "sem fotos" como padrão em tudo, não só no `?safe=1`.

## Decisões técnicas a confirmar

- **Open Graph dinâmico (5.3).** O estado da escalação está no `#hash` da URL, que o navegador não envia ao servidor, então a prévia do WhatsApp não consegue ler a escalação. Para o OG dinâmico, o link precisa usar `?s=` em vez de `#s=` e ter uma função na Vercel (`@vercel/og`). Dá para fazer junto com o deploy.
- **Analytics.** Instalei o Vercel Analytics (sem cookies). Ele registra `creator_visit` (quem chegou por `?creator=`), `share_link` e `export_image`. Só funciona depois do deploy e com o Analytics ligado no painel da Vercel. Se preferir o Plausible, troco.
- **Plano gratuito da API-Football.** Funciona para os elencos (~21 requisições por sync). Não precisa assinar.

## Ainda não feito

- Votação da torcida (5.2, fora do MVP por precisar de backend).
- GIF/vídeo curto na página `/creator` e kit de divulgação por clube (thumbnails, frames).
- Ranking interno de influenciadores por acessos (depende do analytics no ar).
- Lint + Prettier (Fase 3).
- Limpeza de fotos de jogadores que saíram do elenco (hoje elas ficam em `public/players`, mas não aparecem).
- Testar a fonte de navegador num OBS de verdade. Validei no Chromium headless: o fundo transparente renderiza transparente.

## Feito

- Pipeline de dados (fase 1) com os 20 times, relatório de lacunas e overrides vazios.
- Home com os 20 escudos e busca.
- Prancheta: elenco com filtro por posição, adversário em fichas 1–32 com cor ou com o elenco real de outro clube, arrastar e soltar (mouse e toque), substituição soltando o reserva em cima do titular, 6 formações com transição animada, modo compacto, telestrador, desfazer, atalhos, setas do teclado, localStorage por clube.
- Modo Live (`/{slug}/live`): 16:9 e 9:16, fundo gramado/sólido/chroma/transparente, peças P/M/G, placar com cronômetro, lista de substituições, avatares sem foto, @ do criador, URL pronta para o OBS e link para o chat.
- Compartilhamento: link com a escalação, Web Share no celular, imagem 1080x1350 (feed), 1080x1920 (story) e o campo como está na tela.
- `/creator` com gerador de URL, passo a passo do OBS, atalhos e aviso sobre imagens; `?creator=` rastreado e repassado nos links compartilhados.
- GitHub Action semanal (`.github/workflows/prancheta-sync.yml`) que abre PR quando os elencos mudam.
- 37 testes (pipeline, formações, link compartilhável).
