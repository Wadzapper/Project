import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db'; // Adjusted path assuming db.ts is in lib

export const authConfig = {
  pages: {
    signIn: '/login', // Custom login page
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials || !credentials.email || !credentials.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null; // User not found or no password hash (e.g. OAuth user)
        }

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);

        if (passwordsMatch) {
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        }

        return null; // Passwords don't match
      },
    }),
    // Add other providers like Google, GitHub here if needed later
  ],
  callbacks: {
    // jwt callback is called whenever a JWT is created or updated.
    // We can use it to add custom properties to the token.
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id; // Add user ID to the token
        // token.role = user.role; // Example: if you add a role to your User model
      }
      return token;
    },
    // session callback is called whenever a session is checked.
    // We can use it to add custom properties to the session object accessible on the client.
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      // if (session.user && token.role) {
      //   session.user.role = token.role as string; // Example
      // }
      return session;
    },
    // authorized callback is used to protect routes.
    // It's called before a request is handled by a protected route.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard'); // Example protected route prefix

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // If user is logged in and tries to access login/register, redirect to dashboard
        if (nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register')) {
          // Check if Response.redirect is available or use Next.js specific redirect
           try {
            return Response.redirect(new URL('/dashboard', nextUrl));
          } catch (e) {
            // Fallback or log error if Response.redirect is not available in this context
            console.error("Failed to redirect in authorized callback:", e);
            return true; // Or false depending on desired behavior without redirect
          }
        }
      }
      return true; // Allow access to other pages by default
    },
  },
  session: {
    strategy: 'jwt', // Using JWT for sessions
  },
  // secret: process.env.NEXTAUTH_SECRET, // Already read from .env by NextAuth
  // debug: process.env.NODE_ENV === 'development', // Optional: for debugging
} satisfies NextAuthConfig;
