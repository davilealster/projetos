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
- **Bistrôs, lounges e mesas únicas numerados**: também em lista, com os mesmos controles.
- **Lounges**: com a regra de prioridade de aniversariante.
- **Regra do lounge** (o coração do app):
  - Enquanto faltar mais de 1 dia para o evento, **só aniversariante** pega lounge.
  - **Na véspera**, os lounges que sobraram liberam para qualquer pessoa, automaticamente.
  - O admin pode **destravar antes** pelo botão na tela do evento (útil quando está sobrando
    lounge e aparece um comprador).
  - O prazo de 1 dia é configurável por evento (campo "Prioridade (dias)").
- **Perfis de acesso**: Administrador (tudo), Vendas (reservas + lista) e
  Portaria (só check-in e incluir nomes).
- **Trilha de auditoria**: toda criação/edição vai para a aba `Log` da planilha.

## Como é a navegação

- **Barra inferior**: Início · Mapa · Lista VIP · Lounge · Bistrô.
- **Menu hambúrguer**: perfil do usuário, mesas únicas, eventos, administração de usuários e sair.
- **Topo**: toque no nome do evento para trocar de evento a qualquer momento.
- Dá para **instalar na tela de início** do celular (é um PWA: Compartilhar → Adicionar à Tela de Início).

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
| `Eventos` | Cada Feijuca: nome, data, hora, local, status, limite da lista VIP, prazo da prioridade e a trava manual dos lounges |
| `Lounges` | Lounges numerados de cada evento (capacidade, valor, bloqueio) |
| `Bistros` | Bistrôs numerados de cada evento |
| `Mesas` | Mesas únicas de 4 cadeiras, perto do palco |
| `Reservas` | Reservas de lounge **e** de bistrô (campo `tipo`), com cliente, aniversariante, valor, sinal e check-in |
| `ListaVip` | Lista da portaria: nome, documento, acompanhantes, tipo, promoter e check-in |
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
| `/api/unidades/[id]?tipo=` | PATCH / DELETE | admin |
| `/api/reservas` | GET / POST | todos / admin+vendas |
| `/api/reservas/[id]` | PATCH / DELETE | admin+vendas (check-in também portaria) / admin |
| `/api/vip` | GET / POST | todos |
| `/api/vip/[id]` | PATCH / DELETE | admin+vendas (status também portaria) |
| `/api/usuarios`, `/api/usuarios/[id]` | GET/POST/PATCH/DELETE | admin |
| `/api/resumo?evento_id=` | GET | todos |
| `/api/saude` | GET | público (diagnóstico) |

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
