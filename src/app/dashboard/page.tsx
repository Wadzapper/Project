import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    // This should ideally be handled by middleware, but as a fallback:
    redirect('/login?callbackUrl=/dashboard');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Welcome to your Dashboard, {session.user.name || session.user.email}!
      </h1>
      <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <p className="text-gray-700 dark:text-gray-300">
          This is your protected dashboard page. Only logged-in users can see this.
        </p>
        <pre className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm overflow-x-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
      {/* Future content for the dashboard will go here */}
    </div>
  );
}
