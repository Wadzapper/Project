// Summary: Tests for the RecommendationsPanel component.
// TODO: Test specific API call for quest instantiation if `isTemplate` logic is added to recommendations.
// TODO: Test UI changes after successfully adding a recommendation (e.g., item disabled or removed).

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import RecommendationsPanel from '../RecommendationsPanel'; // Adjust path
import { QuestType, HabitType, HabitGoalType } from '@prisma/client';
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

const mockRecommendedQuests = [
  { id: 'rec-q1', name: 'Learn React Basics', description: 'Complete the intro tutorial.', type: QuestType.SKILL_MASTERY, linkedSkills: [{id: 's1', name: 'React'}], isTemplate: false, xpReward: 50 },
  { id: 'rec-q2', name: 'Daily Standup Prep', description: 'Prepare notes for standup.', type: QuestType.DAILY_TASK, isTemplate: false, xpReward: 10 },
];
const mockRecommendedHabits = [
  { id: 'rec-h1', name: 'Drink Water Hourly', description: 'Stay hydrated.', type: HabitType.GOOD, goalType: HabitGoalType.DAILY, linkedSkills: [{id: 's2', name: 'Health Focus'}] },
  { id: 'rec-h2', name: 'Evening Review', description: 'Plan for tomorrow.', type: HabitType.GOOD, goalType: HabitGoalType.DAILY },
];

describe('RecommendationsPanel', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.spyOn(global, 'fetch');

    mockFetch.mockImplementation(async (url): Promise<any> => {
      if (typeof url === 'string') {
        if (url.includes('/api/recommendations?type=quests')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRecommendedQuests) });
        }
        if (url.includes('/api/recommendations?type=habits')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRecommendedHabits) });
        }
        // For POST requests (adding quest/habit)
        if (url.includes('/api/quests') && (fetch as any).mock.calls.at(-1)[0].method === 'POST') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-quest', title: 'New Quest Added' }) });
        }
        if (url.includes('/api/habits') && (fetch as any).mock.calls.at(-1)[0].method === 'POST') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-habit', name: 'New Habit Added' }) });
        }
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unhandled fetch mock in RecommendationsPanel test' }) });
    });
  });

  it('renders tabs and initially loads quest recommendations', async () => {
    render(<RecommendationsPanel />);
    expect(screen.getByRole('tab', { name: /Quests/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Habits/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(mockRecommendedQuests[0].name)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/recommendations?type=quests', undefined);
    expect(mockFetch).toHaveBeenCalledWith('/api/recommendations?type=habits', undefined);
  });

  it('displays quest recommendations correctly', async () => {
    render(<RecommendationsPanel />);
    await waitFor(() => {
      expect(screen.getByText(mockRecommendedQuests[0].name)).toBeInTheDocument();
      expect(screen.getByText(mockRecommendedQuests[0].description!)).toBeInTheDocument();
      expect(screen.getByText(mockRecommendedQuests[0].linkedSkills![0].name)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Start Quest/i })).toHaveLength(mockRecommendedQuests.length);
    });
  });

  it('switches to habits tab and displays habit recommendations', async () => {
    const user = userEvent.setup();
    render(<RecommendationsPanel />);

    const habitsTab = screen.getByRole('tab', { name: /Habits/i });
    await user.click(habitsTab);

    await waitFor(() => {
      expect(screen.getByText(mockRecommendedHabits[0].name)).toBeInTheDocument();
      expect(screen.getByText(mockRecommendedHabits[0].description!)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Add Habit/i })).toHaveLength(mockRecommendedHabits.length);
    });
  });

  it('calls API to add quest when "Start Quest" is clicked', async () => {
    const user = userEvent.setup();
    render(<RecommendationsPanel />);
    await waitFor(() => expect(screen.getByText(mockRecommendedQuests[0].name)).toBeInTheDocument());

    const startQuestButton = screen.getAllByRole('button', { name: /Start Quest/i })[0];
    await user.click(startQuestButton);

    expect(toast.loading).toHaveBeenCalledWith('Adding quest...');
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mockRecommendedQuests[0].name,
          description: mockRecommendedQuests[0].description,
          type: mockRecommendedQuests[0].type,
          xpReward: mockRecommendedQuests[0].xpReward,
        }),
      });
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining(`Quest "${mockRecommendedQuests[0].name}" added!`), expect.any(Object));
  });

  it('calls API to add habit when "Add Habit" is clicked', async () => {
    const user = userEvent.setup();
    render(<RecommendationsPanel />);

    const habitsTab = screen.getByRole('tab', { name: /Habits/i });
    await user.click(habitsTab);
    await waitFor(() => expect(screen.getByText(mockRecommendedHabits[0].name)).toBeInTheDocument());

    const addHabitButton = screen.getAllByRole('button', { name: /Add Habit/i })[0];
    await user.click(addHabitButton);

    expect(toast.loading).toHaveBeenCalledWith('Adding habit...');
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mockRecommendedHabits[0].name,
          description: mockRecommendedHabits[0].description,
          type: mockRecommendedHabits[0].type,
          goalType: mockRecommendedHabits[0].goalType || 'DAILY',
        }),
      });
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining(`Habit "${mockRecommendedHabits[0].name}" added!`), expect.any(Object));
  });

  it('shows loading states for tabs', async () => {
    mockFetch.mockImplementation(url => {
      if (typeof url === 'string' && url.includes('/api/recommendations?type=quests')) {
        return new Promise(() => {}); // Keep quest promise pending
      }
      if (typeof url === 'string' && url.includes('/api/recommendations?type=habits')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRecommendedHabits) });
      }
      return Promise.resolve({ok: false, json: () => Promise.resolve({})});
    });
    render(<RecommendationsPanel />);
    expect(screen.getByText(/Loading quest recommendations.../i)).toBeInTheDocument();
    // Habits should still load
    await waitFor(() => expect(screen.queryByText(/Loading habit recommendations.../i)).not.toBeInTheDocument());
  });

  it('shows empty state if no recommendations are returned', async () => {
    mockFetch.mockImplementation(async (url): Promise<any> => {
        if (typeof url === 'string' && url.includes('/api/recommendations?type=quests')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        if (typeof url === 'string' && url.includes('/api/recommendations?type=habits')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        return Promise.resolve({ok: false, json: () => Promise.resolve({})});
    });
    render(<RecommendationsPanel />);
    await waitFor(() => {
        expect(screen.getByText(/No quest recommendations available right now./i)).toBeInTheDocument();
    });
    const habitsTab = screen.getByRole('tab', { name: /Habits/i });
    await userEvent.click(habitsTab);
    await waitFor(() => {
        expect(screen.getByText(/No habit recommendations available right now./i)).toBeInTheDocument();
    });
  });

});
