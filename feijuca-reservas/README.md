# Feijuca PDS — Listas e Reservas

App mobile-first para gerenciar a **lista VIP da portaria**, as **reservas de bistrô** e as
**reservas de lounge** da Feijuca do Papo de Samba. Cada evento tem gestão totalmente separada.

A base de dados é uma **planilha do Google Sheets** que já está criada na pasta `PDS` do seu Drive:

**PDS - Feijuca | Base de Dados (Listas & Reservas)**
https://docs.google.com/spreadsheets/d/1hn1MswrZH6yq0BXsUU7rPBGdRf9u6DIZxtrfPLohk6k/edit

---

## O que o app faz

- **Vários eventos**: cada Feijuca tem seus próprios lounges, bistrôs e lista VIP.
- **Lista VIP da portaria**: nome, documento, WhatsApp, acompanhantes, quem indicou,
  busca instantânea e check-in com um toque.
- **Mapa do salão**: planta da casa com o palco no centro, o anel de bistrôs em volta,
  os lounges nas extremidades e as mesas únicas entre o palco e o DJ. Toque numa posição
  para reservar, editar ou fazer check-in. Cor mostra o estado na hora:
  livre, reservado, check-in, bloqueado ou ainda não cadastrado.
- **Lista de lugares por pessoa**: a escala completa, posição por posição, incluindo as vazias —
  do jeito que a equipe lê hoje no grupo. É a visão padrão nas telas de Lounge, Bistrô e Mesas,
  e aparece abaixo do mapa.
- **Copiar lista do WhatsApp**: um toque monta o texto no formato que já se usa no grupo
  (🟠 LOUNGE / ⚪️ MESA / 🟢 BISTRÔ, uma linha por número, 🎂 no aniversariante) e copia para a
  área de transferência, com aviso de "Lista copiada".
- **Mover ou trocar pessoa de lugar**: na lista, o botão ao lado do nome abre todos os lugares.
  Tocar num vazio move; tocar num nome troca as duas de posição, com confirmação mostrando quem
  vai para onde.
- **Lounges**: com a regra de prioridade de aniversariante.
- **Regra do lounge** (o coração do app):
  - Enquanto faltar mais de 1 dia para o evento, **só aniversariante** pega lounge.
  - **Na véspera**, os lounges que sobraram liberam para qualquer pessoa, automaticamente.
  - O admin pode **destravar antes** pelo botão na tela do evento (útil quando está sobrando
    lounge e aparece um comprador).
  - O prazo de 1 dia é configurável por evento (campo "Prioridade (dias)").
- **Valores por evento**: lounge, bistrô e mesa nascem como **cortesia**. Cada evento define
  se cobra e quanto, em *Eventos → o evento → Valores da reserva*. Reserva sem valor aparece
  como "Gratuito", não como preço zerado.
- **Links de lista**: o admin cria um link por pessoa do grupo. Quem recebe abre um formulário,
  cola os nomes e envia. O link **não dá acesso ao app** — só empurra nomes para a lista da
  portaria daquele evento.
- **Perfis de acesso**: Administrador (tudo), Vendas (reservas + lista) e
  Portaria (só check-in e incluir nomes).
- **Trilha de auditoria**: toda criação/edição vai para a aba `Log` da planilha.

## Como é a navegação

- **Barra inferior**: Início · Mapa · Lista VIP · Lounge · Bistrô.
- **Menu hambúrguer**: perfil do usuário, mesas únicas, eventos, administração de usuários e sair.
- **Topo**: toque no nome do evento para trocar de evento a qualquer momento.
- Dá para **instalar na tela de início** do celular (é um PWA: Compartilhar → Adicionar à Tela de Início).
- **Nenhum diálogo do navegador.** Toda confirmação (cancelar reserva, apagar, remover da lista,
  trocar de lugar) é um modal do próprio app: bloqueador de pop-up não engole a pergunta, e cada
  uma explica a consequência antes de você tocar em confirmar.

