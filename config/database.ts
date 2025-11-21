import path from 'path';
const parse = require('pg-connection-string').parse;

export default ({ env }) => {
  const databaseUrl = env('DATABASE_URL');

  console.log("----------------------------------------------------------------");
  if (databaseUrl) {
    console.log("✅ MODO PRODUCCIÓN: Conectando a PostgreSQL en Koyeb...");
  } else {
    console.log("⚠️ MODO LOCAL: Usando SQLite temporal (Los datos se borrarán).");
  }
  console.log("----------------------------------------------------------------");

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
            rejectUnauthorized: false // OBLIGATORIO PARA KOYEB
          },
        },
        debug: false,
      },
    };
  }

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