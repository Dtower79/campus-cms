// js/config.js
const STRAPI_URL = 'https://purring-allx-sicap-831823c5.koyeb.app'; 

const API_ROUTES = {
    login: `${STRAPI_URL}/api/auth/local`,
    register: `${STRAPI_URL}/api/auth/local/register`,
    checkAffiliate: `${STRAPI_URL}/api/afiliados`,
    notifications: `${STRAPI_URL}/api/notificaciones`,
    messages: `${STRAPI_URL}/api/missatges`, // <--- ¡FALTABA ESTA COMA!
    forgotPassword: `${STRAPI_URL}/api/auth/forgot-password`,
    resetPassword: `${STRAPI_URL}/api/auth/reset-password`
};