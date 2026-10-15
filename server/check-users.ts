import { createRuntimePrismaClient } from './utils/sqlite-runtime';
const prisma = createRuntimePrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
