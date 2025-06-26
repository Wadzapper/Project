'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' }); // Redirect to home page after logout
  };

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      Logout
    </button>
  );
}
