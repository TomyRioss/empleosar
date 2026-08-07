import { PrismaClient, JobSource } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.keyword.createMany({
    data: [
      { term: "gastronomia" },
      { term: "cocinero" },
      { term: "chef" },
      { term: "ayudante de cocina" },
      { term: "mozo" },
      { term: "camarero" },
      { term: "mesero" },
      { term: "bartender" },
      { term: "barista" },
      { term: "panadero" },
      { term: "repostero" },
      { term: "delivery" },
      { term: "encargado de local gastronomico" },
      { term: "atencion al cliente" },
      { term: "call center" },
      { term: "telemarketer" },
      { term: "telemarketing" },
      { term: "ventas" },
      { term: "vendedor" },
      { term: "representante comercial" },
      { term: "promotor" },
      { term: "recepcionista" },
      { term: "cajero" },
      { term: "administrativo" },
      { term: "secretaria" },
      { term: "data entry" },
      { term: "facturista" },
      { term: "auxiliar contable" },
      { term: "contador" },
      { term: "recursos humanos" },
      { term: "asistente de gerencia" },
      { term: "desarrollador react" },
      { term: "developer" },
      { term: "programador" },
      { term: "analista de sistemas" },
      { term: "soporte tecnico" },
      { term: "it" },
      { term: "frontend" },
      { term: "backend" },
      { term: "fullstack" },
      { term: "qa" },
      { term: "diseñador ux" },
      { term: "devops" },
      { term: "data analyst" },
      { term: "operario" },
      { term: "almacen" },
      { term: "deposito" },
      { term: "logistica" },
      { term: "repartidor" },
      { term: "cadete" },
      { term: "chofer" },
      { term: "flete" },
      { term: "distribucion" },
      { term: "picking" },
      { term: "packing" },
      { term: "enfermero" },
      { term: "medico" },
      { term: "odontologo" },
      { term: "kinesiologo" },
      { term: "farmaceutico" },
      { term: "auxiliar de enfermeria" },
      { term: "cuidador" },
      { term: "recepcionista clinica" },
      { term: "albañil" },
      { term: "pintor" },
      { term: "electricista" },
      { term: "plomero" },
      { term: "herrero" },
      { term: "carpintero" },
      { term: "mantenimiento" },
      { term: "jardinero" },
      { term: "limpieza" },
      { term: "mucama" },
      { term: "empleada domestica" },
      { term: "seguridad" },
      { term: "vigilante" },
      { term: "niñera" },
      { term: "peluquero" },
      { term: "esteticista" },
      { term: "masajista" },
      { term: "profesor" },
      { term: "traductor" },
      { term: "community manager" },
      { term: "fotografo" },
    ],
    skipDuplicates: true,
  });

  const reactKeyword = await prisma.keyword.findUnique({ where: { term: "desarrollador react" } });
  const adminKeyword = await prisma.keyword.findUnique({ where: { term: "administrativo" } });

  if (reactKeyword) {
    await prisma.job.upsert({
      where: { source_externalId: { source: JobSource.REDDIT, externalId: "seed-reddit-1" } },
      create: {
        source: JobSource.REDDIT,
        externalId: "seed-reddit-1",
        title: "Se busca dev React jr",
        company: "Startup AR",
        url: "https://reddit.com/r/empleos/example1",
        location: "CABA",
        postedAt: new Date(),
        keywords: { create: { keywordId: reactKeyword.id } },
      },
      update: {},
    });
  }

  if (adminKeyword) {
    await prisma.job.upsert({
      where: { source_externalId: { source: JobSource.COMPUTRABAJO, externalId: "seed-ct-1" } },
      create: {
        source: JobSource.COMPUTRABAJO,
        externalId: "seed-ct-1",
        title: "Administrativo contable",
        company: "Empresa SA",
        url: "https://computrabajo.com.ar/example2",
        location: "Cordoba",
        postedAt: new Date(),
        keywords: { create: { keywordId: adminKeyword.id } },
      },
      update: {},
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
