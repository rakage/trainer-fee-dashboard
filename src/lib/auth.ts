import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { User, UserRole } from '@/types';
import { UserService } from './sqlite';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await UserService.verifyCredentials(credentials.email, credentials.password);
          
          if (!user) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        // Handle Google OAuth user creation/update
        try {
          const existingUser = UserService.findByEmail(user.email!);
          if (!existingUser) {
            // Create new user with default viewer role
            const newUser = await UserService.createUser({
              email: user.email!,
              name: user.name!,
              role: 'viewer', // Default role
              provider: 'google',
            });
            user.role = newUser.role;
          } else {
            user.role = existingUser.role;
          }
          return true;
        } catch (error) {
          console.error('Google sign-in error:', error);
          return false;
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};


// Role-based authorization helpers
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

export function canAccessResource(userRole: UserRole, resource: string): boolean {
  const rolePermissions = {
    admin: ['read', 'write', 'export', 'delete'],
    finance: ['read', 'export', 'edit_splits'],
    trainer: ['read', 'export_own', 'edit_own_splits'],
    viewer: ['read'],
  };

  const permissions = rolePermissions[userRole] || [];
  
  switch (resource) {
    case 'export':
      return permissions.includes('export') || permissions.includes('export_own');
    case 'edit_splits':
      return permissions.includes('edit_splits') || permissions.includes('edit_own_splits');
    case 'delete':
      return permissions.includes('delete');
    default:
      return permissions.includes('read');
  }
}
