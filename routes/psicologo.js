const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

// =======================
// HELPERS DE CALENDAR Y SLOTS
// =======================

// Función para formatear la hora en formato de 24 horas (sin "a.m." o "p.m.")
// Si el resultado comienza con "24", lo reemplaza por "00"
function formatTime(date) {
  const options = {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  let timeString = date.toLocaleTimeString("en-US", options);
  const [hour, minute] = timeString.split(":");
  if (hour === "24") {
    timeString = "00:" + minute;
  }
  return timeString;
}

// Obtener eventos del Google Calendar usando OAuth2Client
async function getCalendarEvents(accessToken, fecha) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const timeMin = new Date(fecha);
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(fecha);
    timeMax.setHours(23, 59, 59, 999);
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    return response.data.items || [];
  } catch (error) {
    console.error("Error al obtener eventos de Calendar:", error.message);
    if (error.response && error.response.data) {
      console.error("Detalles del error:", error.response.data);
    }
    return [];
  }
}

// Crear evento en Google Calendar (con Meet si es virtual)
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
      return response.data.conferenceData &&
             response.data.conferenceData.entryPoints &&
             response.data.conferenceData.entryPoints.length > 0
             ? response.data.conferenceData.entryPoints[0].uri
             : null;
    } else {
      return response.data.id;
    }
  } catch (error) {
    console.error("Error al crear evento en Calendar:", error.message);
    if (error.response && error.response.data) {
      console.error("Detalles del error:", error.response.data);
    }
    return null;
  }
}

// Calcular intervalos libres descontando los eventos
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

// Subdividir un intervalo en slots de 60 minutos
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

// =======================
// RUTAS DEL SISTEMA WEB DEL PSICÓLOGO
// =======================

/**
 * GET /psicologo/citas?psicologoId=...&fecha=YYYY-MM-DD
 */
