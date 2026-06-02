import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(form);
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const inputClass =
    'w-full bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-sm';

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create an account</CardTitle>
            <CardDescription>Join AeroLink to start booking flights</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(['firstName', 'lastName'] as const).map((k) => (
                  <div key={k}>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      {k === 'firstName' ? 'First name' : 'Last name'}
                    </label>
                    <input required {...field(k)} className={inputClass} />
                  </div>
                ))}
              </div>

              {(['email', 'password', 'phone'] as const).map((k) => (
                <div key={k}>
                  <label className="block text-sm text-muted-foreground mb-1.5 capitalize">
                    {k === 'phone' ? 'Phone (optional)' : k}
                  </label>
                  <input
                    type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'tel'}
                    required={k !== 'phone'}
                    {...field(k)}
                    className={inputClass}
                  />
                </div>
              ))}

              <Button type="submit" disabled={loading} className="w-full gap-2 mt-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create account
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline transition-colors font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
