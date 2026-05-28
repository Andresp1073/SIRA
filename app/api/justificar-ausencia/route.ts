import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const justificationSchema = z.object({
  classId: z.string().min(1, 'ID de clase es requerido'),
  studentId: z.string().min(1, 'ID de estudiante es requerido'),
  reason: z.string().min(10, 'La justificación debe tener al menos 10 caracteres'),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = justificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: 'Datos inválidos', errors: validation.error.issues },
        { status: 400 }
      );
    }

    const { classId, studentId, reason } = validation.data;

    const userRole = session.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'DOCENTE' && session.user?.id !== studentId) {
      return NextResponse.json(
        { message: 'No tienes permiso para justificar ausencias de otro estudiante' },
        { status: 403 }
      );
    }

    const classInfo = await db.class.findUnique({
      where: { id: classId },
      include: {
        subject: {
          select: {
            students: { select: { studentId: true } },
          },
        },
      },
    });

    if (!classInfo) {
      return NextResponse.json({ message: 'Clase no encontrada' }, { status: 404 });
    }

    if (!classInfo.subject.students.some(s => s.studentId === studentId)) {
      return NextResponse.json(
        { message: 'Estudiante no matriculado en esta materia' },
        { status: 403 }
      );
    }

    const now = new Date();
    const classStartTime = classInfo.startTime || classInfo.date;
    const classEndTime =
      classInfo.endTime || new Date(classStartTime.getTime() + 2 * 60 * 60 * 1000);

    if (now < classStartTime) {
      return NextResponse.json({ message: 'La clase aún no ha comenzado' }, { status: 400 });
    }

    await db.attendance.upsert({
      where: {
        studentId_classId: {
          studentId,
          classId,
        },
      },
      update: {
        status: 'JUSTIFIED' as any,
        justification: reason,
      },
      create: {
        studentId,
        classId,
        status: 'JUSTIFIED' as any,
        justification: reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Ausencia justificada correctamente',
    });
  } catch (error) {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