router.get('/citas', async (req, res) => {
  const { psicologoId, fecha } = req.query;
  if (!psicologoId || !fecha) {
    return res.status(400).json({ error: "Se requieren 'psicologoId' y 'fecha'" });
  }
  try {
    const targetDate = new Date(`${fecha}T00:00:00Z`);
    const citas = await prisma.cita.findMany({
      where: {
        psicologoId: parseInt(psicologoId, 10),
        fecha: targetDate,
      },
      include: { estudiante: true, atencionCita: true },
      orderBy: { hora: 'asc' },
    });
    res.json({ citas });
  } catch (error) {
    console.error("Error al obtener citas:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

/**
 * GET /psicologo/cita/:id
 */
router.get('/cita/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cita = await prisma.cita.findUnique({
      where: { id: parseInt(id, 10) },
      include: { estudiante: true, psicologo: true, atencionCita: true },
    });
    if (!cita) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }
    res.json({ cita });
  } catch (error) {
    console.error("Error al obtener el detalle de la cita:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

/**
 * PUT /psicologo/cita/:id
 */
router.put('/cita/:id', async (req, res) => {
  const { id } = req.params;
  console.log("Payload recibido en PUT /cita/:id:", req.body);
  
  const { estado, psicologoId, areaDerivacion, diagnosticoPresuntivo, medioContacto, recomendaciones, observaciones } = req.body;
  
  try {
    const updatedCita = await prisma.cita.update({
      where: { id: parseInt(id, 10) },
      data: { estado }
    });
    
    let atencionData = {};
    if (estado === 'atendida') {
      atencionData = {
        areaDerivacion,
        diagnosticoPresuntivo,
        medioContacto,
        recomendaciones,
        observaciones
      };
    } else if (estado === 'no_asistio') {
      atencionData = { observaciones };
    }
    
    const existingAtencion = await prisma.atencionCita.findUnique({
      where: { citaId: parseInt(id, 10) }
    });
    
    if (existingAtencion) {
      await prisma.atencionCita.update({
        where: { citaId: parseInt(id, 10) },
        data: atencionData
      });
    } else {
      await prisma.atencionCita.create({
        data: {
          cita: { connect: { id: parseInt(id, 10) } },
          ...atencionData,
        },
      });
    }
    
    const citaConAtencion = await prisma.cita.findUnique({
      where: { id: parseInt(id, 10) },
      include: { atencionCita: true }
    });
    console.log("Cita con AtencionCita:", citaConAtencion);
    res.json({ cita: citaConAtencion });
  } catch (error) {
    console.error("Error al actualizar la cita:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

/**
 * GET /psicologo/horarios-disponibles?fecha=YYYY-MM-DD&psicologoId=...
 */
router.get("/horarios-disponibles", async (req, res) => {
  const { fecha, psicologoId } = req.query;
  if (!fecha || !psicologoId) {
    return res.status(400).json({ error: "Se requieren 'fecha' y 'psicologoId'" });
  }
  try {
    const fechaConsulta = new Date(`${fecha}T00:00:00-05:00`);
    if (isNaN(fechaConsulta.getTime())) {
      return res.status(400).json({ error: "Fecha inválida. Usa el formato YYYY-MM-DD." });
    }
    
    // Rango completo del día: desde las 00:00 hasta el inicio del día siguiente
    const rangeStart = new Date(`${fecha}T00:00:00-05:00`);
    const rangeEnd = new Date(`${fecha}T00:00:00-05:00`);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    
    let calendarEvents = [];
    const psicologo = await prisma.psicologo.findUnique({
      where: { id: parseInt(psicologoId, 10) },
    });
    if (!psicologo) {
      return res.status(404).json({ error: "Psicólogo no encontrado." });
    }
    if (psicologo.calendarAccessToken) {
      calendarEvents = await getCalendarEvents(psicologo.calendarAccessToken, fecha);
    }
    
    let slotsTotal = [];
    const freeIntervals = computeFreeIntervals(rangeStart, rangeEnd, calendarEvents);
    for (const interval of freeIntervals) {
      const slots = subdivideInterval(interval, 60);
      const mappedSlots = slots.map(slot => {
        const formattedTime = formatTime(slot.start);
        return {
          id: `${psicologo.id}-${formattedTime}`,
          psicologoId: psicologo.id,
          nombrePsicologo: "Psicól. " + psicologo.nombre,
          hora: formattedTime,
        };
      });
      slotsTotal = slotsTotal.concat(mappedSlots);
    }
    
    const uniqueSlots = Array.from(new Map(slotsTotal.map(slot => [slot.id, slot])).values());
    console.log("Slots únicos:", uniqueSlots);
    res.json({ horarios: uniqueSlots });
  } catch (error) {
    console.error("Error al obtener horarios:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * POST /reservar-cita
 * Reserva una cita para un estudiante con un psicólogo. Si se envía el campo citaPreviaId,
 * se trata de una cita de seguimiento, forzando el motivo a "seguimiento". Además, se crea
 * el evento en Google Calendar según la modalidad (virtual genera Meet, presencial sólo evento).
 */
router.post("/reservar-cita", async (req, res) => {
  const { estudianteId, psicologoId, motivo, fecha, hora, modalidad, citaPreviaId } = req.body;
  try {
    const estudiante = await prisma.estudiante.findUnique({ where: { id: estudianteId } });
    const psicologo = await prisma.psicologo.findUnique({ where: { id: psicologoId } });
    if (!estudiante || !psicologo) {
      return res.status(404).json({ error: "Estudiante o psicólogo no encontrado." });
    }

    const fechaDate = new Date(`${fecha}T00:00:00-05:00`);
    if (isNaN(fechaDate.getTime())) {
      return res.status(400).json({ error: "Fecha inválida. Debe estar en formato YYYY-MM-DD." });
    }
    
    // Validar que la fecha no exceda los 15 días desde hoy
    const hoy = new Date();
    const maxFecha = new Date();
    maxFecha.setDate(hoy.getDate() + 15);
    if (fechaDate > maxFecha) {
      return res.status(400).json({ error: "Solo se puede reservar una cita hasta 15 días a partir de hoy." });
    }
    
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ error: "Hora inválida. Debe estar en formato HH:mm." });
    }
    
    const now = new Date();
    const minReservaFull = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const minReservaDate = new Date(minReservaFull.getFullYear(), minReservaFull.getMonth(), minReservaFull.getDate());
    if (fechaDate < minReservaDate) {
      const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const diaDisponible = dias[minReservaDate.getDay()];
      return res.status(400).json({ error: `Para reservar una cita debe ser con 48 horas de anticipación, puede reservar su cita a partir del día ${diaDisponible}.` });
    }
    
    const citaPendiente = await prisma.cita.findFirst({
      where: { estudianteId, estado: "pendiente" }
    });
    if (citaPendiente) {
      return res.status(400).json({ error: "Ya tienes una cita pendiente. No puedes reservar otra hasta que la actual sea confirmada." });
    }
    
    const citaExistente = await prisma.cita.findFirst({
      where: { psicologoId, fecha: fechaDate, hora }
    });
    if (citaExistente) {
      return res.status(400).json({ error: "El horario ya está reservado." });
    }
    
    const tipo = modalidad.toLowerCase() === "virtual" ? "virtual" : "presencial";
    const finalMotivo = citaPreviaId ? "seguimiento" : motivo;
    const data = {
      estudianteId,
      psicologoId,
      motivo: finalMotivo,
      fecha: fechaDate,
      hora,
      tipo,
      estado: "pendiente",
    };
    if (citaPreviaId) {
      data.citaPreviaId = citaPreviaId;
    }
    
    let cita = await prisma.cita.create({ data });
    
    // Crear evento en Google Calendar:
    const tokenToUse = psicologo.calendarAccessToken;
    if (tokenToUse) {
      const startDateTimeLocal = `${fecha}T${hora}:00`;
      const [hourPart, minutePart] = hora.split(":");
      const endHour = (parseInt(hourPart, 10) + 1).toString().padStart(2, "0");
      const endDateTimeLocal = `${fecha}T${endHour}:${minutePart}:00`;
      const isVirtual = modalidad.toLowerCase() === "virtual";
      // Se agregan los correos tanto del psicólogo como del estudiante
      const eventResult = await createCalendarEvent(
        tokenToUse,
        "Cita de Psicología",
        finalMotivo,
        startDateTimeLocal,
        endDateTimeLocal,
        [psicologo.correo, estudiante.correo],
        isVirtual
      );
      if (isVirtual && eventResult) {
        cita = await prisma.cita.update({
          where: { id: cita.id },
          data: { meetLink: eventResult },
        });
      } else if (!isVirtual) {
        cita = await prisma.cita.update({
          where: { id: cita.id },
          data: { meetLink: null },
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
 * GET /cita-pendiente?estudianteId=...
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
 * GET /update-calendar-token, POST /google-signin, PUT /update-profile, POST /asignar-horario, etc.
 * (Se mantienen sin cambios)
 */

module.exports = router;

