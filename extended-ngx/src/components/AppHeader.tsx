import { useState } from 'react';
import { FileText, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { UserProfilePanel } from '@/components/UserProfilePanel';

/**
 * The single application header. Shown on every page: brand + theme toggle for
 * anonymous users, plus username / profile / logout once authenticated. Pages no
 * longer render their own competing headers.
 */
export function AppHeader() {
  const { user, isAuthenticated } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
      aria-label="App Header"
    >
      <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2" aria-label="App Branding">
          <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Paperless-ngx</h1>
        </div>

        <div className="flex items-center gap-2" aria-label="Header Controls">
          <ThemeToggle />
          {isAuthenticated && (
            <>
              {user?.username && (
                <span className="hidden text-sm text-muted-foreground sm:inline" aria-label="Signed in user">
                  {user.username}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsProfileOpen(true)} aria-label="Profile">
                <User className="h-4 w-4 mr-2" aria-hidden="true" />
                Profile
              </Button>
              <LogoutButton />
            </>
          )}
        </div>
      </div>

      <UserProfilePanel isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </header>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <Button variant="outline" size="sm" onClick={logout} aria-label="Logout">
      <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
      Logout
    </Button>
  );
}