---

## Configuração (faça uma vez)

O app fala com a planilha através de uma **conta de serviço** do Google. É de graça e leva ~5 minutos.

### 1. Criar a conta de serviço

> ⚠️ **Conta de serviço, não Cliente OAuth.** São duas credenciais diferentes no mesmo
> menu do Google Cloud. O Cliente OAuth (`client_secret_....json`, com os campos
> `client_id`/`client_secret`) serve para **uma pessoa logar** — não serve aqui.
> O app roda sozinho no servidor, então precisa de uma **conta de serviço**, cujo JSON
> tem `"type": "service_account"` e um campo `private_key`.

1. Acesse https://console.cloud.google.com/ e crie um projeto (ex.: `feijuca-pds`).
2. Em **APIs e serviços → Biblioteca**, procure **Google Sheets API** e clique em **Ativar**.
3. Em **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
   Dê um nome (ex.: `app-feijuca`) e conclua (pode pular as etapas opcionais de papel e acesso).
4. Abra a conta de serviço criada → aba **Chaves** → **Adicionar chave → Criar nova chave → JSON**.
   Um arquivo `.json` será baixado. É esse o arquivo que o app usa.

### 2. Dar acesso à planilha

Abra o arquivo JSON e copie o valor de `client_email`
(algo como `app-feijuca@feijuca-pds.iam.gserviceaccount.com`).

Na planilha do Google Sheets, clique em **Compartilhar** e adicione esse e-mail como **Editor**.

> Sem esse passo o app responde "Sem permissão na planilha".
> Como **Leitor** também não funciona: o app precisa escrever.

### 3. Gerar as variáveis com um comando

Na sua máquina, dentro de `feijuca-reservas`:

```bash
npm install
npm run configurar -- ~/Downloads/feijuca-pds-a1b2c3.json
```

O script confere se o JSON é do tipo certo, escreve o `.env.local`, **testa a leitura e a
escrita na planilha** e imprime as variáveis já formatadas para colar na Vercel.
Se algo estiver faltando (API desativada, planilha não compartilhada, ID errado),
ele diz exatamente o quê e onde resolver.

### 4. Publicar na Vercel

**Caminho curto — um comando faz tudo:**

```bash
cd feijuca-reservas
npm run deploy -- ~/Downloads/feijuca-pds-a1b2c3.json
```

O script valida a credencial, testa a planilha, faz login na Vercel (abre o navegador),
cria o projeto, cadastra as 4 variáveis nos três ambientes e publica em produção.
Se a credencial não passar no teste, ele **não** publica.

Como o comando roda de dentro de `feijuca-reservas/`, a Vercel já trata essa pasta como
raiz do projeto — não é preciso mexer em "Root Directory".

<details>
<summary><strong>Caminho manual pelo painel</strong> (se preferir clicar)</summary>

1. Suba este repositório para o GitHub.
2. Em https://vercel.com → **Add New → Project** → importe o repositório.
3. Em **Root Directory**, selecione **`feijuca-reservas`**.
4. Em **Environment Variables**, cadastre:

| Variável | Valor |
|---|---|
| `GOOGLE_SHEET_ID` | `1hn1MswrZH6yq0BXsUU7rPBGdRf9u6DIZxtrfPLohk6k` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | o `client_email` do JSON |
| `GOOGLE_PRIVATE_KEY` | o `private_key` do JSON, **inteiro**, incluindo `-----BEGIN PRIVATE KEY-----`, os `\n` e sem as aspas externas |
| `AUTH_SECRET` | um texto aleatório longo (`openssl rand -base64 32`) |

O `npm run configurar` imprime os quatro valores prontos para colar.

5. Clique em **Deploy**.

</details>

Depois do deploy, abra `https://seu-app.vercel.app/configuracao` para conferir se está tudo verde.

O plano gratuito (Hobby) da Vercel dá conta com folga: o app é leve e várias pessoas
podem usar ao mesmo tempo.

