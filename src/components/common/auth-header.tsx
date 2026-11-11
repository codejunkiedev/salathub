import { Link, useLocation } from 'react-router';
import { buttonVariants, ThemeToggle } from '@/components/ui';
import { AuthRoutes, PublicRoutes } from '@/constants';

export function AuthHeader() {
  const { pathname } = useLocation();
  const onRegister = pathname === AuthRoutes.Register;

  return (
    <header className='border-b'>
      <div className='mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6'>
        <Link to={PublicRoutes.Landing} className='flex items-center gap-2'>
          <img src='/icons/icon-192.png' alt='' className='h-8 w-8' />
          <span className='text-lg font-semibold'>SalatHub</span>
        </Link>
        <nav className='flex items-center gap-2'>
          <ThemeToggle />
          {onRegister ? (
            <Link to={AuthRoutes.Login} className={buttonVariants()}>
              Sign in
            </Link>
          ) : (
            <Link to={AuthRoutes.Register} className={buttonVariants()}>
              Get started
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
