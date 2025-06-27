// Summary: Manifesto page with a Markdown editor and live preview, saved to localStorage.
// Includes themed background placeholders and introspection prompts.
// TODO: Implement actual animated themed backgrounds (sunrays/starfield) in layout or global CSS.
// TODO: Consider a more robust editor if advanced Markdown features are needed.
// TODO: Add a "Copy to Clipboard" or "Download as .md" for the manifesto.

'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // For GitHub Flavored Markdown (tables, strikethrough, etc.)
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Edit3, Eye, HelpCircle } from 'lucide-react';
import { useTheme } from 'next-themes'; // For themed background logic

const LOCAL_STORAGE_KEY = 'userManifesto';

const introspectionPrompts = [
  "What are my core values, and how do they guide my daily actions?",
  "What kind of person do I aspire to become in the next 5 years?",
  "What impact do I want to have on the world, no matter how small?",
  "What are my non-negotiables in life and work?",
  "If I had unlimited resources, what problem would I dedicate myself to solving?",
  "What does 'a life well-lived' mean to me personally?",
];

const ManifestoPage = () => {
  const [markdown, setMarkdown] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const { theme, resolvedTheme } = useTheme();

  // Load from localStorage on initial client mount
  useEffect(() => {
    setMounted(true);
    const savedManifesto = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedManifesto) {
      setMarkdown(savedManifesto);
    } else {
      // Default placeholder if nothing saved
      setMarkdown(`# My Personal Manifesto\n\n## Guiding Principles\n\n*   Principle 1...\n*   Principle 2...\n\n## My Mission\n\nI strive to...\n\n## Aspirations\n\nI aim to achieve...\n`);
    }
    generateNewPrompt(); // Set an initial prompt
  }, []);

  // Save to localStorage on markdown change
  useEffect(() => {
    if (mounted) { // Ensure this only runs client-side after initial load
      localStorage.setItem(LOCAL_STORAGE_KEY, markdown);
    }
  }, [markdown, mounted]);

  const handleMarkdownChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(event.target.value);
  };

  const generateNewPrompt = () => {
    const randomIndex = Math.floor(Math.random() * introspectionPrompts.length);
    setCurrentPrompt(introspectionPrompts[randomIndex]);
  };

  const currentThemeForBg = theme === 'system' ? resolvedTheme : theme;
  // Basic conceptual background styles - actual animation would be in global CSS / layout
  const backgroundStyle: React.CSSProperties = currentThemeForBg === 'dark'
    ? { background: 'radial-gradient(ellipse at bottom, #0f172a 0%, #020617 70%)', minHeight: 'calc(100vh - 4rem)' } // Dark, starry night conceptual
    : { background: 'radial-gradient(ellipse at top, #fffbeb 0%, #fef3c7 70%)', minHeight: 'calc(100vh - 4rem)' }; // Light, sunrays conceptual


  if (!mounted) {
    // Avoid rendering editor/preview server-side or before hydration to prevent mismatch with localStorage
    return <div className="container mx-auto p-6 text-center">Loading Manifesto...</div>;
  }

  return (
    <div style={backgroundStyle} className="transition-colors duration-500">
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <Card className="mb-6 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-3xl font-bold flex items-center">
              <Edit3 className="mr-3 h-8 w-8 text-primary" /> My Manifesto
            </CardTitle>
            <CardDescription>
              Craft your personal mission statement, guiding principles, and aspirations. This is your declaration.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Markdown Editor */}
          <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center"><Edit3 className="mr-2 h-5 w-5"/>Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={markdown}
                onChange={handleMarkdownChange}
                rows={20}
                className="w-full p-3 border rounded-md font-mono text-sm bg-background/70 focus:ring-primary focus:border-primary"
                placeholder="Start writing your manifesto in Markdown..."
              />
            </CardContent>
          </Card>

          {/* Live Preview & Prompts */}
          <div className="space-y-6">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl flex items-center"><Eye className="mr-2 h-5 w-5"/>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none p-3 border rounded-md bg-background/70 h-[300px] overflow-y-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-yellow-400"/>Introspection Prompts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground italic">"{currentPrompt}"</p>
                <Button variant="outline" size="sm" onClick={generateNewPrompt}>
                  <HelpCircle className="mr-1.5 h-4 w-4"/> New Prompt
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManifestoPage;
