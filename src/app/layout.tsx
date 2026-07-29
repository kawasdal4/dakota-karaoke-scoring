import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/navbar';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: 'Dakota Karaoke Scoring System',
  description: 'PWA Mobile Scoring Application for Live Karaoke Competitions',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dakota Scoring',
  },
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 flex flex-col items-center min-h-screen">
        <ToastProvider>
          {/* Smartphone Container Shell - Max width 430px */}
          <div className="w-full max-w-[430px] min-h-screen bg-slate-950 flex flex-col border-x border-slate-800/60 shadow-2xl relative">
            <Navbar />
            <main className="flex-1 pb-24">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
