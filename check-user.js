const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({ 
  where: { email: 'bkv@vpa.pt' },
  select: { email: true, password: true, role: true }
}).then(user => {
  console.log('User:', user);
  prisma.$disconnect();
});
