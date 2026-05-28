import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'DOCENTE') {
      return NextResponse.json(
        { message: 'No tienes permiso para realizar esta acción' },
        { status: 403 }
      );
    }

    const { studentId, subjectId, reason } = await request.json();

    if (!studentId || !subjectId || !reason) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    const subject = await db.subject.findFirst({
      where: {
        id: subjectId,
        teachers: { some: { teacherId: session.user.id  } },
      },
    });

    if (!subject) {
      return NextResponse.json(
        { message: 'Asignatura no encontrada o no tienes permiso para acceder a ella' },
        { status: 404 }
      );
    }

    const firstClass = await db.class.findFirst({
      where: { subjectId: subjectId },
      orderBy: { date: 'asc' },
    });

    if (firstClass) {
      const daysSinceStart =
        (new Date().getTime() - new Date(firstClass.date).getTime()) / (1000 * 3600 * 24);
      if (daysSinceStart > 12) {
        return NextResponse.json(
          { message: 'El periodo de desmatriculación (12 días desde el inicio) ha finalizado.' },
          { status: 400 }
        );
      }
    }

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true },
    });

    if (!student) {
      return NextResponse.json({ message: 'Estudiante no encontrado' }, { status: 404 });
    }

    const existingRequest = await (db as any).unenrollRequest.findFirst({
      where: {
        studentId,
        subjectId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { message: 'Ya existe una solicitud de desmatriculación pendiente para este estudiante' },
        { status: 400 }
      );
    }

    try {
      const unenrollRequest = await (db as any).unenrollRequest.create({
        data: {
          student: { connect: { id: studentId } },
          subject: { connect: { id: subjectId } },
          reason,
          requestedBy: { connect: { id: session.user.id } },
          status: 'PENDING',
        },
        include: {
          student: {
            select: { name: true, institutionalEmail: true },
          },
          requestedBy: {
            select: { name: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: unenrollRequest,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error al crear la solicitud de desmatriculación',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
