'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/context/NotificationContext';
import ProfileModal from '@/components/ProfileModal';
import { LayoutDashboard, Layers, DollarSign, PlusCircle, LogOut, User, Menu, X } from 'lucide-react';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadByChannel, unreadTotal } = useNotifications();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.push('/auth/signin');
      else setCurrentUser(session.user);
    });
  }, [router]);

  const adminChatUnread = (unreadByChannel['owner_admin'] || 0) > 0;
  const advertiserChatUnread = (unreadByChannel['advertiser_owner'] || 0) > 0;

  const navItems = [
    { label: 'Overview', href: '/dashboard/owner', icon: LayoutDashboard, unread: unreadTotal > 0 },
    { label: 'My Added Boards', href: '/dashboard/owner/boards', icon: Layers, unread: adminChatUnread },
    { label: 'Rented Boards & Due Dates', href: '/dashboard/owner/rents', icon: DollarSign, unread: advertiserChatUnread },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <span className="font-bold text-base text-white">Board Owner Hub</span>
        <div className="flex items-center gap-2">
          {unreadTotal > 0 && (
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse ring-2 ring-slate-900" />
          )}
          <Link
            href="/dashboard/owner/new"
            className="p-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <PlusCircle className="w-4 h-4" /> Add
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-indigo-400" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 border-b border-slate-800 p-4 space-y-2 sticky top-[53px] z-30 backdrop-blur-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
                {item.unread && (
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                )}
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowProfileModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/80 w-full"
            >
              <User className="w-4 h-4 text-purple-400" /> Owner Profile
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 w-full"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-slate-800 bg-slate-900/60 p-5 flex-col justify-between shrink-0 h-screen sticky top-0">
        <div>
          <div className="font-bold text-lg text-white mb-8">Board Owner Hub</div>

          <Link
            href="/dashboard/owner/new"
            className="w-full mb-6 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
          >
            <PlusCircle className="w-4 h-4" /> Add New Board
          </Link>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </div>
                  {item.unread && (
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-lg shadow-rose-500/50" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 mt-6">
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800/80 border border-slate-800 transition w-full"
          >
            <User className="w-4 h-4 text-purple-400" /> Owner Profile
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition w-full"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 md:p-10 overflow-x-hidden">{children}</main>

      {showProfileModal && currentUser && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}