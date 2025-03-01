-- CreateTable
CREATE TABLE `Indicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sede` VARCHAR(191) NOT NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Indicacion_sede_key`(`sede`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
