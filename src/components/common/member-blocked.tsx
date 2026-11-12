import { useState } from 'react';
import { LogOut, UserLock } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { signOut } from '@/lib/supabase';

/** Shown instead of the console to a moderator whose masjid is on the Free plan. */
export function MemberBlocked() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-background px-4'>
      <Card className='w-full max-w-md'>
        <CardContent className='flex flex-col items-center gap-4 py-8 text-center'>
          <UserLock className='h-10 w-10 text-muted-foreground' />
          <div className='space-y-2'>
            <h1 className='text-lg font-semibold'>The console isn't available</h1>
            <p className='text-sm text-muted-foreground'>
              Your masjid is on the Free plan, so moderators can't use the console. Ask your masjid
              admin.
            </p>
          </div>
          <Button variant='outline' onClick={handleSignOut} disabled={isSigningOut}>
            <LogOut className='h-4 w-4' />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
