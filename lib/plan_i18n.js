// Family plan, family circle and mandatory trusted contact. Patches the base strings in i18n.js.
const base = require('./i18n');
const P = {
  pt: {
    trappedTotal: n => `🎯 Golpistas desarmados pela família: ${n}.`,
    needGuardian: 'Esse passo é o coração do Vouch: sem alguém de confiança, eu não tenho a quem perguntar quando usarem o nome de um familiar. Mande o número de um filho, neta, irmão ou amigo próximo.',
    oneContact: 'No plano grátis você tem 1 contato de confiança, então troquei pelo novo. Para avisar a família toda de uma vez, mande PLANO.',
    upsell: 'Dica: no Plano Família o alerta vai para até 5 pessoas ao mesmo tempo e você recebe o treino todo dia. Mande PLANO.',
    plan: (on, end, n) => on ? `Você está no Plano Família${end ? ' (teste até ' + new Date(end).toLocaleDateString('pt-BR') + ')' : ''}.\n• Alerta para até 5 pessoas da família (hoje: ${n}).\n• Treino "golpe ou não" todo dia.\nPara incluir alguém: FAMILIA + número.` : 'Plano grátis: checar mensagens, jogar quando quiser e 1 contato de confiança.\n\nPlano Família, R$ 9,90 por mês para a família toda:\n• Alerta para até 5 pessoas quando alguém pedir dinheiro em nome de vocês.\n• Treino "golpe ou não" todo dia de manhã.\n\nMande ASSINAR para testar 7 dias grátis.',
    subscribed: 'Teste de 7 dias do Plano Família ativado. A cobrança por Pix Automático entra no piloto; por enquanto é grátis.\nInclua quem mais deve ser avisado: FAMILIA + número (até 5 pessoas).',
    alreadyAnswered: 'Obrigado! Outra pessoa da família já respondeu esse pedido.',
    circleAdded: n => `Pronto. Agora ${n} pessoas da família recebem o alerta.`,
    circleFull: 'Você já tem 5 pessoas na família. Para trocar alguém, fale com a gente.',
    asked: (w, n) => (n > 1 ? `Já perguntei a ${n} pessoas da sua família se foi alguma delas.` : 'Já perguntei à sua pessoa de confiança se foi ela.') + ' Aguarde a resposta aqui antes de qualquer coisa.' + (w ? '\nEnquanto isso, peça a palavra de segurança a quem te escreveu. Não diga você.' : ''),
    help: 'Como me usar:\n• Encaminhe qualquer mensagem, áudio ou print suspeito e eu avalio.\n• JOGAR: treino rápido de "golpe ou não".\n• PLACAR: pontos da família.\n• FAMILIA + número: define quem confirma por você.\n• PALAVRA + palavra: define a palavra de segurança.\n• PLANO: ver ou testar o Plano Família.\n• PAREI: não receber o treino diário.',
    askGuardian: n => `Prazer, ${n}. Agora me diga o número de WhatsApp de alguém de confiança (filho, neta, irmão). Quando usarem o nome dessa pessoa para te pedir dinheiro, eu pergunto direto a ela.\nEx.: 61 99999-0000.`,
  },
  es: {
    trappedTotal: n => `🎯 Estafadores desarmados por la familia: ${n}.`,
    needGuardian: 'Este paso es el corazón de Vouch: sin alguien de confianza, no tengo a quién preguntar cuando usen el nombre de un familiar. Envíe el número de un hijo, nieta, hermano o amigo cercano.',
    oneContact: 'En el plan gratis tiene 1 contacto de confianza, así que lo cambié por el nuevo. Para avisar a toda la familia, envíe PLAN.',
    upsell: 'Tip: con el Plan Familia la alerta llega a hasta 5 personas a la vez y recibe el entrenamiento cada día. Envíe PLAN.',
    plan: (on, end, n) => on ? `Tiene el Plan Familia${end ? ' (prueba hasta ' + new Date(end).toLocaleDateString('es-MX') + ')' : ''}.\n• Alerta para hasta 5 personas de la familia (hoy: ${n}).\n• Entrenamiento "¿estafa o no?" cada día.\nPara agregar a alguien: FAMILIA + número.` : 'Plan gratis: revisar mensajes, jugar cuando quiera y 1 contacto de confianza.\n\nPlan Familia, para toda la familia:\n• Alerta para hasta 5 personas cuando alguien pida dinero en su nombre.\n• Entrenamiento "¿estafa o no?" cada mañana.\n\nEnvíe SUSCRIBIR para probar 7 días gratis.',
    subscribed: 'Prueba de 7 días del Plan Familia activada. El cobro llega con el piloto; por ahora es gratis.\nAgregue a quien deba recibir alertas: FAMILIA + número (hasta 5 personas).',
    alreadyAnswered: '¡Gracias! Otra persona de la familia ya respondió este pedido.',
    circleAdded: n => `Listo. Ahora ${n} personas de la familia reciben la alerta.`,
    circleFull: 'Ya tiene 5 personas en la familia. Para cambiar a alguien, escríbanos.',
    asked: (w, n) => (n > 1 ? `Ya les pregunté a ${n} personas de su familia si fue alguna de ellas.` : 'Ya le pregunté a su persona de confianza si fue ella.') + ' Espere la respuesta aquí antes de hacer nada.' + (w ? '\nMientras tanto, pídale la palabra de seguridad a quien le escribió. No la diga usted.' : ''),
    help: 'Cómo usarme:\n• Reenvíe cualquier mensaje, audio o captura sospechosa y la reviso.\n• JUGAR: entrenamiento rápido de "¿estafa o no?".\n• MARCADOR: puntos de la familia.\n• FAMILIA + número: quién confirma por usted.\n• PALABRA + palabra: palabra de seguridad.\n• PLAN: ver o probar el Plan Familia.\n• PARAR: no recibir el entrenamiento diario.',
    askGuardian: n => `Mucho gusto, ${n}. Ahora envíeme el número de WhatsApp de alguien de confianza (hijo, nieta, hermano). Si usan su nombre para pedirle dinero, le pregunto directamente.\nEj.: 55 1234 5678.`,
  },
  en: {
    trappedTotal: n => `🎯 Scammers disarmed by the family: ${n}.`,
    needGuardian: "This step is the heart of Vouch: without someone you trust, I have no one to ask when a relative's name is used. Send the number of a son, granddaughter, brother or close friend.",
    oneContact: 'The free plan has 1 trusted contact, so I replaced it with the new one. To alert the whole family at once, send PLAN.',
    upsell: 'Tip: with the Family plan the alert reaches up to 5 people at once and you get practice every day. Send PLAN.',
    plan: (on, end, n) => on ? `You're on the Family plan${end ? ' (trial until ' + new Date(end).toLocaleDateString('en-GB') + ')' : ''}.\n• Alerts for up to 5 family members (now: ${n}).\n• Daily "scam or not?" practice.\nTo add someone: FAMILY + number.` : 'Free plan: check messages, play anytime and 1 trusted contact.\n\nFamily plan, for the whole family:\n• Alerts to up to 5 people when someone asks for money in your name.\n• "Scam or not?" practice every morning.\n\nSend SUBSCRIBE to try it free for 7 days.',
    subscribed: 'Your 7-day Family plan trial is on. Billing starts with the pilot; for now it is free.\nAdd who else should be alerted: FAMILY + number (up to 5 people).',
    alreadyAnswered: 'Thanks! Someone else in the family already answered this request.',
    circleAdded: n => `Done. ${n} family members now get the alert.`,
    circleFull: 'You already have 5 people in the family. To swap someone, contact us.',
    asked: (w, n) => (n > 1 ? `I've asked ${n} people in your family whether it was one of them.` : "I've already asked your trusted contact whether it was them.") + " Wait for the answer here before doing anything." + (w ? '\nMeanwhile, ask the sender for your family safe word. Do not say it yourself.' : ''),
    help: 'How to use me:\n• Forward any suspicious message, voice note or screenshot and I will check it.\n• PLAY: quick "scam or not?" practice.\n• SCORE: family points.\n• FAMILY + number: who confirms for you.\n• WORD + word: family safe word.\n• PLAN: see or try the Family plan.\n• STOP: no daily practice.',
    askGuardian: n => `Nice to meet you, ${n}. Now send me the WhatsApp number of someone you trust (a son, granddaughter, brother). If someone uses their name to ask you for money, I'll ask them directly.\nFor example: 98765 43210.`,
  },
};
for (const l of Object.keys(P)) Object.assign(base.T[l], P[l]);
module.exports = base;
