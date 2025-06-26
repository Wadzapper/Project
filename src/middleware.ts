import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Initialize NextAuth with the configuration that includes the `authorized` callback
const { auth: middleware } = NextAuth(authConfig);

export default middleware;

// Optionally, specify which paths should be protected by the middleware
export const config = {
  // Matcher ignoring `/_next/static`, `/_next/image`, api routes, and favicon.ico
  // Adjust as necessary for your application's routes.
  matcher: [
    '/dashboard/:path*', // Protect dashboard and its sub-routes
    '/settings/:path*',  // Example: protect settings pages
    // Add other paths you want to protect
    // Exclude auth pages, public static assets, and API routes used for auth
    // The `authorized` callback in `auth.config.ts` handles the logic for
    // redirecting to login or allowing access.
    // This matcher just defines WHICH routes run through the `authorized` callback.
    // It's important not to match /login, /register, /api/auth, etc., in a way that creates redirect loops.
    // The authorized callback itself handles this.

    // A common pattern is to protect all routes except explicitly public ones:
    // '/((?!api|_next/static|_next/image|favicon.ico|login|register|img).*)',
    // However, for now, let's be explicit with protected routes.
  ],
};
