import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'DOCENTE') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const groups = await db.group.findMany({
      where: {
        teachers: { some: { teacherId: session.user.id  } },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        classes: {
          select: {
            id: true,
            date: true,
            startTime: true,
            topic: true,
            classroom: true,
            status: true,
            attendances: {
              select: {
                id: true,
                status: true,
              },
              take: 1,
            },
          },
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    const now = new Date();

    const processedSubjects = groups.map(group => {
      const totalClasses = group.classes.length;
      const completedClasses = group.classes.filter(
        cls => cls.status === 'SIGNED' || cls.status === 'CANCELLED'
      ).length;

      const upcomingClass = group.classes.find(
        cls => cls.status === 'SCHEDULED' && new Date(cls.date) >= now
      );

      const totalProgress = group.classes.reduce((sum, cls) => {
        const attendance = cls.attendances[0];
        return sum + (attendance?.status === 'PRESENT' ? 100 : 0);
      }, 0);
      const averageProgress = totalClasses > 0 ? totalProgress / totalClasses : 0;

      return {
        id: group.subject.id,
        groupId: group.id,
        name: group.subject.name,
        code: group.subject.code,
        groupCode: group.code,
        totalClasses,
        completedClasses,
        progress: averageProgress,
        nextClass: upcomingClass
          ? {
              id: upcomingClass.id,
              date: upcomingClass.date.toISOString(),
              startTime: upcomingClass.startTime?.toISOString() || null,
              topic: upcomingClass.topic || 'Sin tema definido',
              classroom: upcomingClass.classroom || null,
            }
          : undefined,
      };
    });

    const upcomingClasses = groups
      .flatMap(group =>
        group.classes
          .filter(cls => {
            const classDate = new Date(cls.date);
            return classDate >= now && cls.status === 'SCHEDULED';
          })
          .map(cls => ({
            id: cls.id,
            groupId: group.id,
            subjectId: group.subject.id,
            subjectName: group.subject.name,
            subjectCode: group.subject.code,
            date: cls.date.toISOString(),
            startTime: cls.startTime?.toISOString() || null,
            topic: cls.topic || 'Sin tema definido',
            classroom: cls.classroom || null,
          }))
      )
      .sort(
        (a: { date: string }, b: { date: string }) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      .slice(0, 3);

    const lowProgressClasses = groups
      .flatMap(group =>
        group.classes
          .filter(cls => {
            const attendance = cls.attendances[0];
            const progress = attendance?.status === 'PRESENT' ? 100 : 0;
            return progress < 50;
          })
          .map(cls => ({
            id: cls.id,
            groupId: group.id,
            subjectId: group.subject.id,
            subjectName: group.subject.name,
            subjectCode: group.subject.code,
            date: cls.date.toISOString(),
            startTime: cls.startTime?.toISOString() || null,
            topic: cls.topic || 'Sin tema definido',
            progress: cls.attendances[0]?.status === 'PRESENT' ? 100 : 0,
          }))
      )
      .sort(
        (a: { date: string }, b: { date: string }) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      .slice(0, 3);

    const response = {
      subjects: processedSubjects,
      lowProgressClasses,
      upcomingClasses,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
