const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const router = express.Router();
const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Lista de correos de médicos registrados en la aplicación
const listaMedicos = ["user1@continental.edu.pe", "user2@continental.edu.pe"]; // Agrega más médicos aquí

// Lista de correos de administrativos con acceso a la aplicación
const listaAdministrativos = ["admin1@continental.edu.pe", "admin2@continental.edu.pe"]; // Agrega más administrativos aquí

// Ruta para iniciar sesión con Google
router.post("/google-signin", async (req, res) => {
    const { token } = req.body;

    try {
        // Verificar el token de Google
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { name, email } = payload;

        // Verificar que el correo sea institucional
        if (!email.endsWith("@continental.edu.pe")) {
            return res.status(403).json({ error: "Debe iniciar sesión con su correo institucional" });
        }

        // Determinar el rol del usuario basado en su correo
        let rol = "usuario"; // Valor por defecto

        if (listaMedicos.includes(email)) {
            // Si el correo está en la lista de médicos
            rol = "medico";
        } else if (listaAdministrativos.includes(email)) {
            // Si el correo está en la lista de administrativos
            rol = "administrador";
        } else if (/^\d+@continental\.edu\.pe$/.test(email)) {
            // Si el correo es un número (DNI), es estudiante
            rol = "estudiante";
        }

        // Buscar si el usuario ya existe en la base de datos
        let usuario = await prisma.usuario.findUnique({ where: { correo: email } });

        if (!usuario) {
            usuario = await prisma.usuario.create({
                data: { nombre: name, correo: email, rol },
            });
        } else if (usuario.rol !== rol) {
            // Si el usuario ya existe pero su rol es diferente, actualizarlo
            usuario = await prisma.usuario.update({
                where: { correo: email },
                data: { rol },
            });
        }

        // Generar JWT con el rol del usuario
        const jwtToken = jwt.sign(
            { id: usuario.id, email: usuario.correo, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token: jwtToken, usuario });
    } catch (error) {
        console.error("Error en autenticación con Google:", error);
        res.status(401).json({ error: "Token inválido" });
    }
});

module.exports = router;
