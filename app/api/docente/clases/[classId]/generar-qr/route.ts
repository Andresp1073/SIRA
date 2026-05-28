import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { GenerarQRResponseSchema } from './schema';

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== 'DOCENTE') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  if (!classId) {
    return NextResponse.json({ message: 'El ID de la clase es requerido' }, { status: 400 });
  }

  const classToUpdate = await db.class.findUnique({
    where: { id: classId },
    include: {
      subject: {
        select: {
          id: true,
          code: true,
          name: true,
          students: { select: { studentId: true } },
          teachers: { select: { teacherId: true } },
        },
      },
      group: {
        select: {
          id: true,
          students: { select: { studentId: true } },
          teachers: { select: { teacherId: true } },
        },
      },
    },
  });

  if (!classToUpdate) {
    return NextResponse.json({ message: 'Clase no encontrada' }, { status: 404 });
  }

  const isTeacher = 
    classToUpdate.subject?.teachers?.some(t => t.teacherId === session.user.id) || 
    classToUpdate.group?.teachers?.some(t => t.teacherId === session.user.id);

  if (!isTeacher) {
    return NextResponse.json(
      { message: 'No tienes permiso para generar el QR de esta clase' },
      { status: 403 }
    );
  }

  const generateSecureToken = (): string => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const token = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);

  try {
    await db.class.update({
      where: { id: classId },
      data: {
        qrToken: token,
        qrTokenExpiresAt: expiresAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Error al guardar el token QR en la base de datos' },
      { status: 500 }
    );
  }

  let baseUrl = process.env.NEXTAUTH_URL || 'https://sira-fup.online';
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  const qrUrl = `${baseUrl}/dashboard/estudiante/escanear/${token}`;

  if (token.length !== 32) {
    return NextResponse.json(
      {
        message: 'Error al generar el token QR: token inválido',
        error: 'INVALID_TOKEN_LENGTH',
        tokenLength: token.length,
        requiredLength: 32,
      },
      { status: 500 }
    );
  }

  const responseData = {
    qrUrl,
    qrToken: token,
    expiresAt: expiresAt.toISOString(),
  };

  const validation = GenerarQRResponseSchema.safeParse(responseData);

  if (!validation.success) {
    return NextResponse.json(
      {
        message: 'Error en el formato de la respuesta',
        error: 'VALIDATION_ERROR',
        details: validation.error.issues,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      data: validation.data,
      message: 'Token QR generado correctamente',
    },
    { status: 200 }
  );
}
