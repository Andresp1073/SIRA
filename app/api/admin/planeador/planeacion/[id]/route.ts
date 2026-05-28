import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const planning = await db.planning.findUnique({
      where: { id },
      select: {
        groupId: true,
        weeks: { select: { id: true } },
      },
    });

    if (planning) {
      const weekIds = planning.weeks.map(w => w.id);

      await db.class.deleteMany({
        where: {
          OR: [{ groupId: planning.groupId }, { weekId: { in: weekIds } }],
        },
      });
    }

    await db.planning.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
