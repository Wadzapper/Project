'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navigationItems = [
  { name: 'Overview', href: '/analytics', icon: '📊' }, // Assuming /analytics is the overview
  { name: 'Skills', href: '/analytics/skills', icon: '🧠' },
  { name: 'Quests', href: '/analytics/quests', icon: '🎯' },
  { name: 'Habits', href: '/analytics/habits', icon: '🔁' },
  { name: 'Ratings', href: '/analytics/ratings', icon: '📅' },
  { name: 'Journal', href: '/analytics/journal', icon: '📓' },
];

export default function AnalyticsNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <div className="sticky top-16 z-30 md:hidden bg-gray-100 dark:bg-gray-800 p-2 shadow">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex items-center px-3 py-2 border rounded text-gray-500 border-gray-600 hover:text-gray-900 hover:border-gray-900 dark:text-gray-400 dark:hover:text-white dark:hover:border-white"
          aria-expanded={isMobileMenuOpen}
          aria-controls="analytics-mobile-nav"
        >
          <svg className="fill-current h-3 w-3 mr-2" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><title>Menu</title><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"/></svg>
          Menu
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        id="analytics-mobile-nav"
        className={`fixed top-16 left-0 z-20 w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:translate-x-0 md:sticky md:h-[calc(100vh-4rem)] md:top-16 md:flex-shrink-0`}
        aria-label="Analytics Navigation"
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Analytics Sections</h2>
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || (item.href === '/analytics' && pathname === '/analytics/overview');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)} // Close mobile menu on click
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md group
                              ${ isActive
                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-50'
                              }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="mr-3 w-6 text-center">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
