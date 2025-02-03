const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const router = express.Router();
const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Lista de correos de médicos registrados en la aplicación
const listaMedicos = ["user1@continental.edu.pe", "user2@continental.edu.pe"];

// Lista de correos de administrativos con acceso a la aplicación
const listaAdministrativos = ["admin1@continental.edu.pe", "admin2@continental.edu.pe"];

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
        const { name, email, picture } = payload; // Extrae la URL de la foto de perfil

        // Verificar que el correo sea institucional
        if (!email.endsWith("@continental.edu.pe")) {
            return res.status(403).json({ error: "Debe iniciar sesión con su correo institucional" });
        }

        // Determinar el rol del usuario basado en su correo
        let rol = "usuario"; // Valor por defecto
        let codigo = null; // Inicialmente sin código

        if (listaMedicos.includes(email)) {
            rol = "medico";
        } else if (listaAdministrativos.includes(email)) {
            rol = "administrador";
        } else if (/^\d+@continental\.edu\.pe$/.test(email)) {
            // Si el correo es un número (DNI), es estudiante
            rol = "estudiante";
            codigo = email.split("@")[0]; // Extrae el código del correo
        }

        // Busca si el usuario ya existe en la base de datos
        let usuario = await prisma.usuario.findUnique({ where: { correo: email } });

        if (!usuario) {
            // Crea el usuario con código y foto si es nuevo
            usuario = await prisma.usuario.create({
                data: {
                    nombre: name,
                    correo: email,
                    rol,
                    codigo, // Guarda el código si es estudiante
                    foto: picture // Guarda la foto de perfil
                },
            });
        } else {
            // Actualizar el rol, código y foto si el usuario ya existe
            usuario = await prisma.usuario.update({
                where: { correo: email },
                data: {
                    rol,
                    codigo: codigo || usuario.codigo, // No sobreescribir si ya tiene un código
                    foto: picture // Siempre actualizar la foto para que esté actualizada
                },
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

// Ruta para actualizar el perfil del usuario
router.put("/update-profile", async (req, res) => {
    const { id, telefono, sede, ciclo, carrera, modalidad } = req.body;

    try {
        let usuario = await prisma.usuario.findUnique({ where: { id } });

        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        if (!telefono || !sede) {
            return res.status(400).json({ error: "Teléfono y sede son obligatorios" });
        }

        let cicloInt = null;
        if (usuario.rol === "estudiante") {
            if (!ciclo || !carrera || !modalidad) {
                return res.status(400).json({ error: "Ciclo, carrera y modalidad son obligatorios para estudiantes" });
            }
            cicloInt = parseInt(ciclo, 10);
            if (isNaN(cicloInt)) {
                return res.status(400).json({ error: "Ciclo debe ser un número válido" });
            }
        }

        // Convertir modalidad a minúsculas para coincidir con Prisma
        const modalidadLower = modalidad ? modalidad.toLowerCase().replace(' ', '_') : null;

        usuario = await prisma.usuario.update({
            where: { id },
            data: {
                telefono,
                sede,
                ciclo: usuario.rol === "estudiante" ? cicloInt : null,
                carrera: usuario.rol === "estudiante" ? carrera : null,
                modalidad: usuario.rol === "estudiante" ? modalidadLower : null,
            },
        });

        res.json({ message: "Perfil actualizado correctamente", usuario });
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

module.exports = router;
