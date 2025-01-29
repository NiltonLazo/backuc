const express = require('express');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();

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

const port = process.env.PORT || 3000;

app.use(express.json());

// Rutas
app.get('/', async (req, res) => {
    res.send('¡Servidor funcionando correctamente!');
});

app.post('/users', async (req, res) => {
    try {
        const { name, email } = req.body;
        const newUser = await prisma.user.create({
            data: { name, email },
        });
        res.status(201).json(newUser);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al crear usuario');
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener usuarios');
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
