import type { ReactNode } from 'react';
import { Link } from 'react-router';
// Direct imports, not barrels: this page is pre-rendered in Node and the ui barrel pulls in Leaflet.
import { PublicRoutes } from '@/constants/routes';
import { AuthHeader } from '@/components/common/auth-header';

type LegalLayoutProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className='min-h-screen bg-background'>
      <AuthHeader />

      <main className='mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12'>
        <div className='mb-8 space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>{title}</h1>
          <p className='text-sm text-muted-foreground'>Last updated: {lastUpdated}</p>
        </div>

        <article
          className='space-y-6 text-sm leading-relaxed text-foreground/90
            [&_h2]:mt-8 [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground
            [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground
            [&_p]:my-3
            [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
            [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1
            [&_a]:text-emerald-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-emerald-700
            [&_strong]:font-semibold [&_strong]:text-foreground'
        >
          {children}
        </article>

        <footer className='mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground sm:flex-row'>
          <div className='flex items-center gap-4'>
            <Link
              to={PublicRoutes.PrivacyPolicy}
              className='hover:text-foreground hover:underline underline-offset-4'
            >
              Privacy Policy
            </Link>
            <Link
              to={PublicRoutes.TermsConditions}
              className='hover:text-foreground hover:underline underline-offset-4'
            >
              Terms &amp; Conditions
            </Link>
          </div>
          <span>&copy; {new Date().getFullYear()} SalatHub</span>
        </footer>
      </main>
    </div>
  );
}
