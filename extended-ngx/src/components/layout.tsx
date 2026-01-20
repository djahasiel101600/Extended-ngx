import { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 flex items-center justify-between px-4 h-14">
        <span className="text-lg font-semibold">Paperless-ngx</span>
        <ThemeToggle />
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
