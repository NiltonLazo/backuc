const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { PrismaClient } = require("@prisma/client");
const { google } = require("googleapis");
require("dotenv").config();

const router = express.Router();
const prisma = new PrismaClient();
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Helper: Obtener eventos de Disponibilidad (los que contienen "CITAS")
async function getAvailableEvents(accessToken, fecha) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const timeMin = new Date(`${fecha}T00:00:00-05:00`);
    const timeMax = new Date(`${fecha}T23:59:59-05:00`);
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      q: 'CITAS'
    });
    return response.data.items || [];
  } catch (error) {
    console.error("Error al obtener eventos disponibles:", error.message);
    return [];
  }
}

// Helper: Obtener eventos Ocupados (todos, menos los de disponibilidad)
async function getBusyEvents(accessToken, fecha) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const timeMin = new Date(`${fecha}T00:00:00-05:00`);
    const timeMax = new Date(`${fecha}T23:59:59-05:00`);
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    const events = response.data.items || [];
    // Filtrar: excluir eventos que contengan "CITAS" y además los eventos all-day (los que tienen "date" en vez de "dateTime")
    return events.filter(event => {
      const isAllDay = !event.start.dateTime && event.start.date;
      return !(event.summary && event.summary.toUpperCase().includes("CITAS")) && !isAllDay;
    });
  } catch (error) {
    console.error("Error al obtener eventos ocupados:", error.message);
    return [];
  }
}

// Helper: Crear evento en Google Calendar (condicionalmente con Google Meet)
async function createCalendarEvent(accessToken, summary, description, startDateTime, endDateTime, attendeesEmails, isVirtual) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: summary,
      description: description,
      start: { dateTime: startDateTime, timeZone: 'America/Lima' },
      end: { dateTime: endDateTime, timeZone: 'America/Lima' },
      attendees: attendeesEmails.map(email => ({ email })),
    };
    
    if (isVirtual) {
      event.conferenceData = {
        createRequest: {
          requestId: Math.random().toString(36).substring(2, 15),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      };
    }
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: isVirtual ? 1 : undefined,
      sendUpdates: 'all'
    });
    console.log("Evento creado, respuesta:", response.data);
    
    if (isVirtual) {
      const eventId = response.data.id;
      const meetLink = response.data.conferenceData &&
          response.data.conferenceData.entryPoints &&
          response.data.conferenceData.entryPoints.length > 0
          ? response.data.conferenceData.entryPoints[0].uri
          : null;
      return { eventId, meetLink };
    } else {
      return { eventId: response.data.id, meetLink: null };
    }
  } catch (error) {
    console.error("Error al crear evento en Calendar:", error.message);
    if (error.response && error.response.data) {
      console.error("Detalles del error:", error.response.data);
    }
    return null;
  }
}

// Helper: Calcular intervalos libres descontando los eventos
function computeFreeIntervals(rangeStart, rangeEnd, events) {
  const eventIntervals = events.map(event => {
    const evStart = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date);
    const evEnd = event.end.dateTime ? new Date(event.end.dateTime) : new Date(event.end.date);
    return { start: evStart, end: evEnd };
  }).sort((a, b) => a.start - b.start);

  const freeIntervals = [];
  let current = new Date(rangeStart);
  for (const interval of eventIntervals) {
    if (interval.start > current) {
      const freeEnd = interval.start < rangeEnd ? interval.start : rangeEnd;
      if (freeEnd > current) {
        freeIntervals.push({ start: new Date(current), end: new Date(freeEnd) });
      }
    }
    if (interval.end > current) {
      current = new Date(interval.end);
    }
    if (current >= rangeEnd) break;
  }
  if (current < rangeEnd) {
    freeIntervals.push({ start: new Date(current), end: new Date(rangeEnd) });
  }
  return freeIntervals;
}

// Helper: Subdividir un intervalo en slots de 60 minutos
function subdivideInterval(interval, durationMinutes = 60) {
  const slots = [];
  const durationMs = durationMinutes * 60000;
  let slotStart = new Date(interval.start);
  while (slotStart.getTime() + durationMs <= interval.end.getTime()) {
    const slotEnd = new Date(slotStart.getTime() + durationMs);
    slots.push({ start: new Date(slotStart), end: slotEnd });
    slotStart = slotEnd;
  }
  return slots;
}

