import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Cleaning database...');

  await prisma.teacherSubject.deleteMany();
  await prisma.studentEnrollment.deleteMany();
  await prisma.teacherGroup.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.logbook.deleteMany();
  await prisma.class.deleteMany();
  await prisma.academicWeek.deleteMany();
  await prisma.planning.deleteMany();
  await prisma.group.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.report.deleteMany();
  await prisma.unenrollRequest.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.academicPeriod.deleteMany();
  await prisma.specialRange.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.periodWeek.deleteMany();
  await prisma.bitacoraSettings.deleteMany();

  const password = await hash('Admin123', 12);

  await prisma.user.create({
    data: {
      name: 'Administrador',
      document: 'ADMIN001',
      institutionalEmail: 'admin@fup.edu.co',
      personalEmail: 'admin@fup.edu.co',
      password,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log('\n✅ Seed completado');
  console.log('   Admin: admin@fup.edu.co / Admin123');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
