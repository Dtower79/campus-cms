// src/extensions/users-permissions/strapi-server.ts

export default (plugin) => {
  plugin.controllers.auth.callback = async (ctx) => {
    // Lógica original de auth callback
    return plugin.controllers.auth.callback(ctx);
  };

  // Sobrescribimos el método register para permitir campos extra
  const originalRegister = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    // Permitimos que pasen estos campos en el body
    const { nombre, apellidos, es_professor } = ctx.request.body;
    
    // Llamamos al registro original
    await originalRegister(ctx);

    // Si el registro ha ido bien (tenemos usuario en la respuesta)
    if (ctx.response.status === 200 && ctx.response.body.user) {
      const userId = ctx.response.body.user.id;
      
      // Actualizamos el usuario recién creado con los campos extra
      await strapi.entityService.update('plugin::users-permissions.user', userId, {
        data: {
          nombre,
          apellidos,
          es_professor: false // Forzamos false por seguridad, aunque venga true
        }
      });
      
      // Refrescamos el objeto usuario en la respuesta
      const updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', userId);
      ctx.response.body.user = updatedUser;
    }
  };

  return plugin;
};