import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { estudianteIds } = await req.json();

    // Replace all student assignments for this group
    await db.$transaction(async tx => {
      await tx.studentGroup.deleteMany({ where: { groupId: id } });
      if (estudianteIds.length > 0) {
        await tx.studentGroup.createMany({
          data: estudianteIds.map((studentId: string) => ({ studentId, groupId: id })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
