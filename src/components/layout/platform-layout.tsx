import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { LogOut } from 'lucide-react';
import { Button, buttonVariants, ThemeToggle } from '@/components/ui';
import { SignOutModal } from '@/components/modals';
import { AppRoutes, PlatformRoutes } from '@/constants';
import { useAuthStore } from '@/store';
import { cn } from '@/utils';

const NAV_ITEMS = [
  { label: 'Review queue', path: PlatformRoutes.Queue, end: true },
  { label: 'Masjids', path: PlatformRoutes.Masjids, end: false },
  { label: 'Reports', path: PlatformRoutes.Reports, end: true },
];

/** The SalatHub team's own area. Masjid users never reach it. */
export default function PlatformLayout() {
  const masjidId = useAuthStore(s => s.masjidId);
  const [showSignOut, setShowSignOut] = useState(false);

  return (
    <div className='min-h-screen bg-background'>
      <header className='sticky top-0 z-30 border-b bg-background'>
        <div className='max-w-7xl mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3'>
          <h1 className='text-lg font-semibold'>SalatHub Platform</h1>
          <nav className='flex flex-wrap gap-1'>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className='ml-auto flex items-center gap-2'>
            {masjidId && (
              <NavLink
                to={AppRoutes.Home}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Masjid console
              </NavLink>
            )}
            <ThemeToggle />
            <Button
              variant='ghost'
              size='icon'
              aria-label='Sign out'
              onClick={() => setShowSignOut(true)}
            >
              <LogOut className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </header>
      <main className='max-w-7xl mx-auto p-4 md:p-6 lg:p-8'>
        <Outlet />
      </main>
      <SignOutModal isOpen={showSignOut} onClose={() => setShowSignOut(false)} />
    </div>
  );
}
