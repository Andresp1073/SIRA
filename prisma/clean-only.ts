import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('🧹 Limpiando base de datos...\n');

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

  console.log('✅ Base de datos limpia');
}

cleanDatabase()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
