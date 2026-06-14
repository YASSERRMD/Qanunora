import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Qanunora — Legislative Intelligence Platform',
    template: '%s | Qanunora',
  },
  description:
    'Government Legislative Intelligence Platform for managing the full legislative lifecycle.',
  keywords: ['legislative', 'government', 'law', 'bills', 'amendments', 'compliance'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
