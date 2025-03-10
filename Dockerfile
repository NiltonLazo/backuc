# Usa una imagen oficial de Node.js
FROM node:18

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de dependencias y la carpeta prisma
COPY package*.json ./
COPY prisma ./prisma

# Instala las dependencias (esto ejecuta el postinstall y ya encontrará prisma/schema.prisma)
RUN npm install

# Copia el resto del código al contenedor
COPY . .

# Expone el puerto 3000
EXPOSE 3000

# Comando para iniciar el servidor en modo desarrollo
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
