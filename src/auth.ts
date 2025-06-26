import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db'; // Assuming db.ts is in src/lib/
import { authConfig } from '@/lib/auth.config'; // Assuming auth.config.ts is in src/lib/

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig, // Spread the base config
  adapter: PrismaAdapter(prisma),
  // If you have specific session configurations that need the adapter,
  // ensure they are compatible or handled correctly here.
  // The session strategy is already defined in authConfig.
  // Callbacks from authConfig are automatically included.
});
