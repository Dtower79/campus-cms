module.exports = {
  async afterCreate(event) {
    const { result } = event;

    // --- PEGA AQUÍ TUS DATOS ---
    const BOT_TOKEN = 8387797885:AAGU2aU_-rjXDqn7cqecPmn0qE7ke2dbJWI; 
    const CHAT_ID = 818012851; 
    // ---------------------------

    try {
      // Formateamos el mensaje para que se vea bonito
      const texto = `
📢 *NOU DUBTE AL CAMPUS*
-------------------------
👤 *Alumne:* ${result.alumne_nom || 'Anònim'}
📘 *Curs:* ${result.curs || 'General'}
🏷️ *Tema:* ${result.tema || 'Sense tema'}
📝 *Missatge:*
"${result.missatge}"
-------------------------
_Entra al Campus per respondre._
      `;

      // Enviamos a Telegram
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: texto,
          parse_mode: 'Markdown'
        })
      });
      
      console.log('✅ Notificación enviada a Telegram correctamente.');

    } catch (err) {
      console.error('❌ Error enviando a Telegram:', err);
    }
  }
};