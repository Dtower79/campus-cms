export default {
  async afterCreate(event) {
    const { result } = event;

    // --- 1. PROTECCIÓN CONTRA DUPLICADOS ---
    // Si la bandera ya está en true, significa que ya enviamos el mensaje.
    // Paramos aquí para no enviarlo otra vez.
    if (result.telegram_enviado === true) {
        return;
    }

    // TUS DATOS
    const BOT_TOKEN = '8387797885:AAGU2aU_-rjXDqn7cqecPmn0qE7ke2dbJWI'; 
    const CHAT_ID = '818012851'; 

    try {
      console.log('🚀 INTENTANDO ENVIAR A TELEGRAM...'); 

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
      
      if (respuesta.ok) {
          console.log('✅ TELEGRAM: Notificación enviada correctamente.');
          
          // --- 2. MARCAR COMO ENVIADO EN LA BASE DE DATOS ---
          // Usamos strapi.db.query para actualizar "en silencio" y evitar bucles infinitos
          await strapi.db.query('api::missatge.missatge').update({
            where: { id: result.id },
            data: { telegram_enviado: true }
          });

      } else {
          const errorData = await respuesta.text();
          console.error('❌ TELEGRAM ERROR:', errorData);
      }

    } catch (err) {
      console.error('❌ ERROR CRÍTICO AL CONECTAR CON TELEGRAM:', err);
    }
  }
};