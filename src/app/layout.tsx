import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import Navbar from '@/components/layout/Navbar';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast'; // Import Toaster

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Self-Improvement Platform',
  description: 'Track your skills, quests, and growth.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // SessionProvider needs to be outside html for next-themes to work correctly with html attributes
    // However, best practice for NextAuth.js v5 with App Router is to not rely on SessionProvider for server components.
    // We are using auth() in Navbar (server component). SessionProvider is for client components.
    // For this setup, SessionProvider can wrap the contents inside <body> or ThemeProvider can wrap SessionProvider.
    // Let's wrap ThemeProvider around SessionProvider and then children.
    <html lang="en" suppressHydrationWarning>
      {/*
        suppressHydrationWarning is often needed with next-themes
        if you're modifying the html tag's class or style directly.
      */}
      <body className={`${inter.className} bg-white dark:bg-gray-900 transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Animated Backgrounds Wrapper */}
          <div className="sunray-bg"></div>
          <div className="starfield-bg">
            <div className="stars-layer1"></div>
            <div className="stars-layer2"></div>
            <div className="stars-layer3"></div>
          </div>

          <SessionProvider>
            <Toaster position="top-center" reverseOrder={false} /> {/* Add Toaster here */}
            <Navbar />
            {/* Add relative and z-0 to main content if background is fixed and behind */}
            <main className="pt-16 relative z-0">
              {children}
            </main>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
