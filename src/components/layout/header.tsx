import { Menu, LogOut, UserRound } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  ThemeToggle,
} from '@/components/ui';
import { useState } from 'react';
import { SignOutModal } from '@/components/modals';
import { cn } from '@/utils';

interface HeaderProps {
  onMenuClick: () => void;
  isScrolled?: boolean;
}

/**
 * Application header component with menu toggle, branding, and user dropdown menu
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:bg-accent rounded-full'
            >
              <UserRound size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuItem
              onClick={openSignOutDialog}
              className='cursor-pointer text-red-600 focus:text-red-600'
            >
              <LogOut className='mr-2 h-4 w-4 text-red-600 hover:text-red-600' />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SignOutModal isOpen={showSignOutDialog} onClose={closeSignOutDialog} />
    </header>
  );
}
