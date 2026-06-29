import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await db.user.upsert({
    where: { email: "admin@softop.la" },
    update: {},
    create: {
      email: "admin@softop.la",
      name: "Administrador",
      password: passwordHash,
      role: "ADMIN",
    },
  });

  await db.user.upsert({
    where: { email: "auditor@softop.la" },
    update: {},
    create: {
      email: "auditor@softop.la",
      name: "Auditor Demo",
      password: await bcrypt.hash("auditor123", 10),
      role: "AUDITOR",
    },
  });

  const opticas = [
    { nombre: "Óptica Medica", grupo: "Cali", codigoInterno: "14676420" },
    { nombre: "Óptica Popular", grupo: "Cali", codigoInterno: "16656747" },
    { nombre: "Vista Óptica", grupo: "Cali", codigoInterno: "1144071842" },
  ];

  for (const o of opticas) {
    await db.optica.upsert({
      where: { nombre: o.nombre },
      update: { codigoInterno: o.codigoInterno },
      create: o,
    });
  }

  console.log("Seed completado: 2 usuarios, 3 ópticas.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
