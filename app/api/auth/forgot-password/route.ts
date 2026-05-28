import { db } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { correo } = await request.json();

    if (!correo) {
      return NextResponse.json({ message: 'El correo electrónico es requerido' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        OR: [{ institutionalEmail: correo }, { personalEmail: correo }],
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          message:
            'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.',
        },
        { status: 200 }
      );
    }

    const resetToken = crypto.randomUUID();
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    return NextResponse.json(
      {
        message:
          'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Critical error in forgot-password POST:', error);
    return NextResponse.json(
      {
        message: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
