import axios from 'axios';

export default {
  // HOOK DE CREACIÓN (Solo aquí enviamos Telegram)
  async afterCreate(event) {
    const { result } = event;

    // --- CANDADO 1: ESTADO ---
    // Si el mensaje NO está en estado 'pendent' (ej: 'respost'), abortamos inmediatamente.
    if (result.estat && result.estat !== 'pendent') {
      console.log(`⛔ Telegram bloqueado: El mensaje ${result.id} no está pendiente.`);
      return;
    }

    // --- CANDADO 2: RESPUESTA ---
    // Si el mensaje ya tiene texto de respuesta, abortamos.
    if (result.resposta_professor && result.resposta_professor.length > 0) {
      console.log(`⛔ Telegram bloqueado: El mensaje ${result.id} ya tiene respuesta.`);
      return;
    }

    // Si pasa los candados, procedemos al envío
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) return;

    try {
      const fechaHora = new Date().toLocaleString('es-ES', { 
        timeZone: 'Europe/Madrid',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const textoTelegram = `
🔔 *NOU DUBTE AL CAMPUS*
📅 ${fechaHora}

👤 *Alumne:* ${result.alumne_nom || 'Sense nom'}
📘 *Curs:* ${result.curs || 'General'}
🏷 *Tema:* ${result.tema || 'Sense tema'}

💬 *Missatge:*
${result.missatge}
      `;

      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: textoTelegram,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.log('❌ Error enviando a Telegram:', error);
    }
  },

  // HOOK DE ACTUALIZACIÓN (Cuando respondes)
  // Lo definimos explícitamente VACÍO para asegurar que Strapi no haga nada aquí.
  async afterUpdate(event) {
    // SILENCIO ABSOLUTO AL EDITAR/RESPONDER
    return;
  }
};