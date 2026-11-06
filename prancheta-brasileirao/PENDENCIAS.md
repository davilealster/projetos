# Pendências

Atualizado em 06/11/2026. O que está feito vai no fim do arquivo.

## Precisam de você

1. **Revisar o rascunho de posições no `/admin`.** 443 jogadores têm posição principal + 2 alternativas tiradas da Wikipédia (marcados "Wikipédia" no painel). As alternativas padrão por posição (ex.: zagueiro → volante e lateral) são palpite e merecem um olhar. Use o filtro "Não revisados" e marque "Revisado" conforme for conferindo.
2. **216 jogadores ainda com posição genérica** (filtro "Posição genérica" no painel): quase todos da base/reservas, que a Wikipédia não lista. 37 nomes ainda abreviados.
3. **Domínio e nome do site.** A marca d'água usa o endereço em que o site está rodando. Falta decidir o nome/domínio definitivo (ex.: `pranchetabrasileirao.com.br`). "Prancheta Brasileirão" é provisório.
4. **Deploy automático a cada push.** O site está publicado em https://prancheta-brasileirao.vercel.app (deploy manual pelo CLI em 06/11/2026). Para cada push publicar sozinho, conecte o repositório no painel da Vercel (Settings → Git, Root Directory = `prancheta-brasileirao`).
5. **Secret `API_FOOTBALL_KEY` no GitHub** (Settings → Secrets → Actions) para a sincronização semanal funcionar.
6. **Revisar as cores dos clubes** em `data/team-colors.json` (preenchidas de memória).
7. **Termos da API-Football sobre exibir as fotos publicamente** (seção 8 do plano). Não verifiquei. Se houver restrição, deixo "sem fotos" como padrão em tudo, não só no `?safe=1`.

## Decisões técnicas a confirmar

- **Open Graph dinâmico (5.3).** O estado da escalação está no `#hash` da URL, que o navegador não envia ao servidor, então a prévia do WhatsApp não consegue ler a escalação. Para o OG dinâmico, o link precisa usar `?s=` em vez de `#s=` e ter uma função na Vercel (`@vercel/og`). Dá para fazer junto com o deploy.
- **Analytics.** Instalei o Vercel Analytics (sem cookies). Ele registra `creator_visit` (quem chegou por `?creator=`), `share_link` e `export_image`. Só funciona depois do deploy e com o Analytics ligado no painel da Vercel. Se preferir o Plausible, troco.
- **Plano gratuito da API-Football.** Funciona para os elencos (~21 requisições por sync). Não precisa assinar.

## Ainda não feito

- Trocar a senha padrão do admin (botão "Trocar senha" no painel).
- Os ajustes do admin vivem no Vercel Blob. Para guardá-los também no git, use "Exportar JSON" de vez em quando (backup).

- Votação da torcida (5.2, fora do MVP por precisar de backend).
- GIF/vídeo curto na página `/creator` e kit de divulgação por clube (thumbnails, frames).
- Ranking interno de influenciadores por acessos (depende do analytics no ar).
- Lint + Prettier (Fase 3).
- Limpeza de fotos de jogadores que saíram do elenco (hoje elas ficam em `public/players`, mas não aparecem).
- Testar a fonte de navegador num OBS de verdade. Validei no Chromium headless: o fundo transparente renderiza transparente.

## Feito

- Pesquisa de posições na Wikipédia para os 20 clubes, importada como rascunho (principal + 2 alternativas).
- Posição principal + 2 alternativas; clique no jogador em campo escolhe a posição na escalação.
- Painel `/admin` com login (Vercel Blob privado): edição por clube e jogador, troca de senha, exportação.
- Pipeline de dados (fase 1) com os 20 times, relatório de lacunas e overrides vazios.
- Home com os 20 escudos e busca.
- Prancheta: elenco com filtro por posição, adversário em fichas 1–32 com cor ou com o elenco real de outro clube, arrastar e soltar (mouse e toque), substituição soltando o reserva em cima do titular, 6 formações com transição animada, modo compacto, telestrador, desfazer, atalhos, setas do teclado, localStorage por clube.
- Modo Live (`/{slug}/live`): 16:9 e 9:16, fundo gramado/sólido/chroma/transparente, peças P/M/G, placar com cronômetro, lista de substituições, avatares sem foto, @ do criador, URL pronta para o OBS e link para o chat.
- Compartilhamento: link com a escalação, Web Share no celular, imagem 1080x1350 (feed), 1080x1920 (story) e o campo como está na tela.
- `/creator` com gerador de URL, passo a passo do OBS, atalhos e aviso sobre imagens; `?creator=` rastreado e repassado nos links compartilhados.
- GitHub Action semanal (`.github/workflows/prancheta-sync.yml`) que abre PR quando os elencos mudam.
- 37 testes (pipeline, formações, link compartilhável).
