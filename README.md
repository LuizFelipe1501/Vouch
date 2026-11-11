# Vouch

Assistente antigolpes no WhatsApp: a pessoa encaminha a mensagem suspeita, o Vouch avisa se parece golpe e confirma com alguém da família antes de qualquer pagamento. Funciona em português, espanhol e inglês.

## Estrutura

- `public/` site estático
  - `index.html`: página principal (PT/ES/EN)
  - `teste.html`: teste com três celulares (quem recebe o golpe, a família e o golpista), abre em `/teste`
  - `privacidade.html`: política de privacidade (usada no app da Meta)
  - `console.html`: console antigo de testes
- `api/` funções serverless (Vercel)
  - `meta.js`: webhook do WhatsApp oficial (Meta Cloud API)
  - `chat.js`: mesma conversa via HTTP, usada pelo `/teste`
  - `card.mjs`: gera os cartões coloridos de veredito
  - `whatsapp.js`: webhook do Twilio (alternativa)
  - `cron.js`: treino diário; `waitlist.js`: lista de espera; `shot.mjs`: imagens de tela para o deck
- `lib/` lógica do bot (`bot.js`), modo isca em que a Vee conversa com o golpista (`decoy.js`), regras (`engine.js`), textos (`i18n.js`, `plan_i18n.js`), serviços (`services.js`: Supabase, Gemini, Twilio)
- `supabase.sql` tabelas `vouch_users`, `vouch_waitlist`, `vouch_reports`

## Como publicar

1. Suba esta pasta para um repositório no GitHub.
2. No Vercel, importe o repositório (Framework: Other, sem build).
3. Cadastre as variáveis de `.env.example` em Settings > Environment Variables.
4. No app da Meta, webhook: `https://SEU-DOMINIO/api/meta`, token de verificação = `META_VERIFY_TOKEN`, campo `messages`.

## Rodar localmente

```
npm install
npx vercel dev
```
