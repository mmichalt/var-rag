import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Football VAR Decision Explorer',
  description:
    'Evidence-first explorer for football laws, VAR incidents, and official explanations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