### 5. Primeiro acesso

Usuários já criados na aba `Usuarios` da planilha:

| Login | Senha | Perfil |
|---|---|---|
| `admin` | `pds2026` | Administrador |
| `portaria` | `portaria2026` | Portaria |
| `vendas` | `vendas2026` | Vendas |

> **Troque essas senhas no primeiro acesso** (menu → Usuários → toque no usuário → Nova senha).
> Cada pessoa da equipe deve ter o próprio login.

---

## Rodando na sua máquina

```bash
cd feijuca-reservas
npm install
npm run configurar -- caminho/para/chave-da-conta-de-servico.json
npm run dev                  # http://localhost:3000
```

Outros comandos:

```bash
npm run build      # build de produção
npm run typecheck  # checagem de tipos
npm test           # testes das regras de negócio
npm run deploy     # publica na Vercel (variáveis de ambiente incluídas)
```

---

## Estrutura da planilha (uma aba por tabela)

| Aba | Para que serve |
|---|---|
| `Eventos` | Cada Feijuca: nome, data, hora, local, status, limite da lista VIP, prazo da prioridade, a trava manual dos lounges e o valor cobrado por tipo (`valor_lounge`, `valor_bistro`, `valor_mesa`) |
| `Lounges` | Lounges numerados de cada evento (capacidade, valor, bloqueio) |
| `Bistros` | Bistrôs numerados de cada evento |
| `Mesas` | Mesas únicas de 4 cadeiras, perto do palco |
| `Reservas` | Reservas de lounge **e** de bistrô (campo `tipo`), com cliente, aniversariante, valor, sinal e check-in |
| `ListaVip` | Lista da portaria: nome, documento, acompanhantes, tipo, promoter, check-in e `lista_id` (o link que trouxe o nome) |
| `Listas` | Links públicos de envio de nomes: nome, `token`, responsável, limite e status |
| `Usuarios` | Quem acessa o app e com qual perfil (senha guardada como hash scrypt) |
| `Config` | Ajustes gerais (nome da casa, prazo padrão, contato) |
| `Log` | Histórico de tudo que foi criado, editado ou apagado |

Você pode editar a planilha à mão — o app lê e escreve nas mesmas colunas.
**Não renomeie as abas nem as colunas do cabeçalho.**

### Chaves e relacionamentos

- `Lounges.evento_id`, `Bistros.evento_id`, `Reservas.evento_id`, `ListaVip.evento_id` → `Eventos.id`
- `Reservas.unidade_id` → `Lounges.id`, `Bistros.id` ou `Mesas.id`, conforme o campo `tipo`
  (`LOUNGE`, `BISTRO` ou `MESA`)
- Uma unidade está ocupada quando existe reserva com status `PENDENTE`, `CONFIRMADA` ou `CHECKIN`.
  Cancelar uma reserva (`CANCELADA`) libera a mesa na hora.

---

## Detalhes técnicos

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**.
- API em Route Handlers no runtime Node, falando com a Sheets API via `googleapis`.
- Sessão em cookie `httpOnly` assinado com JWT (`jose`).
- Cache curto (8s) em memória nas leituras, para respeitar o limite de 60 leituras/minuto da Sheets API.
- Fuso horário fixado em `America/Sao_Paulo` no cálculo de "véspera".

### Mapa das rotas de API

