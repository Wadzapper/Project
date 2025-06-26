'use client'; // For user interaction with personal philosophy editor

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

// Sample built-in philosophy content
const philosophies = [
  {
    name: 'Stoicism',
    summary: 'Focus on what you can control, accept what you cannot. Virtue is the only good.',
    details: `
### Core Tenets of Stoicism
- **Virtue as the Sole Good:** Wisdom, Justice, Courage, Temperance. External things (health, wealth, reputation) are indifferent.
- **Control vs. No Control (Dichotomy of Control):** Focus your energy on your own thoughts, judgments, and actions. Accept external events as they are.
- **Living in Accordance with Nature:** Understanding the natural order of the universe and living rationally within it.
- **Duty and Social Responsibility:** Playing your part in society to the best of your ability.
- **Negative Visualization:** Contemplating potential misfortunes to appreciate what you have and prepare for adversity.
- **Mindfulness (Prosoche):** Paying attention to your thoughts and judgments in the present moment.

### Key Figures
- Zeno of Citium (Founder)
- Epictetus
- Seneca
- Marcus Aurelius
    `,
  },
  {
    name: 'Minimalism',
    summary: 'Intentionally live with only the things you truly need or deeply value.',
    details: `
### Core Tenets of Minimalism
- **Intentionality:** Making conscious decisions about what you own and why.
- **Freedom from Possessions:** Reducing clutter to free up time, energy, and mental space.
- **Focus on Experiences:** Valuing experiences and relationships over material goods.
- **Purposeful Living:** Aligning your possessions and lifestyle with your values and goals.
- **Less is More:** Finding joy and contentment in simplicity.

### Practical Applications
- Decluttering physical spaces.
- Mindful consumption and purchasing habits.
- Digital minimalism (reducing apps, notifications, online clutter).
- Simplifying schedules and commitments.
    `,
  },
    {
    name: 'Existentialism',
    summary: 'Emphasizes individual freedom, responsibility, and the subjective experience of existence.',
    details: `
### Core Tenets of Existentialism
- **Existence Precedes Essence:** Humans are born without a predefined purpose; they create their own meaning through choices and actions.
- **Freedom and Responsibility:** Individuals are radically free to make choices, and with this freedom comes profound responsibility for those choices and their consequences.
- **Angst and Absurdity:** Acknowledging the potential meaninglessness of existence and the anxiety that can arise from freedom and responsibility.
- **Authenticity:** Living in accordance with one's true self and values, rather than conforming to external pressures or societal norms.
- **Subjectivity:** The individual's personal experience and perspective are paramount.

### Key Figures
- Jean-Paul Sartre
- Simone de Beauvoir
- Albert Camus
- Søren Kierkegaard
- Friedrich Nietzsche (often considered a precursor)
    `,
  },
];

export default function PhilosophyPage() {
  const { data: session, status } = useSession();
  const [personalPhilosophy, setPersonalPhilosophy] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For saving personal philosophy
  const [isFetching, setIsFetching] = useState(true); // For fetching existing philosophy

  // Fetch user's personal philosophy
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      setIsFetching(true);
      // In a real app, you'd fetch this from /api/user/philosophy or similar
      // For now, we assume the user object from session might eventually hold it,
      // or we make a dedicated API call.
      // Let's simulate fetching it or getting it from an enhanced session object.
      // This would ideally be part of the User object fetched by NextAuth.js.
      // Fetch user's philosophy using the new API endpoint
      const fetchUserPhilosophy = async () => {
        setIsFetching(true);
        try {
            const response = await fetch('/api/user/philosophy');
            if (response.ok) {
              const data = await response.json();
              setPersonalPhilosophy(data.personalPhilosophy || '');
            } else {
              const errData = await response.json();
              console.warn("Could not fetch personal philosophy:", errData.error);
              setPersonalPhilosophy('');
            }
        } catch (e) {
            console.error("Error fetching philosophy:", e);
            setPersonalPhilosophy('');
            toast.error("Failed to load your philosophy.");
        } finally {
            setIsFetching(false);
        }
      };
      fetchUserPhilosophy();

    } else if (status === 'unauthenticated') {
      setIsFetching(false);
      setPersonalPhilosophy(''); // Clear if user logs out
    } else {
      // Session status is 'loading'
      setIsFetching(true);
    }
  }, [session, status]);

  const handleSavePhilosophy = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      toast.error('You must be logged in to save your philosophy.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/philosophy', { // API to be created in next step
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalPhilosophy }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save philosophy.');
      }
      toast.success('Personal philosophy saved!');
    } catch (error: any) {
      toast.error(error.message || 'Could not save philosophy.');
    } finally {
      setIsLoading(false);
    }
  };

  const [expandedPhilosophy, setExpandedPhilosophy] = useState<string | null>(null);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">
        Philosophies & Principles
      </h1>

      {/* Section 1: Explore Built-in Philosophies */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Explore Philosophies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {philosophies.map((p) => (
            <div key={p.name} className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
              <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-400">{p.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{p.summary}</p>
              <button
                onClick={() => setExpandedPhilosophy(expandedPhilosophy === p.name ? null : p.name)}
                className="text-sm text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 focus:outline-none"
              >
                {expandedPhilosophy === p.name ? 'Show Less' : 'Learn More...'}
              </button>
              {expandedPhilosophy === p.name && (
                <div className="mt-4 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.details}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Personal Philosophy Editor */}
      {status === 'authenticated' && (
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">My Personal Philosophy</h2>
          {isFetching ? (
            <p className="dark:text-gray-300">Loading your philosophy...</p>
          ) : (
            <form onSubmit={handleSavePhilosophy} className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
              <textarea
                value={personalPhilosophy}
                onChange={(e) => setPersonalPhilosophy(e.target.value)}
                rows={15}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                placeholder="Craft your guiding principles, values, and outlook on life here..."
              />
              <div className="mt-6 text-right">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
                >
                  {isLoading ? 'Saving...' : 'Save My Philosophy'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
       {status === 'loading' && (
        <p className="text-center dark:text-gray-300">Loading user session...</p>
      )}
      {status === 'unauthenticated' && (
         <p className="text-center dark:text-gray-300">Please <a href="/login" className="text-indigo-500 hover:underline">login</a> to write your personal philosophy.</p>
      )}
    </div>
  );
}
