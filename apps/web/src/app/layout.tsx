import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'rant — the OS for modern software teams',
  description:
    'Plan, develop, deploy, monitor, and maintain software in one connected platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
