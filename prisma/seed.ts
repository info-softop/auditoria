import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

/** Lee una contraseña obligatoria desde el entorno; aborta si falta o es trivial. */
function requirePassword(envVar: string): string {
  const value = process.env[envVar];
  if (!value || value.trim().length < 8) {
    throw new Error(
      `Falta ${envVar} (o tiene menos de 8 caracteres). Define contraseñas fuertes ` +
        `antes de correr el seed, por ejemplo:\n` +
        `  SEED_ADMIN_PASSWORD='...' SEED_AUDITOR_PASSWORD='...' npm run db:seed`
    );
  }
  return value;
}

async function main() {
  // Sin contraseñas por defecto: se leen del entorno y, si faltan, el seed aborta.
  const adminPassword = requirePassword("SEED_ADMIN_PASSWORD");
  const auditorPassword = requirePassword("SEED_AUDITOR_PASSWORD");

  await db.user.upsert({
    where: { email: "admin@softop.la" },
    update: {},
    create: {
      email: "admin@softop.la",
      name: "Administrador",
      password: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });

  await db.user.upsert({
    where: { email: "auditor@softop.la" },
    update: {},
    create: {
      email: "auditor@softop.la",
      name: "Auditor Demo",
      password: await bcrypt.hash(auditorPassword, 10),
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
