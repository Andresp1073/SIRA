'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg rounded-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-destructive/10 p-3 rounded-full">
              <ShieldX className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-xl">Acceso no autorizado</CardTitle>
          <CardDescription className="text-sm">
            No tienes permisos para acceder a esta página.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-4">
          <Button
            variant="default"
            className="rounded-xl w-full"
            onClick={() => (window.location.href = '/login')}
          >
            Ir al inicio de sesión
          </Button>
          <Button
            variant="outline"
            className="rounded-xl w-full"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
