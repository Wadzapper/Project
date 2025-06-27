// Summary: Tests for the SkillGoalsPage component.
// TODO: Test Edit Goal functionality once implemented in the UI.
// TODO: Test specific progress bar rendering values more precisely if needed.
// TODO: Test interaction with a real color picker for tags if that's implemented.

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SkillGoalsPage from '../page'; // Assuming this is the path to SkillGoalsPage
import { Skill, SkillGoal, QuestStatus, HabitType, HabitGoalType, QuestType, RatingCategory } from '@prisma/client'; // Import relevant Prisma types
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock ProgressBar as its internals are not crucial for these tests
vi.mock('@/components/ui/ProgressBar', () => ({
    __esModule: true,
    default: ({ currentValue, maxValue }: {currentValue: number, maxValue: number}) => {
        const percent = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
        return <div data-testid="progress-bar" aria-valuenow={percent}>{Math.round(percent)}%</div>;
    }
}));

const mockSkills: Pick<Skill, 'id' | 'name' | 'currentXp' | 'currentLevel'>[] = [
  { id: 'skill1', name: 'React Development', currentXp: 150, currentLevel: 2 },
  { id: 'skill2', name: 'Prisma Basics', currentXp: 30, currentLevel: 1 },
];

const mockSkillGoals: (SkillGoal & { skill: Pick<Skill, 'id' | 'name' | 'currentXp' | 'currentLevel'> })[] = [
  {
    id: 'sg1', userId: 'user1', skillId: 'skill1', targetXP: 200, dueDate: new Date(Date.now() + 5 * 24*60*60*1000), notes: 'Finish tutorial',
    isComplete: false, completedAt: null, createdAt: new Date(), updatedAt: new Date(),
    skill: mockSkills[0],
  },
  {
    id: 'sg2', userId: 'user1', skillId: 'skill2', targetXP: 25, dueDate: null, notes: 'Review chapter 1',
    isComplete: true, completedAt: new Date(Date.now() - 2 * 24*60*60*1000), createdAt: new Date(), updatedAt: new Date(),
    skill: mockSkills[1],
  },
];


