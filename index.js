const express = require('express');
const cors = require("cors");
const authRoutes = require("./routes/auth");
const psicologoRoutes = require("./routes/psicologo");
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Configurar dinámicamente la conexión a la base de datos
const DATABASE_URL =
    process.env.ENVIRONMENT === 'local'
        ? process.env.DATABASE_URL_LOCAL
        : process.env.DATABASE_URL_DOCKER;

console.log(`Conectando a la base de datos en: ${DATABASE_URL}`);

// Verifica si DATABASE_URL está undefined
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL no está definido. Verifica tu archivo .env y la lógica de ENVIRONMENT.");
}

// Inicializar PrismaClient con la URL dinámica
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DATABASE_URL, // URL dinámica
        },
    },
});

// Rutas
app.use("/auth", authRoutes);

// Rutas del psicólogo
app.use("/psicologo", psicologoRoutes);

// Ruta de prueba
app.get('/', async (req, res) => {
    res.send('¡Servidor funcionando correctamente!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor escuchando en http://10.0.2.2:${port}`);
    // console.log(`Servidor escuchando en http://localhost:${port}`); // Para dispositivos físicos
    require('./cronJobs');
});