| Rota | Método | Quem pode |
|---|---|---|
| `/api/auth/login`, `/logout`, `/me` | POST/GET | todos |
| `/api/eventos` | GET / POST | todos / admin |
| `/api/eventos/[id]` | GET / PATCH / DELETE | todos / admin / admin |
| `/api/unidades` | GET / POST | todos / admin |
| `/api/croqui` | POST | admin |
| `/api/listas` | GET / POST | admin+vendas / admin |
| `/api/listas/[id]` | PATCH / DELETE | admin |
| `/api/publico/lista/[token]` | GET / POST | **público** (só com o token) |
| `/api/unidades/[id]?tipo=` | PATCH / DELETE | admin |
| `/api/reservas` | GET / POST | todos / admin+vendas |
| `/api/reservas/[id]` | PATCH / DELETE | admin+vendas (check-in também portaria) / admin |
| `/api/vip` | GET / POST | todos |
| `/api/vip/[id]` | PATCH / DELETE | admin+vendas (status também portaria) |
| `/api/usuarios`, `/api/usuarios/[id]` | GET/POST/PATCH/DELETE | admin |
| `/api/resumo?evento_id=` | GET | todos |
| `/api/saude` | GET | público (diagnóstico) |

---

## Links de lista

Hoje cada pessoa do grupo manda a sua lista no WhatsApp e alguém consolida à mão. O link
substitui esse repasse.

**Como funciona.** Em *Lista VIP → ícone de link*, ou em *Menu → Links de lista*, o admin cria
uma lista por pessoa ("Lista do Davi"). Cada uma ganha um endereço próprio,
`/lista/<token>`, com um botão para copiar e outro para mandar no WhatsApp.

Quem abre o link vê o evento, o nome da lista, um campo de texto e o botão de enviar. Pode
**colar a mensagem do WhatsApp inteira**: numeração (`1.`, `2)`), travessão, bolinha e a linha
de cabeçalho "Lista do Davi (8 nomes)" são removidos. Reenviar a lista inteira com um nome a
mais funciona: quem já está é ignorado sem duplicar a linha. Ao enviar, um modal confirma
quantos nomes foram e quais.

Os nomes caem direto na Lista VIP com o promoter da lista, prontos para o check-in.

**O que o link não faz.** Não autentica ninguém e não abre nenhuma tela do app. Ele lê apenas o
evento (nome, data, local) e os dados da própria lista — nome, responsável e o recado. **Quem
envia não vê quem já está na lista nem quantos são**; isso é informação da equipe. Por isso o
endpoint público também não responde quais nomes já existiam: dizer "fulano já estava" deixaria
descobrir a lista inteira chutando nomes. Erros inesperados voltam com texto genérico, para não
expor configuração a quem não tem login.

**Controles do admin.** Pausar (o link para de aceitar e explica isso a quem abrir), encerrar,
gerar um token novo (invalida o endereço antigo na hora) e definir um limite de nomes por lista.
Apagar só funciona enquanto a lista não recebeu nada — depois disso o caminho é encerrar, para
não deixar nomes sem origem.

**Limites.** 60 nomes por envio, 20 mil caracteres por requisição, mais o limite da lista e o
limite de lista VIP do evento, se estiverem definidos. A proteção principal é o token ser
secreto: quem tiver o link pode enviar nomes, então trate-o como se fosse a chave da portaria.

---

## A lista do WhatsApp

O botão **Copiar lista do WhatsApp** gera exatamente o texto que o grupo já recebe:

```
FEIJUCA PDS
RESERVAS - 12/09/2026

🟠 LOUNGE
00 - PDS/CONVIDADO
01 - Rafael Rizzi
02 - Douglas PDS🎂
03 -
...
```

- Seções sempre nesta ordem: lounge, mesa, bistrô. Uma seção sem nenhuma unidade cadastrada
  é omitida.
- Números com dois dígitos, em ordem. Posições vazias entram como `07 -`, para a lista servir
  de convite: quem lê vê o que sobrou.
- Posição bloqueada sai como `07 - indisponível`, para ninguém pedir uma mesa fora de uso.
- Só reservas ativas aparecem; cancelar libera a linha na hora.

O formato vive em `src/lib/lista-whatsapp.ts` e é coberto por testes que comparam a saída com
o texto real usado pela equipe.

A cópia usa a Clipboard API, que exige HTTPS e pode ser negada pelo navegador. Há um plano B
com `textarea` e, se os dois falharem, o app abre o texto numa folha para copiar à mão.

