export default (plugin) => {
  // Guardamos la función original
  const originalRegister = plugin.controllers.auth.register;

  // Sobrescribimos el registro
  plugin.controllers.auth.register = async (ctx) => {
    // 1. CAPTURAR: Sacamos los datos extra antes de que se pierdan
    const { nombre, apellidos } = ctx.request.body;

    // 2. LIMPIAR: Dejamos en el body SOLO lo que Strapi acepta nativamente
    // Así evitamos el error "Invalid parameters"
    ctx.request.body = {
      username: ctx.request.body.username,
      email: ctx.request.body.email,
      password: ctx.request.body.password
    };

    // 3. CREAR: Llamamos a la función original con los datos limpios
    try {
      await originalRegister(ctx);
    } catch (err) {
      throw err; // Si falla aquí (ej: usuario ya existe), lanzamos el error normal
    }

    // 4. ACTUALIZAR: Si hemos llegado aquí, el usuario existe. Le ponemos el nombre.
    if (ctx.response.status === 200 && ctx.response.body.user) {
      const userId = ctx.response.body.user.id;

      await strapi.entityService.update('plugin::users-permissions.user', userId, {
        data: {
          nombre: nombre,
          apellidos: apellidos,
          es_professor: false // Forzamos false por seguridad
        }
      });

      // Devolvemos el usuario completo al frontend
      const updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', userId);
      ctx.response.body.user = updatedUser;
    }
  };

  return plugin;
};