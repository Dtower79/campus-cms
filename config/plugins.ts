export default ({ env }) => ({
  // 1. Cloudinary (Sin cambios)
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

  // 2. Email con DEBUG ACTIVADO
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST'),
        port: env.int('SMTP_PORT', 465),
        secure: true, // Volvemos a TRUE porque usaremos el 465
        debug: true,  // <--- ESTO NOS DIRÁ LA VERDAD
        logger: true, // <--- ESTO NOS DIRÁ LA VERDAD
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
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