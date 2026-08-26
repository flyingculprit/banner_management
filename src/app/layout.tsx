import './globals.css';
import { NotificationProvider } from '@/context/NotificationContext';

export const metadata = {
  title: 'AdFlex AI - Outdoor Billboard Management',
  description: 'AI-driven flex space management, valuation, and verification platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <NotificationProvider>{children}</NotificationProvider>
      </body>
    </html>
  );
}