'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from './signin.module.css';
import { Layers, Loader2, AlertCircle, ShieldCheck, Mail, Lock } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminPortal = searchParams.get('role') === 'admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const userRole = data.user?.user_metadata?.role || (isAdminPortal ? 'admin' : 'advertiser');

      if (userRole === 'admin' || isAdminPortal) {
        router.push('/dashboard/admin');
      } else if (userRole === 'owner') {
        router.push('/dashboard/owner');
      } else {
        router.push('/dashboard/advertiser');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.card} ${isAdminPortal ? styles.adminCard : ''}`}>
        <Link href="/" className={styles.logoLink}>
          <div className={`${styles.logoIcon} ${isAdminPortal ? styles.adminLogoIcon : ''}`}>
            <Layers className="text-white w-4 h-4" />
          </div>
          <span className={styles.logoText}>AdFlex AI</span>
        </Link>

        <div className={styles.headerText}>
          <h2 className={styles.title}>
            {isAdminPortal && <ShieldCheck className="text-amber-400 w-5 h-5" />}
            {isAdminPortal ? 'Admin Console Login' : 'Welcome Back'}
          </h2>
          <p className={styles.subtitle}>
            {isAdminPortal 
              ? 'Authorized platform personnel verification' 
              : 'Sign in to access your flex spaces & campaign analytics'}
          </p>
        </div>

        {errorMsg && (
          <div className={styles.errorBanner}>
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSignIn} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Address</label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.input}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${styles.submitBtn} ${isAdminPortal ? styles.adminSubmitBtn : ''}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isAdminPortal ? 'Authenticate Admin' : 'Sign In'}
          </button>
        </form>

        <div className={styles.footerLinks}>
          {!isAdminPortal && (
            <p>
              Don't have an account?{' '}
              <Link href="/auth/signup" className={styles.linkHighlight}>
                Sign Up
              </Link>
            </p>
          )}
          <Link
            href={isAdminPortal ? '/auth/signin' : '/auth/signin?role=admin'}
            className={styles.switchPortalLink}
          >
            {isAdminPortal ? '← Switch to User Sign In' : 'Enter Admin Control Portal →'}
          </Link>
        </div>
      </div>
    </div>
  );
}