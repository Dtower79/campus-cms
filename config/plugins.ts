import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams) => ({
  ckeditor: {
    enabled: true,
    // Aquí podrías añadir configuraciones extra, pero por ahora solo lo activamos
  },
});

export default config;