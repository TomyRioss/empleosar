import { PrismaClient, JobSource } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.keyword.createMany({
    data: [
      { term: "react" },
      { term: "administrativo" },
      { term: "atencion al cliente" },
    ],
    skipDuplicates: true,
  });

  await prisma.job.createMany({
    data: [
      {
        source: JobSource.REDDIT,
        externalId: "seed-reddit-1",
        title: "Se busca dev React jr",
        company: "Startup AR",
        url: "https://reddit.com/r/empleos/example1",
        location: "CABA",
        postedAt: new Date(),
        keywordMatched: "react",
      },
      {
        source: JobSource.COMPUTRABAJO,
        externalId: "seed-ct-1",
        title: "Administrativo contable",
        company: "Empresa SA",
        url: "https://computrabajo.com.ar/example2",
        location: "Cordoba",
        postedAt: new Date(),
        keywordMatched: "administrativo",
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
