import { Menu, LogOut } from 'lucide-react';
import { Button, ThemeToggle } from '@/components/ui';
import { useState } from 'react';
import { SignOutModal } from '@/components/modals';
import { cn } from '@/utils';

interface HeaderProps {
  onMenuClick: () => void;
  isScrolled?: boolean;
}

/**
 * Application header with menu toggle, branding, theme toggle and sign out
 */
export default function Header({ onMenuClick, isScrolled = false }: HeaderProps) {
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  /**
   * Opens the sign out confirmation dialog
   */
  const openSignOutDialog = () => {
    setShowSignOutDialog(true);
  };

  /**
   * Closes the sign out confirmation dialog
   */
  const closeSignOutDialog = () => {
    setShowSignOutDialog(false);
  };

  return (
    <header
      className={cn(
        'bg-background h-16 flex items-center px-4 sticky top-0 z-30 transition-all duration-200 border-b',
        isScrolled ? 'shadow-md' : 'shadow-sm'
      )}
    >
      <Button variant='ghost' size='icon' className='md:hidden mr-2' onClick={onMenuClick}>
        <Menu size={20} />
      </Button>

      <h1 className='text-xl font-semibold md:ml-1 text-foreground'>SalatHub</h1>

      <div className='ml-auto flex items-center space-x-2'>
        <ThemeToggle />
        <Button
          variant='ghost'
          size='icon'
          onClick={openSignOutDialog}
          aria-label='Sign out'
          title='Sign out'
          className='text-muted-foreground hover:text-red-600'
        >
          <LogOut size={20} />
        </Button>
      </div>

      <SignOutModal isOpen={showSignOutDialog} onClose={closeSignOutDialog} />
    </header>
  );
}
