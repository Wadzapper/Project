'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Define a type for the SkillTree data
export type SkillTree = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string; // Assuming date comes as string
  userId: string;
  // _count?: { nodes: number }; // If we include node count
};

// Reusable Modal for Create/Edit Skill Tree (simplified version)
interface SkillTreeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  initialData?: { name: string; description: string } | null;
  mode: 'create' | 'edit';
  isLoading?: boolean;
  error?: string | null;
}

function SkillTreeFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  isLoading = false,
  error = null,
}: SkillTreeFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setName(initialData?.name || '');
    setDescription(initialData?.description || '');
  }, [initialData, isOpen]); // Reset when modal opens or initialData changes

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Tree name is required.'); // Basic validation
      return;
    }
    onSubmit({ name, description });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Create New Skill Tree' : 'Edit Skill Tree'}
          </h2>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}
          <div>
            <label htmlFor="treeName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tree Name</label>
            <input type="text" name="treeName" id="treeName" required value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading}
                   className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>
          <div>
            <label htmlFor="treeDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea name="treeDescription" id="treeDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading}
                      className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500" />
          </div>
          <div className="pt-4 space-x-3 text-right border-t dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600">
              {isLoading ? 'Saving...' : (mode === 'create' ? 'Create Tree' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function SkillTreesPage() {
  const [skillTrees, setSkillTrees] = useState<SkillTree[]>([]);
  const [isLoadingTrees, setIsLoadingTrees] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentTreeData, setCurrentTreeData] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageMessage, setPageMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const router = useRouter();

  const fetchSkillTrees = async () => {
    setIsLoadingTrees(true);
    try {
      const response = await fetch('/api/skill-trees');
      if (!response.ok) throw new Error('Failed to fetch skill trees');
      const data = await response.json();
      setSkillTrees(data);
    } catch (error) {
      console.error(error);
      setPageMessage({ type: 'error', text: 'Could not load skill trees.' });
    } finally {
      setIsLoadingTrees(false);
    }
  };

  useEffect(() => {
    fetchSkillTrees();
  }, []);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setCurrentTreeData({ name: '', description: '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tree: SkillTree) => {
    setModalMode('edit');
    setCurrentTreeData({ id: tree.id, name: tree.name, description: tree.description || '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentTreeData(null);
    setFormError(null);
  };

  const handleSubmitTree = async (data: { name: string; description: string }) => {
    setIsSubmitting(true);
    setFormError(null);
    setPageMessage(null);

    const url = modalMode === 'create' ? '/api/skill-trees' : `/api/skill-trees/${currentTreeData?.id}`;
    const method = modalMode === 'create' ? 'POST' : 'PATCH';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${modalMode} skill tree`);
      }
      setPageMessage({ type: 'success', text: `Skill tree ${modalMode === 'create' ? 'created' : 'updated'} successfully!` });
      handleCloseModal();
      fetchSkillTrees();
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTree = async (treeId: string) => {
    setPageMessage(null);
    if (window.confirm('Are you sure you want to delete this skill tree? This will also delete all its nodes.')) {
      try {
        const response = await fetch(`/api/skill-trees/${treeId}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete skill tree');
        }
        setPageMessage({ type: 'success', text: 'Skill tree deleted successfully.' });
        fetchSkillTrees();
        router.refresh();
      } catch (error: any) {
        setPageMessage({ type: 'error', text: error.message });
      }
    }
  };

  if (isLoadingTrees) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading skill trees...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Skill Trees</h1>
        <button onClick={handleOpenCreateModal} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600">
          + Create New Tree
        </button>
      </div>

      {pageMessage && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${pageMessage.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`} role="alert">
          {pageMessage.text}
        </div>
      )}

      {skillTrees.length === 0 && !isLoadingTrees ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-md dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-400">No skill trees found. Get started by creating one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skillTrees.map((tree) => (
            <div key={tree.id} className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">{tree.name}</h2>
              {tree.description && <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 truncate">{tree.description}</p>}
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">Created: {new Date(tree.createdAt).toLocaleDateString()}</div>
              <div className="flex justify-between items-center">
                <Link href={`/skill-trees/${tree.id}/edit`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                  Open Editor
                </Link>
                <div className="space-x-2">
                  <button onClick={() => handleOpenEditModal(tree)} className="px-3 py-1 text-xs text-white bg-blue-500 rounded hover:bg-blue-600">Edit</button>
                  <button onClick={() => handleDeleteTree(tree.id)} className="px-3 py-1 text-xs text-white bg-red-500 rounded hover:bg-red-600">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SkillTreeFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitTree}
        initialData={currentTreeData ? { name: currentTreeData.name, description: currentTreeData.description } : null }
        mode={modalMode}
        isLoading={isSubmitting}
        error={formError}
      />
    </div>
  );
}