/**
 * Función auxiliar para buscar o crear el usuario según el rol.
 * - Si el correo comienza con dígitos, se trata de un estudiante.
 * - Si no, se verifica que el correo esté en AllowedEmail y, según el campo 'role',
 *   se asume que es psicólogo o administrador.
 */
async function findOrCreateUser(name, email, picture, accessToken, refreshToken) {
  const trimmedEmail = email.trim();

  if (/^\d/.test(trimmedEmail)) {
    // Es un estudiante
    let user = await prisma.estudiante.findUnique({ where: { correo: trimmedEmail } });
    if (user) {
      user = await prisma.estudiante.update({
        where: { correo: trimmedEmail },
        data: { calendarAccessToken: accessToken },
      });
    } else {
      user = await prisma.estudiante.create({
        data: {
          nombre: name,
          correo: trimmedEmail,
          foto: picture,
          // Se extrae el DNI del correo (parte numérica)
          codigo: trimmedEmail.split("@")[0],
          telefono: null,
          sede: null,
          ciclo: null,
          carrera: null,
          modalidad: null,
          calendarAccessToken: accessToken,
        },
      });
    }
    return { user: { ...user, rol: "estudiante" }, role: "estudiante" };
  } else {
    // Para psicólogos o administradores: se consulta la tabla AllowedEmail
    const allowed = await prisma.allowedEmail.findUnique({ where: { email: trimmedEmail } });
    if (!allowed || allowed.active !== true) {
      throw new Error("Correo no autorizado para acceder.");
    }
    const roleFromAllowed = allowed.role.toLowerCase(); // se espera "psicologo" o "administrador"
    if (roleFromAllowed === "administrador") {
      let user = await prisma.administrador.findUnique({ where: { correo: trimmedEmail } });
      if (user) {
        user = await prisma.administrador.update({
          where: { correo: trimmedEmail },
          data: { calendarAccessToken: accessToken },
        });
      } else {
        user = await prisma.administrador.create({
          data: {
            nombre: name,
            correo: trimmedEmail,
            foto: picture,
            telefono: null,
            calendarAccessToken: accessToken,
          },
        });
      }
      return { user: { ...user, rol: "administrador" }, role: "administrador" };
    } else {
      // Por defecto, se asume que es psicólogo
      let user = await prisma.psicologo.findUnique({ where: { correo: trimmedEmail } });
      if (user) {
        user = await prisma.psicologo.update({
          where: { correo: trimmedEmail },
          data: {
            calendarAccessToken: accessToken,
            calendarRefreshToken: refreshToken, // Guarda el refresh token
          },
        });
      } else {
        user = await prisma.psicologo.create({
          data: {
            nombre: name,
            correo: trimmedEmail,
            foto: picture,
            telefono: null,
            sede: null,
            calendarAccessToken: accessToken,
            calendarRefreshToken: refreshToken, // Guarda el refresh token
          },
        });
      }
      return { user: { ...user, rol: "psicologo" }, role: "psicologo" };
    }
  }
}

// Helper: Eliminar evento en Google Calendar
async function deleteCalendarEvent(accessToken, eventId) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    return true;
  } catch (error) {
    console.error("Error al eliminar evento en Calendar:", error.message);
    return false;
  }
}

/**
 * Ruta: GET /get-user
 * Busca un usuario por su correo en las tablas Estudiante, Psicologo y Administrador.
 */
