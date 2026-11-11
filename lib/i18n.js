// Country and language support. The bot picks the language from the WhatsApp country code,
// and switches if the person writes in another supported language.
const COUNTRIES = {
  '55': { code: 'BR', lang: 'pt', cur: 'BRL', after: 'pt_BR' },
  '52': { code: 'MX', lang: 'es', cur: 'MXN', after: 'es_MX' },
  '57': { code: 'CO', lang: 'es', cur: 'COP', after: 'es_CO' },
  '54': { code: 'AR', lang: 'es', cur: 'ARS', after: 'es' },
  '56': { code: 'CL', lang: 'es', cur: 'CLP', after: 'es' },
  '51': { code: 'PE', lang: 'es', cur: 'PEN', after: 'es' },
  '91': { code: 'IN', lang: 'en', cur: 'INR', after: 'en_IN' },
};
const DEFAULT = { code: 'XX', lang: 'en', cur: 'USD', after: 'en' };

function countryOf(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  for (const cc of Object.keys(COUNTRIES)) if (d.startsWith(cc)) return { cc, ...COUNTRIES[cc] };
  return { cc: d.slice(0, 2), ...DEFAULT };
}

// Light language guess from text, used only to switch away from the country default.
function guessLang(t) {
  const s = ' ' + String(t || '').toLowerCase() + ' ';
  const score = {
    pt: (s.match(/ (você|voce|não|nao|está|obrigad|preciso|mãe|pai|sou eu|celular|golpe|dinheiro|pix|então|tá) /g) || []).length,
    es: (s.match(/ (usted|tú|tu|necesito|mamá|mama|papá|papa|soy yo|dinero|estafa|cuenta|ahora|gracias|por favor|está|número) /g) || []).length,
    en: (s.match(/ (you|your|need|mom|dad|it's me|money|scam|account|please|thanks|the|is|send) /g) || []).length,
  };
  const best = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
  return score[best] >= 2 ? best : null;
}

function money(cents, cur) {
  try { return new Intl.NumberFormat(cur === 'BRL' ? 'pt-BR' : cur === 'INR' ? 'en-IN' : 'es-MX', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(cents / 100); }
  catch (e) { return String(Math.round(cents / 100)); }
}

// What to do if money already left. Only facts checked for each country; others get the generic line.
const AFTER = {
  pt_BR: 'Se você já pagou: ligue agora para o seu banco e peça o MED (Mecanismo Especial de Devolução do Pix). Depois registre um boletim de ocorrência. Quanto antes, maior a chance de recuperar.',
  es_MX: 'Si ya pagó: llame ahora a su banco y reporte el fraude. También puede presentar una reclamación ante la Condusef. Mientras más rápido, más posibilidades de recuperar el dinero.',
  es_CO: 'Si ya pagó: llame ahora a su banco y reporte el fraude desde la app; luego denuncie ante las autoridades. Mientras más rápido, más posibilidades de recuperar el dinero.',
  es: 'Si ya pagó: llame ahora a su banco y reporte el fraude; luego denuncie ante las autoridades. Mientras más rápido, mejor.',
  en_IN: 'If you already paid: call the national cyber fraud helpline 1930 right now and file a complaint at cybercrime.gov.in, then call your bank. Funds can be frozen if you report within minutes.',
  en: 'If you already paid: call your bank right now and report the fraud, then file a police report. The faster you act, the better the chance of recovery.',
};

const T = {
  pt: {
    flags: { money: ['Pede dinheiro', 'A mensagem pede Pix, boleto ou pagamento.'], urgency: ['Tem pressa', 'Quer que você aja agora. Emergência de verdade aguenta 5 minutos de checagem.'], newnumber: ['Número novo', 'Alguém conhecido aparece de um número ou conta que você nunca viu.'], family: ['Usa a família', 'Usa um laço de família e uma emergência para você não pensar.'], secrecy: ['Pede segredo', 'Pede para não contar a ninguém. Golpe depende de você estar só.'], authority: ['Fala em nome de banco ou órgão', 'Banco e governo não resolvem nada por mensagem assim.'], credentials: ['Pede senha ou código', 'Ninguém de verdade precisa da sua senha ou do código que chegou.'], prize: ['Bom demais', 'Prêmio, reembolso ou renda fácil é a isca mais comum.'], link: ['Link estranho', 'O endereço do link não é o site oficial.'], voice: ['É áudio', 'Voz conhecida não é prova. Dá para clonar com poucos segundos.'] },
    levels: ['Aprendiz', 'Vigia', 'Guardião', 'Sentinela'],
    welcome: 'Oi! Eu sou o Vouch. Antes de pagar, clicar ou passar um código, encaminhe a mensagem para mim: eu digo se parece golpe e, se usarem o nome de alguém da sua família, confirmo com a pessoa de verdade.\n\nComo posso te chamar?',
    askGuardian: n => `Prazer, ${n}. Agora me diga o número de WhatsApp de alguém de confiança (filho, neta, irmão). Quando usarem o nome dessa pessoa para te pedir dinheiro, eu pergunto direto a ela.\nEx.: 61 99999-0000.`,
    badNumber: 'Não entendi o número. Mande com DDD, assim: 61 99999-0000',
    guardianSet: ask => 'Pronto. Avisei esse contato.' + (ask ? '\nÚltimo passo: combinem uma palavra de segurança que só a família sabe e me mande assim: PALAVRA jabuticaba. Ou mande PULAR.' : ''),
    invite: n => `${n || 'Alguém da sua família'} escolheu você como pessoa de confiança no Vouch, o assistente antigolpes da família. Quando usarem seu nome para pedir dinheiro, eu te pergunto aqui e você responde com um toque. Mande OI para começar.`,
    wordSet: 'Palavra guardada. Regra de ouro: quem pede dinheiro é que tem que dizer a palavra. Você nunca fala primeiro.\n\nTudo pronto. Quando chegar algo estranho, encaminhe para mim. Mande JOGAR para treinar.',
    skipWord: 'Tudo bem. Quer definir uma palavra de segurança da família? Mande: PALAVRA jabuticaba. Ou PULAR.',
    skipDone: 'Combinado. Quando chegar algo estranho, encaminhe para mim. Mande JOGAR para treinar.',
    help: 'Como me usar:\n• Encaminhe qualquer mensagem, áudio ou print suspeito e eu avalio.\n• JOGAR: treino rápido de "golpe ou não".\n• PLACAR: pontos da família.\n• FAMILIA + número: define quem confirma por você.\n• PALAVRA + palavra: define a palavra de segurança.\n• PLANO: ver ou testar o Plano Família.\n• PAREI: não receber o treino diário.',
    stop: 'Combinado, não mando mais o treino diário. Continuo aqui quando você precisar. Mande VOLTAR para reativar.',
    resume: 'Treino diário reativado.',
    idle: 'Estou aqui. Encaminhe a mensagem que você recebeu, ou mande AJUDA.',
    clear: 'Não vi sinal de golpe nessa mensagem. Se depois pedirem dinheiro, código ou clique, me mande de novo.',
    pts: up => '+10 pontos por checar antes.' + up,
    head: { scam: 'PARECE GOLPE', suspicious: 'SUSPEITO' }, hold: 'Não pague e não responda ainda.', heard: 'Entendi assim',
    asked: (w, n) => (n > 1 ? `Já perguntei a ${n} pessoas da sua família se foi alguma delas.` : 'Já perguntei à sua pessoa de confiança se foi ela.') + ' Aguarde a resposta aqui antes de qualquer coisa.' + (w ? '\nEnquanto isso, peça a palavra de segurança a quem te escreveu. Não diga você.' : ''),
    noGuardian: 'Antes de qualquer coisa, ligue para essa pessoa no número que você já tinha salvo.\nQuer que eu confirme por você da próxima vez? Mande: FAMILIA + número de alguém de confiança.',
    genericAdvice: 'Não clique no link e não passe códigos. Se falar em banco, ligue para o número do verso do seu cartão.',
    alert: (amt, n, msg) => `ATENÇÃO. Alguém pediu ${amt || 'dinheiro'} para ${n || 'um familiar seu'} e pode estar usando o seu nome:\n\n"${msg}"\n\nFoi você?\n1 = Sim, fui eu\n2 = Não fui eu`,
    confirmedMe: n => `Obrigado. Avisei ${n || 'a pessoa'} que o pedido é seu mesmo.`,
    confirmedThem: n => `CONFIRMADO. ${n || 'Seu contato'} respondeu que o pedido é dele mesmo. Antes de enviar, confira se o nome na tela do pagamento é o de quem você conhece.`,
    blockedMe: (n, up) => `Feito. Avisei ${n || 'a pessoa'} para não pagar. Você acabou de barrar um golpe: +30 pontos.${up}\nAlguém está usando seu nome. Avise o resto da família.`,
    blockedThem: (n, amt, up) => `NÃO PAGUE. ${n || 'Seu contato'} respondeu que NÃO foi ele.\n\nÉ golpe. Bloqueie o número e denuncie no próprio WhatsApp.` + (amt ? `\nVocê protegeu ${amt}.` : '') + ' +50 pontos.' + up,
    gameIntro: 'Golpe ou não? Treino de hoje:', gameAsk: 'Responda 1 para GOLPE ou 2 para REAL.', morning: n => 'Bom dia' + (n ? ', ' + n : '') + '! ',
    right: up => 'Acertou! +20 pontos.' + up, wrongScam: 'Essa era golpe.', wrongReal: 'Essa era real.', wrongTail: ' Sem problema, é treinando que se aprende.', streak: d => `Sequência: ${d} dias.`,
    gameNext: 'Mande JOGAR para outra ou PLACAR para ver a família.',
    board: 'Placar da família', together: v => `Juntos vocês já protegeram ${v}.`, level: l => `Seu nível: ${l}.`, days: d => ` (${d} dias seguidos)`,
    levelUp: l => ` Você subiu para o nível ${l}.`,
    needGuardian: 'Esse passo é o coração do Vouch: sem alguém de confiança, eu não tenho a quem perguntar quando usarem o nome de um familiar. Mande o número de um filho, neta, irmão ou amigo próximo.',
    oneContact: 'No plano grátis você tem 1 contato de confiança, então troquei pelo novo. Para avisar a família toda de uma vez, mande PLANO.',
    upsell: 'Dica: no Plano Família o alerta vai para até 5 pessoas ao mesmo tempo e você recebe o treino todo dia. Mande PLANO.',
    plan: (on, end, n) => on ? `Você está no Plano Família${end ? ' (teste até ' + new Date(end).toLocaleDateString('pt-BR') + ')' : ''}.\n• Alerta para até 5 pessoas da família (hoje: ${n}).\n• Treino "golpe ou não" todo dia.\nPara incluir alguém: FAMILIA + número.` : 'Plano grátis: checar mensagens, jogar quando quiser e 1 contato de confiança.\n\nPlano Família, R$ 9,90 por mês para a família toda:\n• Alerta para até 5 pessoas quando alguém pedir dinheiro em nome de vocês.\n• Treino "golpe ou não" todo dia de manhã.\n\nMande ASSINAR para testar 7 dias grátis.',
    subscribed: 'Teste de 7 dias do Plano Família ativado. A cobrança por Pix Automático entra no piloto; por enquanto é grátis.\nInclua quem mais deve ser avisado: FAMILIA + número (até 5 pessoas).',
    alreadyAnswered: 'Obrigado! Outra pessoa da família já respondeu esse pedido.',
    circleAdded: n => `Pronto. Agora ${n} pessoas da família recebem o alerta.`,
    circleFull: 'Você já tem 5 pessoas na família. Para trocar alguém, fale com a gente.',
    error: 'Tive um problema agora. Na dúvida, não pague nada e ligue para a pessoa no número que você já tem.',
  },
  es: {
    flags: { money: ['Pide dinero', 'El mensaje pide una transferencia o un pago.'], urgency: ['Tiene prisa', 'Quiere que actúe ya. Una emergencia real aguanta 5 minutos de verificación.'], newnumber: ['Número nuevo', 'Alguien conocido aparece desde un número o cuenta que nunca vio.'], family: ['Usa a la familia', 'Usa un lazo familiar y una emergencia para que no piense.'], secrecy: ['Pide secreto', 'Pide que no le cuente a nadie. La estafa depende de que esté solo.'], authority: ['Habla en nombre de un banco u organismo', 'Los bancos y el gobierno no resuelven nada así por mensaje.'], credentials: ['Pide clave o código', 'Nadie de verdad necesita su contraseña ni el código que le llegó.'], prize: ['Demasiado bueno', 'Premios, reembolsos o dinero fácil son el anzuelo más común.'], link: ['Enlace raro', 'La dirección del enlace no es el sitio oficial.'], voice: ['Es un audio', 'Una voz conocida no es prueba. Se puede clonar con pocos segundos.'] },
    levels: ['Aprendiz', 'Vigía', 'Guardián', 'Centinela'],
    welcome: '¡Hola! Soy Vouch. Antes de pagar, hacer clic o pasar un código, reenvíeme el mensaje: le digo si parece estafa y, si usan el nombre de alguien de su familia, confirmo con esa persona de verdad.\n\n¿Cómo le llamo?',
    askGuardian: n => `Mucho gusto, ${n}. Ahora envíeme el número de WhatsApp de alguien de confianza (hijo, nieta, hermano). Si usan su nombre para pedirle dinero, le pregunto directamente.\nEj.: 55 1234 5678.`,
    badNumber: 'No entendí el número. Envíelo con lada o código de área, por ejemplo: 55 1234 5678',
    guardianSet: ask => 'Listo. Avisé a ese contacto.' + (ask ? '\nÚltimo paso: acuerden una palabra de seguridad que solo la familia sepa y envíemela así: PALABRA girasol. O envíe SALTAR.' : ''),
    invite: n => `${n || 'Alguien de su familia'} le eligió como persona de confianza en Vouch, el asistente antiestafas de la familia. Si usan su nombre para pedir dinero, le pregunto aquí y usted responde con un toque. Envíe HOLA para empezar.`,
    wordSet: 'Palabra guardada. Regla de oro: quien pide dinero es quien debe decir la palabra. Usted nunca la dice primero.\n\nTodo listo. Cuando llegue algo raro, reenvíemelo. Envíe JUGAR para entrenar.',
    skipWord: 'De acuerdo. ¿Quiere definir una palabra de seguridad familiar? Envíe: PALABRA girasol. O SALTAR.',
    skipDone: 'De acuerdo. Cuando llegue algo raro, reenvíemelo. Envíe JUGAR para entrenar.',
    help: 'Cómo usarme:\n• Reenvíe cualquier mensaje, audio o captura sospechosa y la reviso.\n• JUGAR: entrenamiento rápido de "¿estafa o no?".\n• MARCADOR: puntos de la familia.\n• FAMILIA + número: quién confirma por usted.\n• PALABRA + palabra: palabra de seguridad.\n• PLAN: ver o probar el Plan Familia.\n• PARAR: no recibir el entrenamiento diario.',
    stop: 'De acuerdo, ya no envío el entrenamiento diario. Sigo aquí cuando me necesite. Envíe VOLVER para reactivarlo.',
    resume: 'Entrenamiento diario reactivado.',
    idle: 'Aquí estoy. Reenvíe el mensaje que recibió, o envíe AYUDA.',
    clear: 'No vi señales de estafa en este mensaje. Si después le piden dinero, códigos o un clic, envíemelo de nuevo.',
    pts: up => '+10 puntos por revisar antes.' + up,
    head: { scam: 'PARECE ESTAFA', suspicious: 'SOSPECHOSO' }, hold: 'No pague ni responda todavía.', heard: 'Entendí esto',
    asked: (w, n) => (n > 1 ? `Ya les pregunté a ${n} personas de su familia si fue alguna de ellas.` : 'Ya le pregunté a su persona de confianza si fue ella.') + ' Espere la respuesta aquí antes de hacer nada.' + (w ? '\nMientras tanto, pídale la palabra de seguridad a quien le escribió. No la diga usted.' : ''),
    noGuardian: 'Antes que nada, llame a esa persona al número que ya tenía guardado.\n¿Quiere que confirme por usted la próxima vez? Envíe: FAMILIA + número de alguien de confianza.',
    genericAdvice: 'No haga clic en el enlace ni comparta códigos. Si menciona a su banco, llame al número que aparece en su tarjeta.',
    alert: (amt, n, msg) => `ATENCIÓN. Alguien le pidió ${amt || 'dinero'} a ${n || 'un familiar suyo'} y podría estar usando su nombre:\n\n"${msg}"\n\n¿Fue usted?\n1 = Sí, fui yo\n2 = No fui yo`,
    confirmedMe: n => `Gracias. Le avisé a ${n || 'la persona'} que el pedido sí es suyo.`,
    confirmedThem: n => `CONFIRMADO. ${n || 'Su contacto'} respondió que el pedido sí es suyo. Antes de enviar, revise que el nombre en la pantalla del pago sea el de la persona que conoce.`,
    blockedMe: (n, up) => `Listo. Le avisé a ${n || 'la persona'} que no pague. Acaba de frenar una estafa: +30 puntos.${up}\nAlguien está usando su nombre. Avise al resto de la familia.`,
    blockedThem: (n, amt, up) => `NO PAGUE. ${n || 'Su contacto'} respondió que NO fue.\n\nEs una estafa. Bloquee el número y denúncielo en WhatsApp.` + (amt ? `\nProtegió ${amt}.` : '') + ' +50 puntos.' + up,
    gameIntro: '¿Estafa o no? Entrenamiento de hoy:', gameAsk: 'Responda 1 para ESTAFA o 2 para REAL.', morning: n => '¡Buenos días' + (n ? ', ' + n : '') + '! ',
    right: up => '¡Correcto! +20 puntos.' + up, wrongScam: 'Esa era estafa.', wrongReal: 'Esa era real.', wrongTail: ' No pasa nada, así se aprende.', streak: d => `Racha: ${d} días.`,
    gameNext: 'Envíe JUGAR para otra o MARCADOR para ver a la familia.',
    board: 'Marcador de la familia', together: v => `Juntos ya protegieron ${v}.`, level: l => `Su nivel: ${l}.`, days: d => ` (${d} días seguidos)`,
    levelUp: l => ` Subió al nivel ${l}.`,
    needGuardian: 'Este paso es el corazón de Vouch: sin alguien de confianza, no tengo a quién preguntar cuando usen el nombre de un familiar. Envíe el número de un hijo, nieta, hermano o amigo cercano.',
    oneContact: 'En el plan gratis tiene 1 contacto de confianza, así que lo cambié por el nuevo. Para avisar a toda la familia, envíe PLAN.',
    upsell: 'Tip: con el Plan Familia la alerta llega a hasta 5 personas a la vez y recibe el entrenamiento cada día. Envíe PLAN.',
    plan: (on, end, n) => on ? `Tiene el Plan Familia${end ? ' (prueba hasta ' + new Date(end).toLocaleDateString('es-MX') + ')' : ''}.\n• Alerta para hasta 5 personas de la familia (hoy: ${n}).\n• Entrenamiento "¿estafa o no?" cada día.\nPara agregar a alguien: FAMILIA + número.` : 'Plan gratis: revisar mensajes, jugar cuando quiera y 1 contacto de confianza.\n\nPlan Familia, para toda la familia:\n• Alerta para hasta 5 personas cuando alguien pida dinero en su nombre.\n• Entrenamiento "¿estafa o no?" cada mañana.\n\nEnvíe SUSCRIBIR para probar 7 días gratis.',
    subscribed: 'Prueba de 7 días del Plan Familia activada. El cobro llega con el piloto; por ahora es gratis.\nAgregue a quien deba recibir alertas: FAMILIA + número (hasta 5 personas).',
    alreadyAnswered: '¡Gracias! Otra persona de la familia ya respondió este pedido.',
    circleAdded: n => `Listo. Ahora ${n} personas de la familia reciben la alerta.`,
    circleFull: 'Ya tiene 5 personas en la familia. Para cambiar a alguien, escríbanos.',
    error: 'Tuve un problema. Ante la duda, no pague nada y llame a la persona al número que ya tiene.',
  },
  en: {
    flags: { money: ['Asks for money', 'The message asks for a transfer or payment.'], urgency: ['Creates urgency', 'It wants you to act now. A real emergency can wait 5 minutes for a check.'], newnumber: ['New number', 'Someone you know is suddenly writing from a number or account you have never seen.'], family: ['Uses family', 'It uses a family bond and an emergency so you do not stop to think.'], secrecy: ['Asks for secrecy', 'It asks you not to tell anyone. Scams depend on you being alone.'], authority: ['Claims to be a bank or authority', 'Banks and government agencies do not settle things like this by message.'], credentials: ['Asks for a code or PIN', 'Nobody genuine needs your password, PIN or the code you just received.'], prize: ['Too good to be true', 'Prizes, refunds and easy money are the most common bait.'], link: ['Odd link', 'The link does not go to the official website.'], voice: ['Voice note', 'A familiar voice is not proof. It can be cloned from a few seconds of audio.'] },
    levels: ['Rookie', 'Watcher', 'Guardian', 'Sentinel'],
    welcome: "Hi! I'm Vouch. Before you pay, click or share a code, forward the message to me: I'll tell you if it looks like a scam and, if someone uses a relative's name, I'll check with that person directly.\n\nWhat should I call you?",
    askGuardian: n => `Nice to meet you, ${n}. Now send me the WhatsApp number of someone you trust (a son, granddaughter, brother). If someone uses their name to ask you for money, I'll ask them directly.\nFor example: 98765 43210.`,
    badNumber: "I couldn't read that number. Please send it with the area code, for example: 98765 43210",
    guardianSet: ask => 'Done. I let that contact know.' + (ask ? '\nLast step: agree on a family safe word only you know and send it like this: WORD sunflower. Or send SKIP.' : ''),
    invite: n => `${n || 'Someone in your family'} chose you as their trusted contact on Vouch, the family anti-scam assistant. If someone uses your name to ask them for money, I'll ask you here and you answer with one tap. Send HI to start.`,
    wordSet: "Safe word saved. Golden rule: whoever asks for money has to say the word. You never say it first.\n\nAll set. When something odd arrives, forward it to me. Send PLAY to practise.",
    skipWord: 'OK. Want to set a family safe word? Send: WORD sunflower. Or SKIP.',
    skipDone: 'OK. When something odd arrives, forward it to me. Send PLAY to practise.',
    help: 'How to use me:\n• Forward any suspicious message, voice note or screenshot and I will check it.\n• PLAY: quick "scam or not?" practice.\n• SCORE: family points.\n• FAMILY + number: who confirms for you.\n• WORD + word: family safe word.\n• PLAN: see or try the Family plan.\n• STOP: no daily practice.',
    stop: "OK, no more daily practice. I'm still here when you need me. Send RESUME to turn it back on.",
    resume: 'Daily practice is back on.',
    idle: "I'm here. Forward the message you received, or send HELP.",
    clear: "I didn't see any scam signs in this message. If they later ask for money, a code or a click, send it to me again.",
    pts: up => '+10 points for checking first.' + up,
    head: { scam: 'LOOKS LIKE A SCAM', suspicious: 'SUSPICIOUS' }, hold: "Don't pay or reply yet.", heard: 'Here is what I heard',
    asked: (w, n) => (n > 1 ? `I've asked ${n} people in your family whether it was one of them.` : "I've already asked your trusted contact whether it was them.") + " Wait for the answer here before doing anything." + (w ? '\nMeanwhile, ask the sender for your family safe word. Do not say it yourself.' : ''),
    noGuardian: 'Before anything else, call that person on the number you already had saved.\nWant me to confirm for you next time? Send: FAMILY + the number of someone you trust.',
    genericAdvice: "Don't click the link and don't share codes. If it mentions your bank, call the number printed on your card.",
    alert: (amt, n, msg) => `HEADS UP. Someone asked ${n || 'a family member'} for ${amt || 'money'} and may be using your name:\n\n"${msg}"\n\nWas it you?\n1 = Yes, it was me\n2 = No, it wasn't me`,
    confirmedMe: n => `Thanks. I told ${n || 'them'} the request really is yours.`,
    confirmedThem: n => `CONFIRMED. ${n || 'Your contact'} says the request really is theirs. Before sending, check that the name on the payment screen is the person you know.`,
    blockedMe: (n, up) => `Done. I told ${n || 'them'} not to pay. You just stopped a scam: +30 points.${up}\nSomeone is using your name. Warn the rest of the family.`,
    blockedThem: (n, amt, up) => `DON'T PAY. ${n || 'Your contact'} says it was NOT them.\n\nIt's a scam. Block the number and report it in WhatsApp.` + (amt ? `\nYou protected ${amt}.` : '') + ' +50 points.' + up,
    gameIntro: "Scam or not? Today's practice:", gameAsk: 'Reply 1 for SCAM or 2 for REAL.', morning: n => 'Good morning' + (n ? ', ' + n : '') + '! ',
    right: up => 'Correct! +20 points.' + up, wrongScam: 'That one was a scam.', wrongReal: 'That one was real.', wrongTail: " No problem, that's how you learn.", streak: d => `Streak: ${d} days.`,
    gameNext: 'Send PLAY for another or SCORE to see the family.',
    board: 'Family scoreboard', together: v => `Together you've protected ${v}.`, level: l => `Your level: ${l}.`, days: d => ` (${d}-day streak)`,
    levelUp: l => ` You reached level ${l}.`,
    needGuardian: "This step is the heart of Vouch: without someone you trust, I have no one to ask when a relative's name is used. Send the number of a son, granddaughter, brother or close friend.",
    oneContact: 'The free plan has 1 trusted contact, so I replaced it with the new one. To alert the whole family at once, send PLAN.',
    upsell: 'Tip: with the Family plan the alert reaches up to 5 people at once and you get practice every day. Send PLAN.',
    plan: (on, end, n) => on ? `You're on the Family plan${end ? ' (trial until ' + new Date(end).toLocaleDateString('en-GB') + ')' : ''}.\n• Alerts for up to 5 family members (now: ${n}).\n• Daily "scam or not?" practice.\nTo add someone: FAMILY + number.` : 'Free plan: check messages, play anytime and 1 trusted contact.\n\nFamily plan, for the whole family:\n• Alerts to up to 5 people when someone asks for money in your name.\n• "Scam or not?" practice every morning.\n\nSend SUBSCRIBE to try it free for 7 days.',
    subscribed: 'Your 7-day Family plan trial is on. Billing starts with the pilot; for now it is free.\nAdd who else should be alerted: FAMILY + number (up to 5 people).',
    alreadyAnswered: 'Thanks! Someone else in the family already answered this request.',
    circleAdded: n => `Done. ${n} family members now get the alert.`,
    circleFull: 'You already have 5 people in the family. To swap someone, contact us.',
    error: "Something went wrong on my side. When in doubt, don't pay anything and call the person on the number you already have.",
  },
};

const CHALLENGES = {
  pt: [
    { m: 'Oi vó, troquei de celular, salva esse número. Consegue pagar um boleto pra mim hoje? Depois te explico.', scam: true, why: 'Número novo + pedido de dinheiro + pressa. Ligue para o número antigo antes de qualquer coisa.' },
    { m: 'Mãe, cheguei bem. O ônibus atrasou meia hora, mas deu tudo certo. Te ligo à noite.', scam: false, why: 'Não pede dinheiro, código nem clique. Desconfiar de tudo também cansa.' },
    { m: 'BANCO: compra de R$ 3.899,00 aprovada no seu cartão. Não reconhece? Ligue agora 0800 591 2030.', scam: true, why: 'O banco não manda telefone por mensagem. O número certo está no verso do seu cartão.' },
    { m: 'Sua encomenda está retida. Pague a taxa de R$ 12,90 para liberar: correios-entrega-br.com/taxa', scam: true, why: 'Site que imita os Correios. O oficial termina em correios.com.br.' },
    { m: 'Oi! Aqui é a Dra. Paula, da clínica. Sua consulta de quinta foi confirmada para 14h. Qualquer coisa, é só responder.', scam: false, why: 'Confirma algo que você marcou e não pede nada.' },
    { m: 'Parabéns! Seu CPF foi sorteado e você tem R$ 4.720 a receber. Pague a taxa de liberação de R$ 59 e receba hoje.', scam: true, why: 'Quem tem dinheiro a receber não paga taxa antes.' },
    { m: 'Aqui é do suporte do WhatsApp. Sua conta será desativada. Informe o código de 6 dígitos que enviamos por SMS.', scam: true, why: 'Esse código é a chave da sua conta. Quem pede quer clonar seu WhatsApp.' },
    { m: 'Pai, o Pix da pizza de ontem deu R$ 40 pra cada um. Quando puder me manda, sem pressa. É a mesma chave de sempre.', scam: false, why: 'Sem pressa, mesma chave de sempre, contato conhecido.' },
    { m: '[áudio] Mãe, sou eu, bati o carro e preciso de R$ 2.000 agora pro guincho. Não fala pro pai, por favor.', scam: true, why: 'Urgência, dinheiro e segredo juntos. A voz pode ser clonada.' },
    { m: 'Trabalhe de casa curtindo vídeos e ganhe R$ 300 por dia. Vagas limitadas, chame no link bit.ly/vaga-hoje', scam: true, why: 'Renda fácil + vaga limitada + link encurtado.' },
    { m: 'Oi, aqui é o Carlos do 302. A reunião de condomínio mudou para terça às 19h no salão.', scam: false, why: 'Aviso sem pedido de dinheiro, código ou clique.' },
    { m: 'INSS: prova de vida pendente. Seu benefício será bloqueado em 24h. Regularize em inss-provadevida.site', scam: true, why: 'Ameaça com prazo e site falso. Órgão público usa endereço gov.br.' },
  ],
  es: [
    { m: 'Hola abuela, cambié de número, guarda este. ¿Me puedes hacer una transferencia hoy? Luego te explico.', scam: true, why: 'Número nuevo + pedido de dinero + prisa. Llame al número de siempre antes de nada.' },
    { m: 'Mamá, ya llegué. El camión se retrasó media hora pero todo bien. Te llamo en la noche.', scam: false, why: 'No pide dinero, códigos ni clics. Desconfiar de todo también cansa.' },
    { m: 'BANCO: se aprobó una compra de $8,450.00 con su tarjeta. ¿No la reconoce? Llame ya al 800 123 4567.', scam: true, why: 'Su banco no le envía teléfonos por mensaje. El número correcto está en su tarjeta.' },
    { m: 'Su paquete está retenido. Pague $39 para liberarlo: paqueteria-envios-mx.com/pago', scam: true, why: 'Sitio que imita a una paquetería. Revise el pedido en la app oficial.' },
    { m: 'Hola, le escribe la clínica. Su cita del jueves quedó confirmada a las 2 pm. Cualquier cosa, responda este mensaje.', scam: false, why: 'Confirma algo que usted agendó y no pide nada.' },
    { m: 'Soporte de WhatsApp: su cuenta será desactivada. Envíe el código de 6 dígitos que le llegó por SMS.', scam: true, why: 'Ese código es la llave de su cuenta. Quien lo pide quiere robar su WhatsApp.' },
    { m: '[audio] Mamá, soy yo, choqué el carro y necesito dinero ahora para la grúa. No le digas a papá.', scam: true, why: 'Urgencia, dinero y secreto juntos. La voz puede estar clonada.' },
    { m: 'Papá, lo de la pizza de ayer salió a 150 por persona. Cuando puedas me pasas, sin prisa. Es la misma cuenta de siempre.', scam: false, why: 'Sin prisa, cuenta de siempre, contacto conocido.' },
  ],
  en: [
    { m: "Hi Grandma, I changed my number, save this one. Can you send me some money today? I'll explain later.", scam: true, why: 'New number + money request + urgency. Call the old number before anything else.' },
    { m: "Mom, I got home fine. The bus was half an hour late but all good. I'll call you tonight.", scam: false, why: 'No money, code or link involved. Distrusting everything is exhausting too.' },
    { m: 'This is the police cyber cell. Your ID is linked to a money laundering case. Stay on this video call and transfer your savings for verification.', scam: true, why: 'No police force arrests or verifies anyone over a video call. Hang up and call the official helpline.' },
    { m: 'Your KYC is pending and your bank account will be blocked today. Update now: bank-kyc-update.info', scam: true, why: 'Threat with a deadline and a fake site. Use only your bank’s official app.' },
    { m: 'Hello, this is the clinic. Your appointment on Thursday at 2 pm is confirmed. Reply here if you need anything.', scam: false, why: 'Confirms something you booked and asks for nothing.' },
    { m: 'WhatsApp Support: your account will be deactivated. Send us the 6-digit code we just texted you.', scam: true, why: 'That code is the key to your account. Whoever asks wants to take over your WhatsApp.' },
    { m: "[voice note] Mom, it's me, I crashed the car and need money right now for the tow truck. Don't tell Dad.", scam: true, why: 'Urgency, money and secrecy together. The voice may be cloned.' },
    { m: "Dad, dinner yesterday came to 500 each. Send it whenever, no rush. Same account as always.", scam: false, why: 'No rush, usual account, known contact.' },
  ],
};

module.exports = { T, CHALLENGES, AFTER, countryOf, guessLang, money };
