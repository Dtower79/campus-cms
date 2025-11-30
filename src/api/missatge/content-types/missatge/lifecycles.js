module.exports = {
  async afterCreate(event) {
    // 1. CHIVATO: Si esto no sale en el log, es que Strapi no lee el archivo
    console.log('🚀 INTENTANDO ENVIAR A TELEGRAM...'); 

    const { result } = event;

    // --- CORRECCIÓN AQUÍ: COMILLAS OBLIGATORIAS ---
    const BOT_TOKEN = '8387797885:AAGU2aU_-rjXDqn7cqecPmn0qE7ke2dbJWI'; 
    const CHAT_ID = '818012851'; 
    // ----------------------------------------------

    try {
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
      const respuesta = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: texto,
          parse_mode: 'Markdown'
        })
      });
      
      // Verificamos si Telegram nos ha dicho que sí o que no
      if (respuesta.ok) {
          console.log('✅ TELEGRAM: Notificación enviada correctamente.');
      } else {
          const errorData = await respuesta.text();
          console.error('❌ TELEGRAM ERROR:', errorData);
      }

    } catch (err) {
      console.error('❌ ERROR CRÍTICO AL CONECTAR CON TELEGRAM:', err);
    }
  }
};