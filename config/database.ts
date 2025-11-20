import path from 'path';
const parse = require('pg-connection-string').parse;

export default ({ env }) => {
  // Comprobamos si existe la variable DATABASE_URL (Koyeb)
  const databaseUrl = env('DATABASE_URL');

  if (databaseUrl) {
    const config = parse(databaseUrl);
    return {
      connection: {
        client: 'postgres',
        connection: {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: {
            rejectUnauthorized: false // Obligatorio para Koyeb
          },
        },
        debug: false,
      },
    };
  }

  // Configuración por defecto para local (SQLite)
  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: path.join(__dirname, '..', '..', '.tmp/data.db'),
      },
      useNullAsDefault: true,
    },
  };
};