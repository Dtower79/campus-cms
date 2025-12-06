import axios from 'axios';

export default {
  async afterCreate(event) {
    const { result } = event;

    // --- CONDICIÓN DE SEGURIDAD ---
    // Si el mensaje no está "pendent" (ej: está "respost" o se está editando), NO enviamos nada.
    // Esto evita que salte el aviso cuando el profesor responde.
    if (result.estat && result.estat !== 'pendent') {
      return;
    }
    // ------------------------------

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

      console.log('✅ Aviso enviado a Telegram correctamente.');

    } catch (error) {
      console.log('❌ Error enviando a Telegram:', error);
    }
  },
  
  // Aseguramos que NO haya lógica en afterUpdate
  async afterUpdate(event) {
    // Dejamos esto vacío para asegurar que no se envía nada al editar/responder
    return;
  }
};