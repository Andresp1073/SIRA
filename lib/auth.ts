import { db } from '@/lib/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// 🔧 Configuración según entorno
const isProduction = process.env.NODE_ENV === 'production';
let baseUrl = process.env.NEXTAUTH_URL || 'https://sira-fup.online';

if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
  baseUrl = `https://${baseUrl}`;
}

const useSecureCookies = baseUrl.startsWith('https://') || isProduction;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';

export const authOptions: NextAuthOptions = {
  debug: !isProduction,

  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Correo Electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findFirst({
          where: {
            OR: [{ personalEmail: credentials.email }, { institutionalEmail: credentials.email }],
          },
          select: {
            id: true,
            role: true,
            name: true,
            personalEmail: true,
            institutionalEmail: true,
            signatureUrl: true,
            teacherCode: true,
            studentCode: true,
            phone: true,
            document: true,
            isActive: true,
            mustChangePassword: true,
            password: true,
          },
        });

        if (!user || !user.password) return null;

        if (!user.isActive) return null;

        const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordCorrect) return null;

        const { password, ...userData } = user;

        return userData;
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const userData = {
          id: user.id,
          role: user.role,
          name: user.name,
          personalEmail: user.personalEmail,
          institutionalEmail: user.institutionalEmail,
          signatureUrl: user.signatureUrl,
          teacherCode: user.teacherCode,
          studentCode: user.studentCode,
          phone: user.phone,
          document: user.document,
          isActive: user.isActive,
          mustChangePassword: user.mustChangePassword,
        };

        return { ...token, ...userData };
      }

      if (trigger === 'update') {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            role: true,
            name: true,
            personalEmail: true,
            institutionalEmail: true,
            signatureUrl: true,
            teacherCode: true,
            studentCode: true,
            phone: true,
            document: true,
            isActive: true,
            mustChangePassword: true,
          },
        });

        if (dbUser) {
          return { ...token, ...dbUser };
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          role: token.role as Role,
          name: token.name as string,
          personalEmail: token.personalEmail as string,
          institutionalEmail: token.institutionalEmail as string,
          signatureUrl: token.signatureUrl as string | null,
          teacherCode: token.teacherCode as string | null,
          studentCode: token.studentCode as string | null,
          phone: token.phone as string | null,
          document: token.document as string | null,
          isActive: token.isActive as boolean,
          mustChangePassword: token.mustChangePassword as boolean,
        };
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
    signOut: '/login',
    verifyRequest: '/login',
    newUser: '/login',
  },

  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: isProduction ? '.sira-fup.online' : undefined,
      },
    },
  },

  theme: {
    colorScheme: 'light',
    logo: '/logo.png',
  },
};
