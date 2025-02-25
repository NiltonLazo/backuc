/*
  Warnings:

  - The values [SALUD_MENTAL,TRABAJO_SOCIAL,OTRO] on the enum `AtencionCita_areaDerivacion` will be removed. If these variants are still used in the database, this will fail.
  - The values [ANSIEDAD,DEPRESION,OTRO] on the enum `AtencionCita_diagnosticoPresuntivo` will be removed. If these variants are still used in the database, this will fail.
  - The values [PRESENCIAL,VIRTUAL,TELEFONICO] on the enum `AtencionCita_medioContacto` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `AtencionCita` MODIFY `areaDerivacion` ENUM('tutoria', 'mentoria', 'topico', 'personal', 'CAS', 'defensoria_universitaria', 'vinculacion_internacional', 'docente', 'protocolo_de_salud_mental', 'servicio_social') NULL,
    MODIFY `diagnosticoPresuntivo` ENUM('familiar', 'academico', 'agresivo_pasivo', 'ansiedad', 'antisocial', 'autoestima') NULL,
    MODIFY `medioContacto` ENUM('boca_a_boca', 'protocolo_de_salud_mental', 'entrevistas_de_vinculacion', 'correo_electronico', 'talleres_preventivos', 'citas_automatizadas', 'onboarding', 'app_movil') NULL;
