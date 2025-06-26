import Link from 'next/link';
import { auth } from '@/auth'; // Import the auth function from src/auth.ts
import { ThemeToggle } from './ThemeToggle';
import LogoutButton from '@/components/auth/LogoutButton';

export default async function Navbar() {
  const session = await auth(); // Get session on the server
  const user = session?.user;

  return (
    <nav className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              SelfImprove
            </Link>
            {user && (
              <div className="hidden ml-10 md:block">
                <div className="flex items-baseline space-x-4">
                  <Link
                    href="/dashboard"
                    className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/skills"
                    className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    My Skills
                  </Link>
                  <Link
                    href="/skill-trees"
                    className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    My Skill Trees
                  </Link>
                  <Link
                    href="/journal"
                    className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Journal
                  </Link>
                  <Link
                    href="/philosophy"
                    className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Philosophy
                  </Link>
                   <Link
                    href="/analytics"
                    className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Analytics
                  </Link>
                  {/* Add other nav links here */}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center">
            <ThemeToggle />
            <div className="ml-3">
              {user ? (
                <div className="flex items-center">
                  <span className="mr-3 text-sm text-gray-700 dark:text-gray-300">
                    {user.name || user.email}
                  </span>
                  <LogoutButton />
                </div>
              ) : (
                <div className="space-x-2">
                  <Link
                    href="/login"
                    className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
