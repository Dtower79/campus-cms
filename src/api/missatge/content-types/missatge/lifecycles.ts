import axios from 'axios';

export default {
  async afterCreate(event) {
    // 1. Cogemos los datos del mensaje que acaba de llegar
    const { result } = event;

    // 2. Leemos las claves del archivo .env
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Si no están configuradas, paramos para no dar error
    if (!token || !chatId) return;

    try {
      // 3. Calculamos la hora actual de España
      const fechaHora = new Date().toLocaleString('es-ES', { 
        timeZone: 'Europe/Madrid',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      // 4. Diseñamos el mensaje bonito para Telegram
      const textoTelegram = `
🔔 *NOU DUBTE AL CAMPUS*
📅 ${fechaHora}

👤 *Alumne:* ${result.alumne_nom || 'Sense nom'}
📘 *Curs:* ${result.curs || 'General'}
🏷 *Tema:* ${result.tema || 'Sense tema'}

💬 *Missatge:*
${result.missatge}
      `;

      // 5. ¡Enviamos el mensaje!
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: textoTelegram,
        parse_mode: 'Markdown'
      });

      console.log('✅ Aviso enviado a Telegram correctamente.');

    } catch (error) {
      console.log('❌ Error enviando a Telegram:', error);
    }
  },
};