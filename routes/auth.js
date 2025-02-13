const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const router = express.Router();
const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Lista de correos de médicos registrados en la aplicación
const listaMedicos = ["nlazo@continental.edu.pe", "user2@continental.edu.pe"];

// Lista de correos de administrativos con acceso a la aplicación
const listaAdministrativos = ["admin1@continental.edu.pe", "admin2@continental.edu.pe"];

/**
 * Ruta: GET /get-user
 * Busca un usuario por su correo.
 */
router.get("/get-user", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "El correo es requerido" });
    }
    console.log("Buscando usuario con correo:", email);
    const usuario = await prisma.usuario.findUnique({
      where: { correo: email },
    });
    if (usuario) {
      return res.json({ usuario });
    } else {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
  } catch (error) {
    console.error("Error en /get-user:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
});

/**
 * Ruta: POST /google-signin
 * Inicia sesión con Google.
 */
router.post("/google-signin", async (req, res) => {
  const { token } = req.body;
  try {
    // Verificar el token de Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { name, email, picture } = payload;

    // Verificar que el correo sea institucional
    if (!email.endsWith("@continental.edu.pe")) {
      return res.status(403).json({ error: "Debe iniciar sesión con su correo institucional" });
    }

    // Determinar el rol basado en el correo
    let rol = "usuario"; // Valor por defecto
    let codigo = null;
    if (listaMedicos.includes(email)) {
      rol = "medico";
    } else if (listaAdministrativos.includes(email)) {
      rol = "administrador";
    } else if (/^\d+@continental\.edu\.pe$/.test(email)) {
      rol = "estudiante";
      codigo = email.split("@")[0];
    }

    // Buscar el usuario en la base de datos
    let usuario = await prisma.usuario.findUnique({ where: { correo: email } });
    if (!usuario) {
      // Si no existe, se devuelve un objeto con id null y los datos extraídos
      usuario = {
        id: null,
        nombre: name,
        correo: email,
        rol,
        codigo,
        foto: picture,
        telefono: null,
        sede: null,
        ciclo: null,
        carrera: null,
        modalidad: null,
      };
    }

    // Generar JWT (con email y rol; id puede ser null)
    const jwtToken = jwt.sign(
      { email: usuario.correo, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token: jwtToken, usuario });
  } catch (error) {
    console.error("Error en autenticación con Google:", error);
    res.status(401).json({ error: "Token inválido" });
  }
});

/**
 * Ruta: PUT /update-profile
 * Actualiza o crea el perfil del usuario.
 */
