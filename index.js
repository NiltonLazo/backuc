const express = require('express');
const cors = require("cors");
const authRoutes = require("./routes/auth");
const psicologoRoutes = require("./routes/psicologo");
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 🚀 Corregido: Usar DATABASE_URL directamente
const DATABASE_URL = process.env.DATABASE_URL;

console.log(`Conectando a la base de datos en: ${DATABASE_URL}`);

// 🚨 Si DATABASE_URL sigue sin aparecer en logs, Railway no la está pasando correctamente
if (!DATABASE_URL) {
    throw new Error("DATABASE_URL no está definido. Verifica Railway.");
}

// 🚀 Corregido: Prisma ahora usa DATABASE_URL automáticamente
const prisma = new PrismaClient();

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
    require('./cronJobs');
});
