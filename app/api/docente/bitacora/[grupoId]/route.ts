import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ grupoId: string }> }) {
  const { grupoId: groupId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'DOCENTE') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const group = await db.group.findFirst({
      where: {
        id: groupId,
        teachers: { some: { teacherId: session.user.id } },
      },
      include: {
        subject: { select: { name: true, code: true } },
        schedule: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        room: { select: { name: true } },
        teachers: { include: { teacher: { select: { name: true, institutionalEmail: true } } } },
        _count: { select: { students: true } },
        planning: {
          include: {
            weeks: {
              include: {
                classes: {
                  include: { logbook: true },
                  orderBy: { date: 'asc' },
                },
              },
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    });
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado o no autorizado' }, { status: 404 });
    const { _count, ...groupData } = group;
    return NextResponse.json({ ...groupData, studentCount: _count.students, studentIds: [] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
