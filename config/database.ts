import path from 'path';
import type { Core } from '@strapi/strapi';
import { parse } from 'pg-connection-string'; // Necesitaremos esto para separar los datos

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Database => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  // Lógica especial para Postgres/Neon cuando se usa DATABASE_URL
  const postgresConfig = () => {
    const connectionString = env('DATABASE_URL');
    if (connectionString) {
      const config = parse(connectionString);
      return {
        connection: {
          connectionString,
          host: config.host,
          port: parseInt(config.port || '5432', 10),
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: { rejectUnauthorized: false }, // Neon requiere SSL para conexión segura
          schema: env('DATABASE_SCHEMA', 'public'),
        },
        pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
      };
    }
    // Fallback si no hay DATABASE_URL (para local con variables sueltas)
    return {
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false),
        schema: env('DATABASE_SCHEMA', 'public'),
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    };
  };

  const connections = {
    mysql: { /* ... tu config de mysql ... */ },
    postgres: postgresConfig(),
    sqlite: {
      connection: {
        filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};

export default config;