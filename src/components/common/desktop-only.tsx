import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Monitor } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type DesktopOnlyProps = {
  /** Where the back button goes. */
  backTo: string;
  backLabel: string;
  children: ReactNode;
};

/** Renders its children only on screens at least 1024px wide. */
export function DesktopOnly({ backTo, backLabel, children }: DesktopOnlyProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  if (isDesktop) return <>{children}</>;

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-6'>
      <div className='max-w-sm space-y-4 text-center'>
        <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted'>
          <Monitor className='h-6 w-6 text-muted-foreground' />
        </div>
        <h1 className='text-xl font-semibold'>Open this on a larger screen</h1>
        <p className='text-sm text-muted-foreground'>
          This editor needs a screen at least 1024px wide. Use a computer, or a tablet in landscape.
        </p>
        <Link to={backTo} className={buttonVariants({ variant: 'outline' })}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
