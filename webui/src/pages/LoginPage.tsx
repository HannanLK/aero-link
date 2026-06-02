import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setTokens } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirect = searchParams.get('redirect') ?? '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setTokens(res.data.accessToken, res.data.refreshToken);
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-sm';

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2 mt-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-5">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline transition-colors font-medium">
                Get started
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