---

## Mover e trocar reservas de lugar

Na lista, o botão ⇄ ao lado do nome abre os lugares de todas as seções.

**Lugar vazio move.** O servidor confere o mesmo que confere numa reserva nova: o destino existe,
é do mesmo evento, não está bloqueado nem ocupado; ir para um lounge respeita a prioridade de
aniversariante; a capacidade comporta o grupo; e o valor acompanha o novo tipo, a menos que a
reserva já tenha um preço combinado.

**Lugar com nome troca as duas.** Uma confirmação mostra quem sai de onde e vai para onde antes
de gravar. As duas linhas vão para a planilha **numa única requisição** (`values.batchUpdate`):
gravar uma de cada vez deixaria as duas reservas no mesmo número no meio do caminho, e quem
estivesse com a tela aberta veria conflito.

A regra do lounge na troca tem uma diferença que vale saber: ela vale para quem **entra** num
lounge vindo de outro tipo. Duas pessoas que já estão em lounges podem trocar de número entre si
mesmo sem serem aniversariantes — a prioridade protege a entrada, não o rodízio interno.

---

## Valores e cortesia

O preço não fica preso na unidade: quem manda é o evento.

- `Eventos.valor_lounge`, `valor_bistro` e `valor_mesa` guardam o valor padrão de cada tipo.
  **Vazio ou `0` significa cortesia** — é o padrão de um evento novo.
- Ao criar unidades (uma a uma ou pelo croqui), o valor vem do evento.
- Em *Valores da reserva* você liga **Cobrar por reserva**, preenche os três campos e salva.
  Com **"Aplicar nas unidades já cadastradas"** ligado, as unidades do evento passam a valer
  o novo preço numa única chamada à planilha — **exceto** as que já têm reserva ativa, que
  mantêm o valor combinado com o cliente.
- O campo aceita o que se digita no celular: `600`, `R$ 600,00`, `1.200`, `1.200,50`, `250,50`.
  Qualquer coisa que não vire um número positivo é tratada como cortesia.

---

## O croqui da casa

O mapa é um **molde** descrito em `src/lib/croqui.ts`: ele diz apenas **onde** cada posição
fica no salão. Quem manda no que existe de verdade é a planilha.

- Uma posição que está no croqui mas não no evento aparece **apagada**; um admin toca nela
  para cadastrar, ou usa **"Cadastrar as N posições que faltam"** no topo do mapa.
- Uma unidade cadastrada que o croqui não prevê (outra casa, um extra) aparece na
  faixa **"Fora do croqui"** logo abaixo do mapa, e continua clicável.
- Em **Eventos → o evento → "Aplicar croqui do Soulbrado"** o app cria de uma vez as 33
  posições da casa. É idempotente: rodar de novo não duplica nada.

O croqui atual (`SOULBRADO`) tem 15 lounges (00–14), 15 bistrôs (01–15) e 3 mesas únicas
(01–03). Para outra casa, acrescente um novo objeto `Croqui` no mesmo arquivo e inclua-o
em `CROQUIS`. Os testes de geometria (`npm test`) conferem numeração, marcadores fora do
desenho, sobreposição entre marcadores e invasão do palco.

---

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| "A chave GOOGLE_PRIVATE_KEY está inválida" | Cole o `private_key` inteiro do JSON, com `\n` e aspas |
| "Sem permissão na planilha" | Compartilhe a planilha com o `client_email` como **Editor** |
| "Planilha não encontrada" | Confira o `GOOGLE_SHEET_ID` |
| "A Google Sheets API não está habilitada" | Ative a Sheets API no projeto do Google Cloud |
| "Este é um JSON de Cliente OAuth" | Você baixou a credencial errada — crie uma **conta de serviço** (passo 1) |
| "Lounge é exclusivo de aniversariante..." | É a regra funcionando. Marque "É aniversariante" ou destrave na tela do evento |