router.get("/get-user", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "El correo es requerido" });
    }
    console.log("Buscando usuario con correo:", email.trim());
    let user = await prisma.estudiante.findUnique({ where: { correo: email.trim() } });
    let role = "estudiante";
    if (!user) {
      user = await prisma.psicologo.findUnique({ where: { correo: email.trim() } });
      role = "psicologo";
    }
    if (!user) {
      user = await prisma.administrador.findUnique({ where: { correo: email.trim() } });
      role = "administrador";
    }
    if (user) {
      // Agregar rol al objeto devuelto
      return res.json({ usuario: { ...user, rol: role }, role });
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
 * - Para correos que comienzan con dígitos se trata como estudiante.
 * - Para correos que comienzan con letras se consulta AllowedEmail para verificar autorización.
 */
router.post("/google-signin", async (req, res) => {
  let token, accessToken, refreshToken;

  // Flujo con código de autorización (web)
  if (req.body.code) {
    const { code } = req.body;
    try {
      const { tokens } = await client.getToken({
        code,
        redirect_uri: process.env.REDIRECT_URI || "http://localhost:3001",
      });
      token = tokens.id_token;
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token;  // Aquí se extrae el refresh token
      console.log("Tokens obtenidos del intercambio:", tokens);
    } catch (error) {
      console.error("Error al intercambiar el código de autorización:", error);
      return res.status(401).json({ error: "Error al intercambiar el código de autorización" });
    }
  } else {
    // Flujo directo (por ejemplo, desde Flutter)
    token = req.body.token;
    accessToken = req.body.accessToken;
    // En este flujo, es posible que no se envíe refreshToken
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { name, email, picture } = payload;
    const trimmedEmail = email.trim();

    if (!trimmedEmail.endsWith("@continental.edu.pe")) {
      return res.status(403).json({ error: "Debe iniciar sesión con su correo institucional" });
    }

    // Usar la función auxiliar para buscar o crear el usuario según su rol.
    // Se le pasa también el refreshToken, que podrá ser almacenado para usos posteriores.
    const { user, role } = await findOrCreateUser(name, trimmedEmail, picture, accessToken, refreshToken);

    // Definir isFirstLogin según el rol:
    // - Estudiante: si faltan teléfono, sede, ciclo, carrera o modalidad.
    // - Psicólogo o Administrador: si faltan teléfono o sede.
    const isFirstLogin =
      role === "estudiante"
        ? (!user.telefono || !user.sede || !user.ciclo || !user.carrera || !user.modalidad)
        : (!user.telefono || !user.sede);

    const jwtToken = jwt.sign(
      { email: user.correo, rol: role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Se incluye refreshToken en la respuesta (si existe)
    res.json({ token: jwtToken, usuario: { ...user, rol: role, refreshToken }, isFirstLogin });
  } catch (error) {
    console.error("Error en autenticación con Google:", error);
    return res.status(401).json({ error: "Token inválido" });
  }
})

/**
 * Ruta: PUT /update-profile
 * Actualiza o crea el perfil del usuario según su rol.
 */
router.put("/update-profile", async (req, res) => {
  const { id, telefono, sede, ciclo, carrera, modalidad, rol, fechaNacimiento } = req.body;
  const phoneRegex = /^9\d{8}$/;
  
  // Validar que el teléfono esté presente y sea correcto
  if (!telefono) {
    return res.status(400).json({ error: "El teléfono es obligatorio" });
  }
  if (!phoneRegex.test(telefono)) {
    return res.status(400).json({ error: "Ingrese un número de celular correcto" });
  }

  let usuario;
  try {
    if (rol === "estudiante") {
      // Para estudiantes se requieren teléfono, sede, ciclo, carrera y modalidad
      if (!sede || !ciclo || !carrera || !modalidad) {
        return res.status(400).json({ error: "Teléfono, sede, ciclo, carrera y modalidad son obligatorios para estudiantes" });
      }
      const cicloInt = parseInt(ciclo, 10);
      if (isNaN(cicloInt)) {
        return res.status(400).json({ error: "Ciclo debe ser un número válido" });
      }
      
      // Convertir fechaNacimiento del formato "dd/MM/yyyy" a Date (si se envía)
      let fechaNacimientoDate;
      if (fechaNacimiento) {
        const [day, month, year] = fechaNacimiento.split("/");
        fechaNacimientoDate = new Date(year, month - 1, day);
      }

      usuario = await prisma.estudiante.update({
        where: { id },
        data: {
          telefono,
          sede,
          ciclo: cicloInt,
          carrera,
          modalidad: modalidad.toLowerCase().replace(" ", "_"),
          ...(fechaNacimientoDate ? { fechaNacimiento: fechaNacimientoDate } : {})
        },
      });
    } else if (rol === "psicologo") {
      // Para psicólogos se requiere que se ingrese la sede
      if (!sede) {
        return res.status(400).json({ error: "La sede es obligatoria para psicólogos" });
      }
      usuario = await prisma.psicologo.update({
        where: { id },
        data: { telefono, sede },
      });
    } else if (rol === "administrador") {
      // Para administradores, se actualiza el teléfono; si se envía sede, se actualiza también
      usuario = await prisma.administrador.update({
        where: { id },
        data: { telefono, ...(sede ? { sede } : {}) },
      });
    }
    res.json({ message: "Perfil actualizado correctamente", usuario });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * Ruta: POST /asignar-horario
 * Asigna un horario a un psicólogo.
 */
router.post("/asignar-horario", async (req, res) => {
  const { psicologoId, dia, horaInicio, horaFin } = req.body;
  try {
    const psicologo = await prisma.psicologo.findFirst({
      where: { id: psicologoId },
    });
    if (!psicologo) {
      return res.status(404).json({ error: "Psicólogo no encontrado." });
    }
    const horario = await prisma.horario.create({
      data: {
        psicologoId,
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
 * Obtiene los horarios disponibles de los psicólogos en una sede y fecha determinada.
 */
router.get("/horarios-disponibles", async (req, res) => {
  const { sede, fecha } = req.query;
  try {
    // Validar que la fecha tenga el formato correcto
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: "Fecha inválida. Debe estar en formato YYYY-MM-DD." });
    }
    const fechaConsulta = new Date(`${fecha}T00:00:00-05:00`);
    if (isNaN(fechaConsulta.getTime())) {
      return res.status(400).json({ error: "Fecha inválida. Usa el formato YYYY-MM-DD." });
    }
    // Permitir consultas hasta 15 días a partir de hoy
    const hoy = new Date();
    const maxFecha = new Date();
    maxFecha.setDate(hoy.getDate() + 15);
    if (fechaConsulta > maxFecha) {
      return res.status(400).json({ error: "Solo se pueden ver horarios hasta 15 días a partir de hoy." });
    }
    
    // Filtrar psicólogos por sede (independientemente de la modalidad)
    const filtroSede = sede && sede.trim() !== "" ? { sede: sede.trim() } : {};
    
    // Buscar psicólogos aplicando el filtro de sede
    const psicologos = await prisma.psicologo.findMany({
      where: {
        ...filtroSede
      },
    });
    console.log("Psicólogos encontrados con sede:", sede, psicologos.map(p => p.correo));
    
    let slotsTotal = [];
    
    for (const psicologo of psicologos) {
      // Verificar que el psicólogo tenga token de Calendar
      if (!psicologo.calendarAccessToken) {
        console.log(`El psicólogo ${psicologo.correo} no tiene calendarAccessToken.`);
        continue;
      }
      
      // Obtener eventos de disponibilidad y eventos ocupados del calendario
      const availableEvents = await getAvailableEvents(psicologo.calendarAccessToken, fecha);
      const busyEvents = await getBusyEvents(psicologo.calendarAccessToken, fecha);

      console.log(`Para ${psicologo.correo}:`);
      console.log("  Eventos disponibles:", availableEvents);
      console.log("  Eventos ocupados:", busyEvents);
      
      // Para cada bloque de disponibilidad, calcular los intervalos libres
      for (const availEvent of availableEvents) {
        const rangeStart = new Date(availEvent.start.dateTime || availEvent.start.date);
        const rangeEnd = new Date(availEvent.end.dateTime || availEvent.end.date);
        console.log(`  Evento CITAS desde ${rangeStart} hasta ${rangeEnd}`);

        const freeIntervals = computeFreeIntervals(rangeStart, rangeEnd, busyEvents);
        console.log("  Intervalos libres calculados:", freeIntervals);
        
        // Dividir cada intervalo en slots de 60 minutos
        for (const interval of freeIntervals) {
          const slots = subdivideInterval(interval, 60);
          console.log(`  Slots generados para el intervalo ${interval.start} - ${interval.end}:`, slots);

          const mappedSlots = slots.map(slot => {
            const horaStr = slot.start.toLocaleTimeString("es-PE", {
              timeZone: "America/Lima",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).trim();
            return {
              id: `${psicologo.id}-${availEvent.id}-${horaStr}`,
              psicologoId: psicologo.id,
              nombrePsicologo: "Psicól. " + psicologo.nombre,
              hora: horaStr,
              start: slot.start,
              end: slot.end,
            };
          });
          slotsTotal = slotsTotal.concat(mappedSlots);
        }
      }
    }
    
    // Después del ciclo que acumula todos los slots en slotsTotal
    console.log("Slots totales antes de deduplicar:", slotsTotal);

    // Deduplicar slots
    const uniqueSlots = Array.from(new Map(slotsTotal.map(slot => [slot.id, slot])).values());
    console.log("Slots únicos generados:", uniqueSlots);
    
    res.json({ horarios: uniqueSlots });
  } catch (error) {
    console.error("Error al obtener horarios disponibles:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * Ruta: POST /reservar-cita
 * Reserva una cita para un estudiante con un psicólogo.
 */
router.post("/reservar-cita", async (req, res) => {
  const { estudianteId, psicologoId, motivo, fecha, hora, modalidad } = req.body;
  try {
    // Buscar estudiante y psicólogo en la BD
    const estudiante = await prisma.estudiante.findUnique({ where: { id: estudianteId } });
    const psicologo = await prisma.psicologo.findFirst({ where: { id: psicologoId } });
    if (!estudiante || !psicologo) {
      return res.status(404).json({ error: "Estudiante o psicólogo no encontrado." });
    }

    // Validar la fecha
    const fechaDate = new Date(`${fecha}T00:00:00-05:00`);
    if (isNaN(fechaDate.getTime())) {
      return res.status(400).json({ error: "Fecha inválida. Debe estar en formato YYYY-MM-DD." });
    }
    
    // Limitar la reserva a 15 días a partir de hoy
    const hoy = new Date();
    const maxFecha = new Date();
    maxFecha.setDate(hoy.getDate() + 15);
    if (fechaDate > maxFecha) {
      return res.status(400).json({ error: "Solo se puede reservar una cita hasta 15 días a partir de hoy." });
    }
    
    // Validar el formato de hora (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ error: "Hora inválida. Debe estar en formato HH:mm." });
    }
    
    // Validar que la reserva se haga con 48 horas de anticipación
    const hoyLima = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
    const minReservaDate = new Date(hoyLima.getFullYear(), hoyLima.getMonth(), hoyLima.getDate() + 2);
    if (fechaDate < minReservaDate) {
      const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const diaDisponible = dias[minReservaDate.getDay()];
      return res.status(400).json({ error: `Para reservar una cita debe ser con al menos dos días de anticipación, puede reservar su cita a partir del día ${diaDisponible}.` });
    }
    
    // Verificar que el estudiante no tenga una cita pendiente
    const citaPendiente = await prisma.cita.findFirst({
      where: { estudianteId, estado: "pendiente" }
    });
    if (citaPendiente) {
      return res.status(400).json({ error: "Ya tienes una cita pendiente. No puedes reservar otra hasta que la actual sea confirmada." });
    }
    
    // Verificar que el horario no esté ya reservado para ese psicólogo
    const citaExistente = await prisma.cita.findFirst({
      where: { psicologoId, fecha: fechaDate, hora }
    });
    if (citaExistente) {
      return res.status(400).json({ error: "El horario ya está reservado." });
    }
    
    // Determinar tipo de cita (virtual o presencial)
    const tipo = modalidad.toLowerCase() === "virtual" ? "virtual" : "presencial";
    
    // Crear la cita en la BD
    let cita = await prisma.cita.create({
      data: {
        estudianteId,
        psicologoId,
        motivo,
        fecha: fechaDate,
        hora,
        tipo,
        estado: "pendiente",
      },
    });
    
    // Usar el token para crear el evento en Google Calendar
    let tokenToUse = psicologo.calendarAccessToken || estudiante.calendarAccessToken;
    // Después de crear el evento en Calendar
    if (tokenToUse) {
      const startDateTimeLocal = `${fecha}T${hora}:00`;
      const [hourPart, minutePart] = hora.split(":");
      const endHour = (parseInt(hourPart, 10) + 1).toString().padStart(2, "0");
      const endDateTimeLocal = `${fecha}T${endHour}:${minutePart}:00`;
      
      const isVirtual = modalidad.toLowerCase() === "virtual";
      
      const eventResult = await createCalendarEvent(
        tokenToUse,
        "Cita de Psicología",
        motivo,
        startDateTimeLocal,
        endDateTimeLocal,
        [psicologo.correo, estudiante.correo],
        isVirtual
      );
      
      if (isVirtual && eventResult) {
        cita = await prisma.cita.update({
          where: { id: cita.id },
          data: { meetLink: eventResult.meetLink, calendarEventId: eventResult.eventId },
        });
      } else if (!isVirtual) {
        cita = await prisma.cita.update({
          where: { id: cita.id },
          data: { meetLink: null, calendarEventId: eventResult.eventId },
        });
      }
    }
    
    res.json({ message: "Cita reservada correctamente", cita });
  } catch (error) {
    console.error("Error al reservar cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * Ruta: GET /cita-pendiente
 * Verifica si el estudiante tiene una cita pendiente.
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
        estado: "pendiente",
      },
    });
    return res.json({ pending: citaPendiente != null });
  } catch (error) {
    console.error("Error al verificar cita pendiente:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * Ruta: PUT /update-calendar-token
 * Actualiza el calendarAccessToken de un usuario dado su correo.
 * Se busca en Psicologo y Estudiante.
 */
router.put("/update-calendar-token", async (req, res) => {
  const { email, newAccessToken } = req.body;
  try {
    let usuario = await prisma.psicologo.update({
      where: { correo: email },
      data: { calendarAccessToken: newAccessToken },
    }).catch(() => null);
    if (!usuario) {
      usuario = await prisma.estudiante.update({
        where: { correo: email },
        data: { calendarAccessToken: newAccessToken },
      });
    }
    if (usuario) {
      res.json({ message: "Token actualizado correctamente", usuario });
    } else {
      res.status(404).json({ error: "Usuario no encontrado" });
    }
  } catch (error) {
    console.error("Error al actualizar el token de Calendar:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Para el sistema web
router.post("/refresh-tokens", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "No refresh token provided" });
  }
  try {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID, 
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    res.json(credentials);
  } catch (error) {
    console.error("Error refreshing tokens:", error.message);
    res.status(500).json({ error: "Error refreshing tokens" });
  }
});

/**
 * Ruta: GET /detalle-cita
 * Obtiene el detalle de la cita pendiente para un estudiante.
 * Si la cita es presencial, también incluye la indicación basada en la sede del psicólogo.
 */
router.get("/detalle-cita", async (req, res) => {
  const { estudianteId } = req.query;
  if (!estudianteId) {
    return res.status(400).json({ error: "El estudianteId es requerido" });
  }
  try {
    // Buscar la cita pendiente del estudiante e incluir los datos del psicólogo
    const cita = await prisma.cita.findFirst({
      where: {
        estudianteId: parseInt(estudianteId, 10),
        estado: "pendiente"
      },
      include: {
        psicologo: true,
      }
    });
    if (!cita) {
      return res.status(404).json({ error: "No hay cita pendiente" });
    }

    // Si la cita es presencial, se obtiene la indicación según la sede del psicólogo
    let indicacion = null;
    if (cita.tipo === "presencial" && cita.psicologo && cita.psicologo.sede) {
      const resultado = await prisma.indicacion.findUnique({
        where: { sede: cita.psicologo.sede }
      });
      if (resultado) {
        indicacion = resultado.mensaje;
      }
    }
    res.json({ cita, indicacion });
  } catch (error) {
    console.error("Error al obtener detalle de cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Ruta para cancelar la cita
// Ruta: PUT /cancelar-cita
router.put("/cancelar-cita", async (req, res) => {
  const { citaId } = req.body;
  if (!citaId) {
    return res.status(400).json({ error: "El citaId es requerido" });
  }
  try {
    const updatedCita = await prisma.cita.update({
      where: { id: parseInt(citaId, 10) },
      data: { estado: "cancelada" },
    });
    // Si la cita tenía un evento en Calendar, eliminarlo usando calendarEventId
    if (updatedCita.calendarEventId) {
      const psicologo = await prisma.psicologo.findUnique({ where: { id: updatedCita.psicologoId } });
      const tokenToUse = psicologo?.calendarAccessToken;
      if (tokenToUse) {
        await deleteCalendarEvent(tokenToUse, updatedCita.calendarEventId);
      }
    }
    res.json({ message: "Cita cancelada", cita: updatedCita });
  } catch (error) {
    console.error("Error al cancelar la cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Ruta: PUT /reprogramar-cita
router.put("/reprogramar-cita", async (req, res) => {
  const { citaId } = req.body;
  if (!citaId) {
    return res.status(400).json({ error: "El citaId es requerido" });
  }
  try {
    const updatedCita = await prisma.cita.update({
      where: { id: parseInt(citaId, 10) },
      data: { estado: "reprogramada" },
    });
    // Eliminar el evento en Calendar de la cita original para liberar el horario
    if (updatedCita.calendarEventId) {
      const psicologo = await prisma.psicologo.findUnique({ where: { id: updatedCita.psicologoId } });
      const tokenToUse = psicologo?.calendarAccessToken;
      if (tokenToUse) {
        await deleteCalendarEvent(tokenToUse, updatedCita.calendarEventId);
      }
    }
    res.json({ message: "Cita marcada como reprogramada", cita: updatedCita });
  } catch (error) {
    console.error("Error al reprogramar la cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /reprogramar-cita-crear
router.post("/reprogramar-cita-crear", async (req, res) => {
  const { citaPreviaId, estudianteId, psicologoId, motivo, fecha, hora, modalidad } = req.body;
  try {
    // Buscar estudiante y psicólogo en la BD
    const estudiante = await prisma.estudiante.findUnique({ where: { id: estudianteId } });
    const psicologo = await prisma.psicologo.findFirst({ where: { id: psicologoId } });
    if (!estudiante || !psicologo) {
      return res.status(404).json({ error: "Estudiante o psicólogo no encontrado." });
    }

    // Validar la fecha
    const fechaDate = new Date(`${fecha}T00:00:00-05:00`);
    if (isNaN(fechaDate.getTime())) {
      return res.status(400).json({ error: "Fecha inválida. Debe estar en formato YYYY-MM-DD." });
    }
    
    // Limitar la reserva a 15 días a partir de hoy
    const hoy = new Date();
    const maxFecha = new Date();
    maxFecha.setDate(hoy.getDate() + 15);
    if (fechaDate > maxFecha) {
      return res.status(400).json({ error: "Solo se puede reservar una cita hasta 15 días a partir de hoy." });
    }
    
    // Validar el formato de hora (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ error: "Hora inválida. Debe estar en formato HH:mm." });
    }
    
    // Validar que la reserva se haga con 48 horas de anticipación
    const hoyLima = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
    const minReservaDate = new Date(hoyLima.getFullYear(), hoyLima.getMonth(), hoyLima.getDate() + 2);
    if (fechaDate < minReservaDate) {
      const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const diaDisponible = dias[minReservaDate.getDay()];
      return res.status(400).json({ error: `Para reservar una cita debe ser con al menos dos días de anticipación, puede reservar su cita a partir del día ${diaDisponible}.` });
    }
    
    // Verificar que el horario no esté ya reservado para ese psicólogo
    const citaExistente = await prisma.cita.findFirst({
      where: { psicologoId, fecha: fechaDate, hora }
    });
    if (citaExistente) {
      return res.status(400).json({ error: "El horario ya está reservado." });
    }
    
    // Determinar tipo de cita (virtual o presencial)
    const tipo = modalidad.toLowerCase() === "virtual" ? "virtual" : "presencial";
    
    // Crear la nueva cita en la BD, asignando citaPreviaId
    let cita = await prisma.cita.create({
      data: {
        estudianteId,
        psicologoId,
        motivo,
        fecha: fechaDate,
        hora,
        tipo,
        estado: "pendiente",
        citaPreviaId: citaPreviaId, // Vincula con la cita original
      },
    });
    
    // Usar el token para crear el evento en Google Calendar
    let tokenToUse = psicologo.calendarAccessToken || estudiante.calendarAccessToken;
    if (tokenToUse) {
      const startDateTimeLocal = `${fecha}T${hora}:00`;
      const [hourPart, minutePart] = hora.split(":");
      const endHour = (parseInt(hourPart, 10) + 1).toString().padStart(2, "0");
      const endDateTimeLocal = `${fecha}T${endHour}:${minutePart}:00`;
      
      const isVirtual = modalidad.toLowerCase() === "virtual";
      
      // Crear el evento en Calendar
      const eventResult = await createCalendarEvent(
        tokenToUse,
        "Cita de Psicología",
        motivo,
        startDateTimeLocal,
        endDateTimeLocal,
        [psicologo.correo, estudiante.correo],
        isVirtual
      );
      
      // Actualizar la cita con el meetLink si es virtual
      if (isVirtual && eventResult) {
        cita = await prisma.cita.update({
          where: { id: cita.id },
          data: {
            meetLink: eventResult.meetLink,
            calendarEventId: eventResult.eventId,
          },
        });
      } else if (!isVirtual) {
        cita = await prisma.cita.update({
          where: { id: cita.id },
          data: {
            meetLink: null,
            calendarEventId: eventResult.eventId,
          },
        });
      }      
    }
    
    res.json({ message: "Cita reprogramada creada correctamente", cita });
  } catch (error) {
    console.error("Error al reprogramar cita:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /cancelar-reprogramacion
router.put("/cancelar-reprogramacion", async (req, res) => {
  const { citaId } = req.body;
  if (!citaId) {
    return res.status(400).json({ error: "El citaId es requerido" });
  }
  try {
    const updatedCita = await prisma.cita.update({
      where: { id: parseInt(citaId, 10) },
      data: { estado: "pendiente" },
    });
    res.json({ message: "Reprogramación cancelada, estado revertido", cita: updatedCita });
  } catch (error) {
    console.error("Error al cancelar la reprogramación:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// En tu archivo de rutas (por ejemplo, auth.js)
router.get("/historial-citas", async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "El userId es requerido" });
  }
  try {
    let citas = await prisma.cita.findMany({
      where: { estudianteId: parseInt(userId, 10) },
      orderBy: { fecha: 'desc' },
      include: {
        // Incluimos la información del psicólogo.
        psicologo: true,
      },
    });

    // Para cada cita presencial, obtener la indicación correspondiente.
    citas = await Promise.all(citas.map(async (cita) => {
      if (cita.tipo === "presencial" && cita.psicologo && cita.psicologo.sede) {
        const indicacionObj = await prisma.indicacion.findUnique({
          where: { sede: cita.psicologo.sede }
        });
        cita.indicacion = indicacionObj ? indicacionObj.mensaje : null;
      }
      return cita;
    }));

    res.json({ citas });
  } catch (error) {
    console.error("Error al obtener historial de citas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/recomendaciones-citas", async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "El userId es requerido" });
  }
  try {
    const citas = await prisma.cita.findMany({
      where: {
        estudianteId: parseInt(userId, 10),
        atencionCita: { isNot: null },
      },
      orderBy: { fecha: 'desc' },
      include: {
        psicologo: true,
        atencionCita: true,
      },
    });

    // Mapeamos para devolver solo los campos necesarios y dejamos las recomendaciones tal cual
    const result = citas.map(cita => ({
      fecha: cita.fecha,
      psicologo: cita.psicologo,
      recomendacion: cita.atencionCita?.recomendaciones || ""
    }));

    res.json({ citas: result });
  } catch (error) {
    console.error("Error al obtener recomendaciones de citas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Nueva ruta: GET /cita-evaluacion
router.get("/cita-evaluacion", async (req, res) => {
  const { estudianteId } = req.query;
  if (!estudianteId) {
    return res.status(400).json({ error: "El estudianteId es requerido" });
  }
  try {
    // Buscar la cita que ha sido atendida y que aún no tiene encuesta asociada.
    const cita = await prisma.cita.findFirst({
      where: {
        estudianteId: parseInt(estudianteId, 10),
        estado: "atendida",
        // La relación inversa 'encuesta' se definió en el esquema.
        encuesta: null,
      },
      orderBy: { fecha: 'desc' } // Por ejemplo, se toma la más reciente
    });
    res.json({ cita });
  } catch (error) {
    console.error("Error al obtener cita para evaluación:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Nueva ruta: POST /guardar-encuesta
router.post("/guardar-encuesta", async (req, res) => {
  const { citaId, pregunta1, pregunta2, pregunta3, comentarios } = req.body;
  if (!citaId || !pregunta1 || !pregunta2 || !pregunta3) {
    return res.status(400).json({ error: "Todos los campos obligatorios deben ser proporcionados" });
  }
  try {
    // Crea la encuesta asociada a la cita
    const encuesta = await prisma.encuesta.create({
      data: {
        cita: { connect: { id: citaId } },
        pregunta1,
        pregunta2,
        pregunta3,
        comentarios,
      },
    });
    res.json({ message: "Encuesta guardada correctamente", encuesta });
  } catch (error) {
    console.error("Error al guardar la encuesta:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
