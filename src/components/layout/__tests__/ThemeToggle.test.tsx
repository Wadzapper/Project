// Summary: Tests for the ThemeToggle component.
// TODO: Test localStorage interaction more directly if possible, or rely on next-themes internal testing.

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach, SpyInstance } from 'vitest';
import { ThemeToggle } from '../ThemeToggle'; // Adjust path as needed
import { useTheme } from 'next-themes';

// Mock next-themes
let mockSetTheme = vi.fn();
let mockUseThemeReturnValue = {
  theme: 'light',
  setTheme: mockSetTheme,
  resolvedTheme: 'light',
};

vi.mock('next-themes', () => ({
  useTheme: () => mockUseThemeReturnValue,
}));


describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to light theme for each test, can be overridden
    mockUseThemeReturnValue = {
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
    };
    // Mock mounted state for the toggle button
    // Since the actual component uses useEffect to setMounted(true), we need to simulate this.
    // A simple way is to ensure the button content is rendered.
  });

  it('renders Sun icon when current theme is light', async () => {
    render(<ThemeToggle />);
    // The button content is conditional on `mounted`. We need to wait for it.
    // The component itself handles this, so we should find the button by its final state.
    await screen.findByRole('button'); // Wait for mounted state to allow button rendering
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    // Check for Sun icon by its presence (lucide icons might not have easy text labels)
    // For robust test, an SVG title or data-testid on the icon would be better.
    // For now, assume if button label is "Switch to dark mode", Sun icon is shown.
    // Or check for a class if icons have unique classes.
    // Let's assume the Sun icon component has a distinguishable characteristic or test id if needed.
    // Awaiting findByRole should ensure mounted is true.
    expect(document.querySelector('svg.lucide-sun')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-moon')).not.toBeInTheDocument();

  });

  it('renders Moon icon when current theme is dark', async () => {
    mockUseThemeReturnValue = { theme: 'dark', setTheme: mockSetTheme, resolvedTheme: 'dark' };
    render(<ThemeToggle />);
    await screen.findByRole('button');
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-moon')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-sun')).not.toBeInTheDocument();
  });

  it('renders correctly when theme is "system" and resolvedTheme is "light"', async () => {
    mockUseThemeReturnValue = { theme: 'system', setTheme: mockSetTheme, resolvedTheme: 'light' };
    render(<ThemeToggle />);
    await screen.findByRole('button');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-sun')).toBeInTheDocument();
  });

  it('renders correctly when theme is "system" and resolvedTheme is "dark"', async () => {
    mockUseThemeReturnValue = { theme: 'system', setTheme: mockSetTheme, resolvedTheme: 'dark' };
    render(<ThemeToggle />);
    await screen.findByRole('button');
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-moon')).toBeInTheDocument();
  });

  it('calls setTheme with "dark" when current theme is light and button is clicked', async () => {
    const user = userEvent.setup();
    mockUseThemeReturnValue = { theme: 'light', setTheme: mockSetTheme, resolvedTheme: 'light' };
    render(<ThemeToggle />);
    const button = await screen.findByRole('button');
    await user.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with "light" when current theme is dark and button is clicked', async () => {
    const user = userEvent.setup();
    mockUseThemeReturnValue = { theme: 'dark', setTheme: mockSetTheme, resolvedTheme: 'dark' };
    render(<ThemeToggle />);
    const button = await screen.findByRole('button');
    await user.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme with "light" when system theme resolves to dark and button is clicked', async () => {
    const user = userEvent.setup();
    mockUseThemeReturnValue = { theme: 'system', setTheme: mockSetTheme, resolvedTheme: 'dark' };
    render(<ThemeToggle />);
    const button = await screen.findByRole('button');
    await user.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  // Testing localStorage directly is an integration detail of next-themes.
  // We trust next-themes to handle localStorage. The main contract of ThemeToggle
  // is to call setTheme correctly.
});
