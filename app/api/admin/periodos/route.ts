import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { parseLocalDate } from '@/lib/date-utils';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periods = await db.academicPeriod.findMany({
      orderBy: { startDate: 'desc' },
    });
    return NextResponse.json({ periods });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const period = await db.academicPeriod.create({
      data: {
        name: body.name,
        startDate: parseLocalDate(body.startDate),
        endDate: parseLocalDate(body.endDate),
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json(period);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, startDate, endDate, isActive, yearId } = body;

    const period = await db.academicPeriod.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: parseLocalDate(startDate) }),
        ...(endDate && { endDate: parseLocalDate(endDate) }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(yearId !== undefined && { yearId }),
      },
    });

    return NextResponse.json(period);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
