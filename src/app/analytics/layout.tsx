import AnalyticsNav from '@/components/analytics/AnalyticsNav';
import { ReactNode } from 'react';

export default function AnalyticsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-full"> {/* Use h-full if parent has defined height, or min-h-screen if it's a top-level layout part */}
      <AnalyticsNav />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/*
          The main Navbar is sticky (h-16, pt-16 on main content in RootLayout).
          AnalyticsNav is also sticky (top-16).
          The content area here needs to allow scrolling independently.
          The h-[calc(100vh-4rem)] on AnalyticsNav ensures it doesn't overflow viewport with main navbar.
          This main content area should also respect that height.
        */}
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
