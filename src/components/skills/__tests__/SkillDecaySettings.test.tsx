import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SkillDecaySettings from '../SkillDecaySettings'; // Adjust path as needed
import { SkillWithDecayFields } from '@/lib/skillUtils';
import { Skill } from '@prisma/client'; // For the base Skill type
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseMockSkill: Skill = {
  id: 'skill123',
  userId: 'user123',
  name: 'Test Skill for Decay',
  description: 'A skill to test decay settings',
  colorCode: null,
  currentLevel: 1,
  currentXp: 100,
  targetXpForNextLevel: 200,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSkillWithDecay: SkillWithDecayFields = {
  ...baseMockSkill,
  decayEnabled: true,
  decayRate: 10,
  decayIntervalDays: 7,
  lastDecayCheck: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
};

const mockSkillDecayDisabled: SkillWithDecayFields = {
  ...baseMockSkill,
  id: 'skill456',
  decayEnabled: false,
  decayRate: null,
  decayIntervalDays: null,
  lastDecayCheck: null,
};

describe('SkillDecaySettings', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;
  const onSettingsChangeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.spyOn(global, 'fetch');
  });

  const renderComponent = (skillProps: SkillWithDecayFields) => {
    return render(<SkillDecaySettings skill={skillProps} onSettingsChange={onSettingsChangeMock} />);
  };

  it('renders initial values from skill prop correctly when decay is enabled', () => {
    renderComponent(mockSkillWithDecay);
    expect(screen.getByLabelText('Enable Skill Decay')).toBeChecked();
    expect(screen.getByLabelText('Decay Rate (XP per interval)')).toHaveValue(mockSkillWithDecay.decayRate);
    expect(screen.getByLabelText('Decay Interval (days)')).toHaveValue(mockSkillWithDecay.decayIntervalDays);
    expect(screen.getByText(/Last Decay Check:/i)).toBeInTheDocument();
    expect(screen.getByText(/This skill will lose 10 XP every 7 day\(s\) if not updated./i)).toBeInTheDocument();
  });

  it('renders initial values correctly when decay is disabled', () => {
    renderComponent(mockSkillDecayDisabled);
    expect(screen.getByLabelText('Enable Skill Decay')).not.toBeChecked();
    // Inputs for rate and interval should not be visible or be disabled
    expect(screen.queryByLabelText('Decay Rate (XP per interval)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Decay Interval (days)')).not.toBeInTheDocument();
    expect(screen.queryByText(/This skill will lose/i)).not.toBeInTheDocument();
  });

  it('toggles input visibility and preview text when decayEnabled switch is changed', async () => {
    const user = userEvent.setup();
    renderComponent(mockSkillDecayDisabled); // Start with decay disabled

    const enableSwitch = screen.getByLabelText('Enable Skill Decay');
    await user.click(enableSwitch);

    expect(screen.getByLabelText('Decay Rate (XP per interval)')).toBeInTheDocument();
    expect(screen.getByLabelText('Decay Interval (days)')).toBeInTheDocument();
    // Preview text might not show yet if rate/interval are empty

    await user.type(screen.getByLabelText('Decay Rate (XP per interval)'), '5');
    await user.type(screen.getByLabelText('Decay Interval (days)'), '3');
    expect(screen.getByText(/This skill will lose 5 XP every 3 day\(s\) if not updated./i)).toBeInTheDocument();

    await user.click(enableSwitch); // Disable again
    expect(screen.queryByLabelText('Decay Rate (XP per interval)')).not.toBeInTheDocument();
    expect(screen.queryByText(/This skill will lose/i)).not.toBeInTheDocument();
  });

  it('successfully saves updated settings when decay is enabled with valid inputs', async () => {
    const user = userEvent.setup();
    renderComponent(mockSkillDecayDisabled); // Start disabled

    const updatedSkillResponse = {
      ...mockSkillDecayDisabled,
      decayEnabled: true,
      decayRate: 5,
      decayIntervalDays: 3,
      // Assuming API returns the updated skill as part of { updatedSkill: ... }
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ updatedSkill: updatedSkillResponse }),
    });

    await user.click(screen.getByLabelText('Enable Skill Decay'));
    await user.clear(screen.getByLabelText('Decay Rate (XP per interval)'));
    await user.type(screen.getByLabelText('Decay Rate (XP per interval)'), '5');
    await user.clear(screen.getByLabelText('Decay Interval (days)'));
    await user.type(screen.getByLabelText('Decay Interval (days)'), '3');

    await user.click(screen.getByRole('button', { name: /Save Decay Settings/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`/api/skills/${mockSkillDecayDisabled.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decayEnabled: true, decayRate: 5, decayIntervalDays: 3 }),
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Decay settings updated successfully!');
    expect(onSettingsChangeMock).toHaveBeenCalledWith(updatedSkillResponse);
  });

  it('successfully saves settings when disabling decay (sends null for rate/interval)', async () => {
    const user = userEvent.setup();
    renderComponent(mockSkillWithDecay); // Start enabled

    const updatedSkillResponse = {
      ...mockSkillWithDecay,
      decayEnabled: false,
      decayRate: null, // API will set these to null
      decayIntervalDays: null,
    };
     mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ updatedSkill: updatedSkillResponse }),
    });

    await user.click(screen.getByLabelText('Enable Skill Decay')); // Toggle to disable
    await user.click(screen.getByRole('button', { name: /Save Decay Settings/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`/api/skills/${mockSkillWithDecay.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decayEnabled: false, decayRate: null, decayIntervalDays: null }),
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Decay settings updated successfully!');
    expect(onSettingsChangeMock).toHaveBeenCalledWith(updatedSkillResponse);
  });


  it('shows client-side validation error if decay is enabled but rate or interval is invalid', async () => {
    const user = userEvent.setup();
    renderComponent(mockSkillDecayDisabled);

    await user.click(screen.getByLabelText('Enable Skill Decay'));
    // Rate missing
    await user.clear(screen.getByLabelText('Decay Interval (days)'));
    await user.type(screen.getByLabelText('Decay Interval (days)'), '7');

    await user.click(screen.getByRole('button', { name: /Save Decay Settings/i }));
    expect(toast.error).toHaveBeenCalledWith('Decay Rate must be a positive number if decay is enabled.');
    expect(mockFetch).not.toHaveBeenCalled();
    vi.clearAllMocks(); // Clear toast mock for next check

    // Interval missing
    await user.clear(screen.getByLabelText('Decay Rate (XP per interval)'));
    await user.type(screen.getByLabelText('Decay Rate (XP per interval)'), '10');
    await user.clear(screen.getByLabelText('Decay Interval (days)')); // Clear interval
     await user.click(screen.getByRole('button', { name: /Save Decay Settings/i }));
    expect(toast.error).toHaveBeenCalledWith('Decay Interval must be a positive number of days if decay is enabled.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows API error if saving fails', async () => {
    const user = userEvent.setup();
    renderComponent(mockSkillWithDecay);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'API Save Failed' }),
    });

    await user.click(screen.getByRole('button', { name: /Save Decay Settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('API Save Failed');
    });
  });
});
