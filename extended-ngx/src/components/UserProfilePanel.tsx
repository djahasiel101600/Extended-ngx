import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Key } from 'lucide-react';
import { toast } from 'sonner'

interface UserProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfilePanel({ isOpen, onClose }: UserProfilePanelProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  // If token is not part of user, get it from localStorage
  // @ts-ignore
  const token = user.token || localStorage.getItem('paperless_token');

  const [showToken, setShowToken] = useState<boolean>(false);
  // @ts-ignore

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      toast.success('API token copied!', { description: 'Token copied to clipboard.' });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md" role="dialog" aria-modal="true" aria-label="User Profile">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-6 w-6 text-primary" aria-hidden="true" />
            Profile
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Username</span>
            <Badge variant="secondary" className="text-base font-semibold" tabIndex={0} aria-label="Username">{user.username}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Email</span>
            <Badge variant="outline" className="text-base" tabIndex={0} aria-label="Email">{user.email || 'N/A'}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">API Token</span>
            <Badge variant="outline" className="text-base flex items-center gap-2" tabIndex={0} aria-label="API Token">
              <Key className="h-4 w-4 mr-1 text-muted-foreground" />
              {token ? (
                showToken ? (
                  <span className="font-mono select-all">{token}</span>
                ) : (
                  <span className="font-mono select-none">••••••••••••••••••••••••••••••••••••••••••••••••</span>
                )
              ) : 'Hidden'}
              {token && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() => setShowToken((v: boolean) => !v)}
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? 'Hide' : 'Show'}
                </Button>
              )}
              {token && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={handleCopyToken}
                  aria-label="Copy token"
                  title="Copy token"
                >
                  Copy
                </Button>
              )}
            </Badge>
          </div>
        </div>
        <div className="mt-8 flex justify-end">
          <Button variant="outline" onClick={logout} aria-label="Logout">
            <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
