// cronJobs.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const prisma = new PrismaClient();

// Función que refresca los tokens para todos los psicólogos que tengan un refresh token
const refreshAllTokens = async () => {
  try {
    // Buscar todos los psicólogos que tengan un refresh token almacenado.
    const psicologos = await prisma.psicologo.findMany({
      where: {
        calendarRefreshToken: {
          not: null,
        },
      },
    });

    if (!psicologos.length) {
      console.log('No se encontraron psicólogos con refresh token.');
      return;
    }

    // Instanciar el OAuth2Client con las credenciales de Google.
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Para cada psicólogo, refrescar el token usando su refresh token.
    for (const psicologo of psicologos) {
      oauth2Client.setCredentials({ refresh_token: psicologo.calendarRefreshToken });
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        // Actualiza el token y la fecha de expiración en la base de datos.
        await prisma.psicologo.update({
            where: { id: psicologo.id },
            data: {
              calendarAccessToken: credentials.access_token,
              calendarTokenExpiry: new Date(credentials.expiry_date),
            },
          });
        console.log(`Token actualizado para ${psicologo.correo}`);
      } catch (err) {
        console.error(`Error actualizando token para ${psicologo.correo}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Error en el cron job:", err.message);
  }
};

// Programar la tarea cron para que se ejecute cada 5 minutos.
// La expresión '*/5 * * * *' indica "cada 5 minutos".
cron.schedule('*/1 * * * *', () => {
  console.log('Ejecutando cron job para refrescar tokens...');
  refreshAllTokens();
});
