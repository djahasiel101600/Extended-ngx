import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, Key, User } from 'lucide-react';

type AuthMode = 'credentials' | 'token';

export function LoginPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('token');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError('Invalid username or password. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await loginWithToken(token.trim());
      navigate('/');
    } catch (err) {
      setError('Invalid token. Please check your API token and try again.');
      console.error('Token login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Paperless-ngx</CardTitle>
          <CardDescription>
            Sign in to access the document viewer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auth Mode Toggle */}
          <div className="flex rounded-lg border p-1">
            <button
              type="button"
              onClick={() => { setAuthMode('token'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                authMode === 'token'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <Key className="h-4 w-4" />
              API Token
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('credentials'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                authMode === 'credentials'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <User className="h-4 w-4" />
              Credentials
            </button>
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {/* Token Login Form */}
          {authMode === 'token' && (
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">API Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Enter your Paperless-ngx API token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Find your token in Paperless-ngx → Settings → API Token
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !token.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Sign In with Token
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Credentials Login Form */}
          {authMode === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <User className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Note: Credentials login requires CSRF configuration in Paperless-ngx
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