router.put("/update-profile", async (req, res) => {
  const { id, telefono, sede, ciclo, carrera, modalidad, nombre, correo, rol, codigo, foto } = req.body;
  try {
    if (!telefono || !sede) {
      return res.status(400).json({ error: "Teléfono y sede son obligatorios" });
    }
    let usuario;
    if (!id) {
      // Si no existe id, se crea el usuario.
      if (rol === "estudiante") {
        if (!ciclo || !carrera || !modalidad) {
          return res.status(400).json({ error: "Ciclo, carrera y modalidad son obligatorios para estudiantes" });
        }
      }
      usuario = await prisma.usuario.create({
        data: {
          nombre,
          correo,
          rol,
          codigo,
          foto,
          telefono,
          sede,
          ciclo: rol === "estudiante" ? parseInt(ciclo, 10) : null,
          carrera: rol === "estudiante" ? carrera : null,
          modalidad: rol === "estudiante" ? modalidad.toLowerCase().replace(" ", "_") : null,
        },
      });
    } else {
      // Si existe id, se actualiza el usuario.
      let usuarioExistente = await prisma.usuario.findUnique({ where: { id } });
      if (!usuarioExistente) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      if (usuarioExistente.rol === "estudiante") {
        if (!ciclo || !carrera || !modalidad) {
          return res.status(400).json({ error: "Ciclo, carrera y modalidad son obligatorios para estudiantes" });
        }
        const cicloInt = parseInt(ciclo, 10);
        if (isNaN(cicloInt)) {
          return res.status(400).json({ error: "Ciclo debe ser un número válido" });
        }
        usuario = await prisma.usuario.update({
          where: { id },
          data: {
            telefono,
            sede,
            ciclo: cicloInt,
            carrera,
            modalidad: modalidad.toLowerCase().replace(" ", "_"),
          },
        });
      } else {
        usuario = await prisma.usuario.update({
          where: { id },
          data: { telefono, sede },
        });
      }
    }
    res.json({ message: "Perfil actualizado correctamente", usuario });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * La ruta /crear-medico se elimina porque en este esquema
 * no existe un modelo separado para Medico; se utiliza el modelo Usuario.
 * Para registrar o actualizar la información de un médico se debe usar /update-profile.
 */

/**
 * Ruta: POST /asignar-horario
 * Asigna un horario a un médico.
 */
router.post("/asignar-horario", async (req, res) => {
  const { medicoId, dia, horaInicio, horaFin } = req.body;
  try {
    // Buscar usuario con rol "medico"
    const medico = await prisma.usuario.findFirst({
      where: { id: medicoId, rol: "medico" },
    });
    if (!medico) {
      return res.status(404).json({ error: "Médico no encontrado." });
    }
    const horario = await prisma.horarioMedico.create({
      data: {
        medicoId,
        dia,
        horaInicio,
        horaFin,
      },
    });
    res.json({ message: "Horario asignado correctamente", horario });
  } catch (error) {
    console.error("Error al asignar horario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * Ruta: GET /horarios-disponibles
 * Obtiene los horarios disponibles de los médicos en una sede y fecha determinada.
 */
router.get("/horarios-disponibles", async (req, res) => {
    const { modalidad, sede, fecha } = req.query;
    try {
      // Validar que la fecha esté en formato correcto.
      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({ error: "Fecha inválida. Debe estar en formato YYYY-MM-DD." });
      }
      
      // Convertir la fecha a objeto Date y verificar.
      const fechaConsulta = new Date(`${fecha}T00:00:00Z`);
      if (isNaN(fechaConsulta.getTime())) {
        return res.status(400).json({ error: "Fecha inválida. Usa el formato YYYY-MM-DD." });
      }
      console.log("Fecha procesada correctamente:", fechaConsulta);
  
      // Determinar el día de la semana sin acentos.
      const diasSemana = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const diaSemana = diasSemana[fechaConsulta.getUTCDay()];
      console.log(`Día de la semana calculado: ${diaSemana}`);
  
      // Si la modalidad es presencial, filtrar por sede.
      const filtroSede = modalidad.toLowerCase() === "presencial" ? { sede } : {};
  
      // Buscar los médicos (usuarios con rol "medico").
      const medicos = await prisma.usuario.findMany({
        where: {
          rol: "medico",
          ...filtroSede,
        },
        include: {
          horarios: true,
          bloqueos: true,
          citasMedico: true,
        },
      });
  
      let horariosDisponibles = [];
  
      for (const medico of medicos) {
        // Usar el nombre completo del médico y anteponer el prefijo si se desea.
        const nombreCompleto = "Psicól. " + medico.nombre;
  
        // Filtrar los horarios que correspondan al día de la semana.
        const horariosMedico = medico.horarios.filter(
          h => h.dia.trim().toLowerCase() === diaSemana.trim().toLowerCase()
        );
        if (!horariosMedico.length) {
          console.log(`Médico ${medico.nombre} no tiene horarios en ${diaSemana}`);
          continue;
        }
  
        // Preparar los bloqueos: convertir cada fecha bloqueada a "YYYY-MM-DD".
        const bloqueosMedico = medico.bloqueos.map(
          b => b.fecha?.toISOString().split("T")[0] || ""
        );
  
        // Mapear las citas reservadas a objetos { fecha, hora }
        const citasReservadas = medico.citasMedico.map(c => {
          const fechaCita = new Date(c.fecha).toISOString().split("T")[0];
          return { fecha: fechaCita, hora: c.hora };
        });
  
        // Por cada horario asignado al médico, generar intervalos de 60 minutos.
        for (const horario of horariosMedico) {
          if (!horario.horaInicio || !horario.horaFin) {
            console.warn(`Horario inválido para ${medico.nombre}:`, horario);
            continue;
          }
          const hInicio = parseInt(horario.horaInicio.split(":")[0], 10);
          const hFin = parseInt(horario.horaFin.split(":")[0], 10);
  
          // Iterar desde hInicio hasta hFin - 1 para generar intervalos.
          for (let hora = hInicio; hora < hFin; hora++) {
            const startHour = hora.toString().padStart(2, '0') + ":00";
            const endHour = (hora + 1).toString().padStart(2, '0') + ":00";
  
            // Verificar si ya existe una cita para este médico en esta fecha y con la hora generada.
            const isReserved = citasReservadas.some(r => r.fecha === fecha && r.hora === startHour);
            if (!isReserved && !bloqueosMedico.includes(fecha)) {
              horariosDisponibles.push({
                id: `${medico.id}-${startHour}`,
                hora: `${startHour} - ${endHour}`,
                medicoId: medico.id,
                nombreMedico: nombreCompleto,
              });
            }
          }
          console.log(`Horarios de ${medico.nombre}:`, horario);
        }
      }
      console.log("Horarios generados antes de enviar al frontend:", horariosDisponibles);
      res.json({ horarios: horariosDisponibles });
    } catch (error) {
      console.error("Error al obtener horarios:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
});
  
/**
 * Ruta: POST /reservar-cita
 * Reserva una cita para un estudiante con un médico.
 */
router.post("/reservar-cita", async (req, res) => {
  const { estudianteId, medicoId, motivo, fecha, hora, modalidad } = req.body;
  try {
    // Buscar al estudiante y al médico
    const estudiante = await prisma.usuario.findUnique({ where: { id: estudianteId } });
    const medico = await prisma.usuario.findFirst({ where: { id: medicoId, rol: "medico" } });
    if (!estudiante || !medico) {
      return res.status(404).json({ error: "Estudiante o médico no encontrado." });
    }
    
    // Validar la fecha (se espera formato "YYYY-MM-DD")
    const fechaDate = new Date(fecha);
    if (isNaN(fechaDate.getTime())) {
      return res.status(400).json({ error: "Fecha inválida. Debe estar en formato YYYY-MM-DD." });
    }
    
    // Validar que la hora tenga el formato "HH:mm"
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ error: "Hora inválida. Debe estar en formato HH:mm." });
    }
    
    // Verificar que la cita se reserve con al menos 48 horas de anticipación
    const now = new Date();
    const minReservaFull = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    // Convertir a fecha sin hora (00:00)
    const minReservaDate = new Date(minReservaFull.getFullYear(), minReservaFull.getMonth(), minReservaFull.getDate());
    if (fechaDate < minReservaDate) {
      // Obtener el nombre del día en español para minReservaDate
      const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const diaDisponible = dias[minReservaDate.getDay()];
      return res.status(400).json({ error: `Para reservar una cita debe ser con 48 horas de anticipación, puede reservar su cita a partir del día ${diaDisponible}.` });
    }
    
    // Verificar si ya existe una cita pendiente para este estudiante
    const citaPendiente = await prisma.cita.findFirst({
      where: { estudianteId, estado: "pendiente" }
    });
    if (citaPendiente) {
      return res.status(400).json({ error: "Ya tienes una cita pendiente. No puedes reservar otra hasta que la actual sea confirmada." });
    }
    
    // Verificar si el horario ya está reservado para este médico en esa fecha y hora
    const citaExistente = await prisma.cita.findFirst({
      where: { medicoId, fecha: fechaDate, hora }
    });
    if (citaExistente) {
      return res.status(400).json({ error: "El horario ya está reservado." });
    }
    
    // Mapear la modalidad (virtual o presencial)
    const tipo = modalidad.toLowerCase() === "virtual" ? "virtual" : "presencial";
    
    // Crear la cita
    const cita = await prisma.cita.create({
      data: {
        estudianteId,
        medicoId,
        motivo,
        fecha: fechaDate,
        hora,
        tipo,
        estado: "pendiente",
      },
    });
    
    res.json({ message: "Cita reservada correctamente", cita });
  } catch (error) {
    console.error("Error al reservar cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * Ruta: GET /cita-pendiente
 * Verifica si el estudiante tiene una cita pendiente.
 * Se espera que se reciba un parámetro de consulta 'estudianteId'.
 * Devuelve { pending: true } si existe una cita pendiente, o { pending: false } en caso contrario.
 */
router.get("/cita-pendiente", async (req, res) => {
  const { estudianteId } = req.query;
  if (!estudianteId) {
    return res.status(400).json({ error: "El estudianteId es requerido" });
  }
  try {
    const citaPendiente = await prisma.cita.findFirst({
      where: {
        estudianteId: parseInt(estudianteId, 10),
        estado: "pendiente"
      }
    });
    return res.json({ pending: citaPendiente != null });
  } catch (error) {
    console.error("Error al verificar cita pendiente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
