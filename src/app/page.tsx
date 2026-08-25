'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { 
  ShieldCheck, 
  Sparkles, 
  MapPin, 
  Layers, 
  DollarSign, 
  Menu, 
  X, 
  ArrowRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoIcon}>
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span>AdFlex <span className={styles.gradientText}>AI</span></span>
          </Link>

          <div className={styles.desktopNav}>
            <Link href="/auth/signin?role=admin" className={styles.adminBtn}>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Admin Access
            </Link>
            <Link href="/auth/signin" className={styles.signInBtn}>
              Sign In
            </Link>
            <Link href="/auth/signup" className={styles.primaryBtn}>
              Get Started
            </Link>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={styles.menuBtn}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <Link
              href="/auth/signin?role=admin"
              onClick={() => setMobileMenuOpen(false)}
              className={styles.adminBtn}
              style={{ justifyContent: 'center', padding: '0.625rem' }}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Admin Portal
            </Link>
            <Link
              href="/auth/signin"
              onClick={() => setMobileMenuOpen(false)}
              className={styles.cardButtonSecondary}
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              onClick={() => setMobileMenuOpen(false)}
              className={styles.cardButtonPrimary}
            >
              Get Started
            </Link>
          </div>
        )}
      </header>

      <main className={styles.hero}>
        <div className={styles.badge}>
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>AI-Driven Outdoor Advertisement System</span>
        </div>

        <h1 className={styles.title}>
          Next-Gen Flex Booking & <br />
          <span className={styles.gradientText}>Location Intelligence</span>
        </h1>

        <p className={styles.description}>
          Find prime hoarding locations with Gemini AI visibility analytics, automated price recommendations, and instant banner verification.
        </p>

        <div className={styles.featureBadges}>
          <span className={styles.featureItem}>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> AI Pricing
          </span>
          <span className={styles.featureItem}>
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Traffic Scores
          </span>
          <span className={styles.featureItem}>
            <MapPin className="w-3.5 h-3.5 text-indigo-400" /> GPS Verification
          </span>
        </div>

        <div className={styles.cardsGrid}>
          <div className={`${styles.card} ${styles.cardOwner}`}>
            <div>
              <div className={styles.cardIconOwner}>
                <DollarSign className="w-6 h-6" />
              </div>
              <h2 className={styles.cardTitle}>Space / Land Owners</h2>
              <p className={styles.cardDescription}>
                Monetize your physical sites. List flex sizes, receive AI price estimates based on neighborhood traffic, and collect payments easily.
              </p>
            </div>
            <div className={styles.cardAction}>
              <Link href="/auth/signup?role=owner" className={styles.cardButtonSecondary}>
                Register as Space Owner <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className={`${styles.card} ${styles.cardAdv}`}>
            <div>
              <div className={styles.cardIconAdv}>
                <MapPin className="w-6 h-6" />
              </div>
              <h2 className={styles.cardTitle}>Advertisers</h2>
              <p className={styles.cardDescription}>
                Target high-footfall bus stands, roundabouts, and highways. Upload ad banners, run AI resolution checks, and track campaigns live.
              </p>
            </div>
            <div className={styles.cardAction}>
              <Link href="/auth/signup?role=advertiser" className={styles.cardButtonPrimary}>
                Explore & Book Billboard <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        © 2027 AdFlex AI Platform • Powered by Gemini & Supabase
      </footer>
    </div>
  );
}