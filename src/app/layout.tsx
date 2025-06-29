// src/app/layout.tsx
import React from 'react';
import './globals.css'; // Assuming a global stylesheet, will create a placeholder

export const metadata = {
  title: 'My Gamified Life OS',
  description: 'Manage your skills, quests, and life goals!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Basic structure, can be enhanced with navbars, sidebars etc. later */}
        <main>{children}</main>
      </body>
    </html>
  );
}
