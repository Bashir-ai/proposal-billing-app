const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const user = await prisma.user.findUnique({ where: { email: 'bkv@vpa.pt' } });
  const isValid = await bcrypt.compare('admin123', user.password);
  console.log('Password test:', isValid ? 'SUCCESS' : 'FAILED');
  await prisma.$disconnect();
}
verify().catch(console.error);
