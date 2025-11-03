# StartProof - Landing Page

Landing page de smoke test para validação do produto StartProof, uma plataforma de validação de startups com IA.

## 🎯 Objetivo

Esta landing page foi criada como uma **cortina de fumaça** (smoke test) para medir o interesse do público antes do lançamento do MVP. O foco principal é capturar leads interessados através de uma lista de espera.

## 🚀 Como Usar

### Visualização Local

1. Abra o arquivo `index.html` diretamente no navegador
2. Ou use um servidor local:
   ```bash
   # Python 3
   python -m http.server 8000

   # PHP
   php -S localhost:8000

   # Node.js (http-server)
   npx http-server
   ```
3. Acesse `http://localhost:8000`

### Deploy

A landing page é 100% estática e pode ser hospedada em:

- **GitHub Pages** (gratuito)
- **Netlify** (gratuito)
- **Vercel** (gratuito)
- **Cloudflare Pages** (gratuito)

## 📊 Captura de Leads

Atualmente, o formulário salva os leads no `localStorage` do navegador (apenas para demonstração).

### Integrações Recomendadas

Para produção, você deve integrar com uma ferramenta de captura de leads:

#### 1. Google Sheets (Gratuito)
```javascript
// Em script.js, adicione:
async function sendToGoogleSheets(formData) {
    const url = 'SUA_URL_DO_GOOGLE_APPS_SCRIPT';
    await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });
}
```

#### 2. Mailchimp
```javascript
// Em script.js, adicione:
async function sendToMailchimp(formData) {
    const url = 'SUA_URL_DO_MAILCHIMP_API';
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email_address: formData.email,
            status: 'subscribed',
            merge_fields: {
                FNAME: formData.name,
                STAGE: formData.stage
            }
        })
    });
}
```

#### 3. Typeform / Tally / Google Forms
Substitua o formulário HTML por um embed dessas ferramentas.

#### 4. Notion Database
Use a API do Notion para salvar diretamente em um banco de dados.

## 📈 Analytics

### Google Analytics 4
Adicione antes do `</head>` no `index.html`:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Meta Pixel (Facebook Ads)
```html
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'SEU_PIXEL_ID');
fbq('track', 'PageView');
</script>
```

## 🎨 Personalização

### Cores
Edite as variáveis CSS em `styles.css`:

```css
:root {
    --primary: #6366f1;  /* Cor principal */
    --secondary: #10b981;  /* Cor secundária */
    --dark: #0f172a;  /* Cor escura */
    /* ... */
}
```

### Conteúdo
Todo o conteúdo pode ser editado diretamente no `index.html`.

### Logo
Substitua o emoji 🚀 no header por uma imagem:

```html
<div class="logo">
    <img src="logo.png" alt="StartProof" class="logo-icon">
    <span class="logo-text">StartProof</span>
</div>
```

## 📱 Responsividade

A landing page é totalmente responsiva e otimizada para:
- Desktop (1920px+)
- Laptop (1024px - 1920px)
- Tablet (768px - 1024px)
- Mobile (320px - 768px)

## ✅ Checklist de Lançamento

Antes de colocar no ar:

- [ ] Configurar ferramenta de captura de leads (Google Sheets, Mailchimp, etc.)
- [ ] Adicionar Google Analytics ou similar
- [ ] Adicionar Meta Pixel (se for rodar ads)
- [ ] Testar formulário em diferentes dispositivos
- [ ] Configurar domínio personalizado
- [ ] Adicionar SSL (HTTPS)
- [ ] Testar velocidade de carregamento
- [ ] Validar SEO (título, descrição, OG tags)

## 🔧 Tecnologias

- HTML5
- CSS3 (Variáveis CSS, Grid, Flexbox)
- JavaScript (Vanilla, sem frameworks)
- Google Fonts (Inter)

## 📄 Estrutura de Arquivos

```
.
├── index.html       # Estrutura da landing page
├── styles.css       # Estilos e responsividade
├── script.js        # Interatividade e captura de leads
├── README.md        # Este arquivo
└── data_EDA.csv     # (arquivo existente no projeto)
```

## 💡 Próximos Passos

1. **Validação**: Lance a página e comece a capturar emails
2. **Tráfego**: Compartilhe em redes sociais, grupos, comunidades
3. **Ads** (opcional): Facebook Ads, Google Ads com orçamento pequeno
4. **Medir**: Acompanhe quantos visitantes → quantos cadastros (taxa de conversão)
5. **Aprender**: Faça entrevistas com quem se cadastrou
6. **Iterar**: Ajuste a mensagem baseado no feedback

## 🎯 Meta de Validação

Considere validado se:
- Conseguir X emails em Y dias
- Taxa de conversão > Z%
- Feedback positivo nas entrevistas

**Defina suas próprias metas!**

---

Criado com 💜 para validação do StartProof