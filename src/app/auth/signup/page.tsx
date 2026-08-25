'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from './signup.module.css';
import { Layers, Loader2, AlertCircle, User, Mail, Phone, Lock } from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') || 'advertiser';

  const [role, setRole] = useState<'advertiser' | 'owner'>(
    initialRole === 'owner' ? 'owner' : 'advertiser'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            role: role,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        if (role === 'owner') router.push('/dashboard/owner');
        else router.push('/dashboard/advertiser');
      } else {
        router.push(role === 'owner' ? '/dashboard/owner' : '/dashboard/advertiser');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <Link href="/" className={styles.logoLink}>
          <div className={styles.logoIcon}>
            <Layers className="text-white w-4 h-4" />
          </div>
          <span className={styles.logoText}>AdFlex AI</span>
        </Link>

        <h2 className={styles.title}>Create an Account</h2>
        <p className={styles.subtitle}>Choose your workspace to get started</p>

        {errorMsg && (
          <div className={styles.errorBanner}>
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className={styles.roleToggle}>
          <button
            type="button"
            onClick={() => setRole('advertiser')}
            className={`${styles.roleBtn} ${role === 'advertiser' ? styles.roleBtnActive : ''}`}
          >
            Advertiser
          </button>
          <button
            type="button"
            onClick={() => setRole('owner')}
            className={`${styles.roleBtn} ${role === 'owner' ? styles.roleBtnActive : ''}`}
          >
            Board Owner
          </button>
        </div>

        <form onSubmit={handleSignUp} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Full Name</label>
            <div className={styles.inputWrapper}>
              <User className={styles.inputIcon} />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Smith"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Address</label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Phone Number</label>
            <div className={styles.inputWrapper}>
              <Phone className={styles.inputIcon} />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.input}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
          </button>
        </form>

        <p className={styles.footerText}>
          Already registered?{' '}
          <Link href="/auth/signin" className={styles.linkHighlight}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}