// Summary: Client component for toggling between light and dark themes.
// Uses next-themes hook.
// TODO: Consider more elaborate icons or animations for theme transition indication.

'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggleButton() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // useEffect only runs on the client, so now we can show the UI
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder or null on the server and during initial client mount
    // to avoid hydration mismatch if theme is system-derived.
    return <div className="w-9 h-9" />; // Placeholder with same size as button
  }

  const currentTheme = theme === 'system' ? resolvedTheme : theme;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
      aria-label={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {currentTheme === 'dark' ? (
        <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
