import { type ReactNode } from 'react';
import { AppHeader } from './AppHeader';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-6" role="main">
        {children}
      </main>
    </div>
  );
}
