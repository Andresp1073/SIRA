import { authOptions } from '@/lib/auth';
import { db } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

type SubjectResponse = {
  id: string;
  name: string;
  code: string;
  teacher: string;
  nextClass: {
    name: string;
    date: string;
    timeUntil: string;
    topic: string | null;
  } | null;
  attendancePercentage: number;
  totalClasses: number;
  attendedClasses: number;
};

type CardsResponse = {
  totalClasses: number;
  attendedClasses: number;
  globalAttendancePercentage: number;
  subjectsAtRisk: number;
  weeklyAttendanceAverage: number;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const now = new Date();

    let globalTotalClasses = 0;
    let globalAttendedClasses = 0;
    let subjectsAtRisk = 0;

    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    let weeklyTotalClasses = 0;
    let weeklyAttendedClasses = 0;

    const groupsWithStudent = await db.group.findMany({
      where: { students: { some: { studentId: session.user.id  } } },
      include: {
        subject: {
          include: {
            teachers: {
              include: {
                teacher: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const subjectsMap = new Map();
    groupsWithStudent.forEach(g => {
      if (!subjectsMap.has(g.subject.id)) {
        subjectsMap.set(g.subject.id, g.subject);
      }
    });
    const subjects = Array.from(subjectsMap.values());
    const subjectIds = subjects.map(s => s.id);

    const allClasses = await db.class.findMany({
      where: {
        subjectId: {
          in: subjectIds,
        },
        status: { in: ['SCHEDULED', 'COMPLETED', 'SIGNED'] as any },
      },
      select: {
        id: true,
        subjectId: true,
        date: true,
        topic: true,
        status: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    const allAttendances = await db.attendance.findMany({
      where: {
        studentId: session.user.id,
        class: {
          subjectId: {
            in: subjectIds,
          },
          status: { not: 'CANCELLED' as any },
        },
      },
      select: {
        id: true,
        status: true,
        class: {
          select: {
            id: true,
            subjectId: true,
            date: true,
            status: true,
          },
        },
      },
    });

    const weeklyClasses = await db.class.findMany({
      where: {
        subjectId: {
          in: subjectIds,
        },
        date: {
          gte: fourWeeksAgo,
          lte: now,
        },
        status: { in: ['SCHEDULED', 'COMPLETED', 'SIGNED'] as any },
      },
      select: {
        id: true,
        subjectId: true,
      },
    });

    const weeklyAttendances = await db.attendance.findMany({
      where: {
        studentId: session.user.id,
        class: {
          subjectId: {
            in: subjectIds,
          },
          date: {
            gte: fourWeeksAgo,
            lte: now,
          },
          status: { in: ['SCHEDULED', 'COMPLETED', 'SIGNED'] as any },
        },
      },
      select: {
        status: true,
      },
    });

    const nextClasses = await db.class.findMany({
      where: {
        subjectId: {
          in: subjectIds,
        },
        date: { gte: now },
        status: 'SCHEDULED',
      },
      select: {
        id: true,
        subjectId: true,
        date: true,
        startTime: true,
        topic: true,
        status: true,
      },
      orderBy: { date: 'asc' },
    });

    const classesBySubject = new Map<string, typeof allClasses>();
    allClasses.forEach(cls => {
      if (!classesBySubject.has(cls.subjectId)) {
        classesBySubject.set(cls.subjectId, []);
      }
      classesBySubject.get(cls.subjectId)!.push(cls);
    });

    const attendancesBySubject = new Map<string, typeof allAttendances>();
    allAttendances.forEach(att => {
      const subjectId = (att as any).class.subjectId;
      if (!attendancesBySubject.has(subjectId)) {
        attendancesBySubject.set(subjectId, []);
      }
      attendancesBySubject.get(subjectId)!.push(att);
    });

    const weeklyClassesBySubject = new Map<string, number>();
    weeklyClasses.forEach(cls => {
      weeklyClassesBySubject.set(
        cls.subjectId,
        (weeklyClassesBySubject.get(cls.subjectId) || 0) + 1
      );
    });

    const weeklyAttendedCount = weeklyAttendances.filter(
      att => att.status === 'PRESENT' || att.status === 'LATE'
    ).length;

    const nextClassesBySubject = new Map<string, (typeof nextClasses)[0]>();
    nextClasses.forEach(cls => {
      if (!nextClassesBySubject.has(cls.subjectId)) {
        nextClassesBySubject.set(cls.subjectId, cls);
      }
    });

    const processedSubjects: SubjectResponse[] = [];
    for (const subject of subjects) {
      const subjectClasses = classesBySubject.get(subject.id) || [];
      const subjectAttendances = attendancesBySubject.get(subject.id) || [];
      const nextClass = nextClassesBySubject.get(subject.id);
      const subjectWeeklyClasses = weeklyClassesBySubject.get(subject.id) || 0;

      const totalClasses = subjectClasses.length;

      const attendedClasses = subjectAttendances.filter(
        att => (att.status as string) === 'PRESENT' || (att.status as string) === 'LATE'
      ).length;

      let attendancePercentage = 0;
      if (totalClasses > 0) {
        attendancePercentage = Math.round((attendedClasses / totalClasses) * 100);
      }

      globalTotalClasses += totalClasses;
      globalAttendedClasses += attendedClasses;

      if (attendancePercentage < 70 && totalClasses > 0) {
        subjectsAtRisk++;
      }

      weeklyTotalClasses += subjectWeeklyClasses;

      let timeUntilNextClass = '';
      if (nextClass) {
        const timeDiff = new Date(nextClass.date).getTime() - now.getTime();
        const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));

        if (hoursDiff < 1) {
          const minutesDiff = Math.floor(timeDiff / (1000 * 60));
          timeUntilNextClass = `En ${minutesDiff} minutos`;
        } else if (hoursDiff < 24) {
          timeUntilNextClass = `En ${hoursDiff} horas`;
        } else {
          const daysDiff = Math.floor(hoursDiff / 24);
          timeUntilNextClass = `En ${daysDiff} días`;
        }
      }

      processedSubjects.push({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        teacher: subject.teachers[0]?.teacher?.name || 'Docente no asignado',
        nextClass: nextClass
          ? {
              name: `Clase de ${subject.name}`,
              date: nextClass.date.toISOString().split('T')[0],
              timeUntil: timeUntilNextClass,
              topic: nextClass.topic || null,
            }
          : null,
        attendancePercentage: attendancePercentage,
        totalClasses,
        attendedClasses,
      });
    }

    weeklyAttendedClasses = weeklyAttendedCount;
    weeklyTotalClasses = weeklyClasses.length;

    const globalAttendancePercentage =
      globalTotalClasses > 0 ? Math.round((globalAttendedClasses / globalTotalClasses) * 100) : 0;

    const weeklyAttendanceAverage =
      weeklyTotalClasses > 0 ? Math.round((weeklyAttendedClasses / weeklyTotalClasses) * 100) : 0;

    const cards: CardsResponse = {
      totalClasses: globalTotalClasses,
      attendedClasses: globalAttendedClasses,
      globalAttendancePercentage: globalAttendancePercentage,
      subjectsAtRisk: subjectsAtRisk,
      weeklyAttendanceAverage: weeklyAttendanceAverage,
    };

    const response = {
      cards,
      subjects: processedSubjects,
      upcomingItems: nextClasses.slice(0, 6).map(cls => ({
        id: cls.id,
        title: `Clase de ${subjects.find(s => s.id === cls.subjectId)?.name || 'Asignatura'}`,
        code: subjects.find(s => s.id === cls.subjectId)?.code || '',
        teacher: subjects.find(s => s.id === cls.subjectId)?.teachers[0]?.teacher?.name || 'Docente',
        date: cls.date.toISOString(),
        startTime: cls.startTime
          ? cls.startTime.toISOString().split('T')[1].substring(0, 5)
          : cls.date.toISOString().split('T')[1].substring(0, 5),
        description: cls.topic || 'Sesión programada',
        subjectName: subjects.find(s => s.id === cls.subjectId)?.name,
        type: 'INFO',
        isEvent: false,
      })),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      {
        error: 'Error al cargar los datos del dashboard',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
