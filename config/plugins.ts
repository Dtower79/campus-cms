export default ({ env }) => ({
  // 1. Configuración de Cloudinary (Imágenes/Vídeos)
  upload: {
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_NAME'),
        api_key: env('CLOUDINARY_KEY'),
        api_secret: env('CLOUDINARY_SECRET'),
      },
      actionOptions: {
        upload: {
          resource_type: "auto",
          access_mode: "public"
        },
        uploadStream: {},
        delete: {},
      },
    },
  },

  // 2. Configuración de Email (Nodemailer) - NUEVO
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST'),
        port: env.int('SMTP_PORT', 587),
        secure: false, // true para puerto 465
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
        // Fix común para servidores antiguos que rechazan certificados
        tls: {
          rejectUnauthorized: false
        },
      },
      settings: {
        defaultFrom: 'formacio@sicap.cat',
        defaultReplyTo: 'formacio@sicap.cat',
      },
    },
  },
});