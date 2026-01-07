const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetPassword() {
  const hash = await bcrypt.hash('admin123', 10);
  
  const updated = await prisma.user.update({
    where: { email: 'bkv@vpa.pt' },
    data: { password: hash }
  });
  
  console.log('Password reset for:', updated.email);
  console.log('New password: admin123');
  await prisma.$disconnect();
}
resetPassword().catch(console.error);