describe('SkillGoalsPage', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.spyOn(global, 'fetch');

    // Default fetch mock for skill goals (incomplete)
    mockFetch.mockImplementation(async (url): Promise<any> => {
      const urlStr = String(url);
      if (urlStr.includes('/api/skill-goals?isComplete=false')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSkillGoals.filter(g => !g.isComplete)) });
      }
      if (urlStr.includes('/api/skill-goals?isComplete=true')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSkillGoals.filter(g => g.isComplete)) });
      }
      if (urlStr.includes('/api/skill-goals')) { // All goals
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSkillGoals) });
      }
      if (urlStr.includes('/api/skills')) { // For skill selector in modal
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSkills) });
      }
      if (urlStr.includes('/api/skill-goals') && (fetch as any).mock.calls.at(-1)[0].method === 'POST') {
        const body = (fetch as any).mock.calls.at(-1)[0].body;
        const newGoal = JSON.parse(body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({id: 'new-goal-id', ...newGoal, skill: mockSkills.find(s => s.id === newGoal.skillId)})});
      }
      if (urlStr.includes('/api/skill-goals/') && (fetch as any).mock.calls.at(-1)[0].method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Skill Goal deleted' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: `Unhandled fetch mock for ${urlStr}` }) });
    });
  });

  it('renders loading state initially, then displays incomplete skill goals by default', async () => {
    render(<SkillGoalsPage />);
    expect(screen.getByText(/Loading skill goals.../i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(`${mockSkillGoals[0].skill.name} - Goal`)).toBeInTheDocument();
      expect(screen.queryByText(`${mockSkillGoals[1].skill.name} - Goal`)).not.toBeInTheDocument(); // Completed goal
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/skill-goals?isComplete=false', undefined);
  });

  it('displays goal details correctly (XP, progress bar, due date)', async () => {
    render(<SkillGoalsPage />);
    await waitFor(() => screen.getByText(`${mockSkillGoals[0].skill.name} - Goal`));

    const incompleteGoal = mockSkillGoals[0];
    expect(screen.getByText(`Target: ${incompleteGoal.targetXP.toLocaleString()} XP`)).toBeInTheDocument();
    expect(screen.getByText(`Current XP: ${incompleteGoal.skill.currentXp.toLocaleString()} / ${incompleteGoal.targetXP.toLocaleString()}`)).toBeInTheDocument();
    const progressBar = screen.getByTestId('progress-bar');
    const expectedPercent = Math.min(100, Math.max(0, (incompleteGoal.skill.currentXp / incompleteGoal.targetXP) * 100));
    expect(progressBar).toHaveTextContent(`${Math.round(expectedPercent)}%`);
    expect(screen.getByText(`Due: ${format(parseISO(incompleteGoal.dueDate as string), 'MMM d, yyyy')}`)).toBeInTheDocument();
  });

  it('filters goals when filter buttons are clicked', async () => {
    const user = userEvent.setup();
    render(<SkillGoalsPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/skill-goals?isComplete=false', undefined));
    vi.clearAllMocks(); // Clear fetch mocks after initial load

    // Click "Completed" filter
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSkillGoals.filter(g => g.isComplete)) });
    await user.click(screen.getByRole('button', { name: /Completed/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/skill-goals?isComplete=true', undefined));
    expect(screen.getByText(`${mockSkillGoals[1].skill.name} - Goal`)).toBeInTheDocument();
    expect(screen.queryByText(`${mockSkillGoals[0].skill.name} - Goal`)).not.toBeInTheDocument();
    vi.clearAllMocks();

    // Click "All" filter
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSkillGoals) });
    await user.click(screen.getByRole('button', { name: /All/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/skill-goals', undefined)); // No query param for all
    expect(screen.getByText(`${mockSkillGoals[0].skill.name} - Goal`)).toBeInTheDocument();
    expect(screen.getByText(`${mockSkillGoals[1].skill.name} - Goal`)).toBeInTheDocument();
  });

  it('opens "Add New Goal" modal, populates skills, and submits form', async () => {
    const user = userEvent.setup();
    render(<SkillGoalsPage />);
    await waitFor(() => expect(screen.getByText(/Skill Goals/i)).toBeInTheDocument()); // Wait for page to load

    await user.click(screen.getByRole('button', { name: /Add New Goal/i }));
    await waitFor(() => expect(screen.getByText('Set New Skill Goal')).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledWith('/api/skills', undefined); // Skills fetched for modal

    // Select skill
    const skillSelect = screen.getByRole('combobox', {name: 'Skill'}); // Assuming Label wraps SelectTrigger with correct ID
    await user.click(skillSelect);
    await user.click(await screen.findByText(mockSkills[0].name));

    // Fill form
    await user.type(screen.getByLabelText('Target XP'), '500');
    await user.type(screen.getByLabelText('Due Date (Optional)'), '2024-12-31');
    await user.type(screen.getByLabelText('Notes (Optional)'), 'Finish advanced course');

    await user.click(screen.getByRole('button', { name: 'Add Goal' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/skill-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: mockSkills[0].id,
          targetXP: 500,
          dueDate: '2024-12-31',
          notes: 'Finish advanced course',
        }),
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Skill goal created successfully!');
  });

  it('handles deleting a skill goal', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => true); // Auto-confirm delete
    render(<SkillGoalsPage />);
    await waitFor(() => expect(screen.getByText(`${mockSkillGoals[0].skill.name} - Goal`)).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle('Delete Goal');
    await user.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(`/api/skill-goals/${mockSkillGoals[0].id}`, { method: 'DELETE' }));
    expect(toast.success).toHaveBeenCalledWith('Skill goal deleted.');
  });

});
