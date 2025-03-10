const { PrismaClient, Estado, TipoCita, AreaDerivacionEnum, DiagnosticoPresuntivoEnum, MedioContactoEnum } = require('@prisma/client');
const { faker } = require('@faker-js/faker');

const prisma = new PrismaClient();

// Función para generar una fecha aleatoria en el último año
function randomPastDateWithinOneYear() {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return faker.date.between({ from: oneYearAgo, to: now });
}

// Función para generar una hora aleatoria en formato "HH:mm" entre las 08:00 y las 17:00
function randomHour() {
  const hour = faker.number.int({ min: 8, max: 17 });
  const minutes = faker.helpers.arrayElement(['00', '15', '30', '45']);
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
}

async function main() {
  // Obtenemos algunos estudiantes y psicólogos de la base de datos
  const estudiantes = await prisma.estudiante.findMany({ take: 5 });
  const psicologos = await prisma.psicologo.findMany({ take: 3 });

  if (estudiantes.length === 0 || psicologos.length === 0) {
    console.error("Necesitas tener al menos un Estudiante y un Psicólogo en la base de datos.");
    return;
  }

  const totalCitas = 300; // Número de citas que deseas generar

  for (let i = 0; i < totalCitas; i++) {
    let cita;
    let inserted = false;

    // Intentamos crear la cita hasta que se inserte sin colisión
    while (!inserted) {
      // Generamos datos aleatorios para la cita
      const estudiante = estudiantes[Math.floor(Math.random() * estudiantes.length)];
      const psicologo = psicologos[Math.floor(Math.random() * psicologos.length)];
      const randomFecha = randomPastDateWithinOneYear();
      const randomHora = randomHour();
      const randomEstado = faker.helpers.arrayElement([
        Estado.pendiente,
        Estado.atendida,
        Estado.no_asistio,
        Estado.cancelada,
        Estado.reprogramada
      ]);
      const randomTipoCita = faker.helpers.arrayElement([TipoCita.virtual, TipoCita.presencial]);

      try {
        // Crear la cita
        cita = await prisma.cita.create({
          data: {
            estudianteId: estudiante.id,
            psicologoId: psicologo.id,
            motivo: faker.lorem.sentence(),
            fecha: randomFecha,
            hora: randomHora,
            estado: randomEstado,
            tipo: randomTipoCita,
            meetLink: faker.internet.url()
          }
        });
        inserted = true;

        // Si la cita fue atendida, crear el registro de atención
        if (randomEstado === Estado.atendida) {
          await prisma.atencionCita.create({
            data: {
              citaId: cita.id,
              areaDerivacion: faker.helpers.arrayElement(Object.values(AreaDerivacionEnum)),
              diagnosticoPresuntivo: faker.helpers.arrayElement(Object.values(DiagnosticoPresuntivoEnum)),
              medioContacto: faker.helpers.arrayElement(Object.values(MedioContactoEnum)),
              recomendaciones: faker.lorem.paragraph(),
              observaciones: faker.lorem.sentence()
            }
          });
        }
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`Unique constraint failed for cita. Regenerando datos para la cita ${i + 1}...`);
          // Se vuelve a intentar generando nuevos datos
        } else {
          console.error(error);
          process.exit(1);
        }
      }
    }
  }

  console.log(`Se han creado ${totalCitas} citas aleatorias.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
