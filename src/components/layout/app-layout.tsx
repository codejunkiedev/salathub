import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router';
import Sidebar from './sidebar';
import Header from './header';
import VerificationBanner from './verification-banner';

/**
 * Main application layout component providing the structure for authenticated pages
 * Includes responsive sidebar navigation, header, and content area
 * Handles mobile sidebar state and keyboard navigation
 */
export default function AppLayout() {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowMobileSidebar(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showMobileSidebar) {
        setShowMobileSidebar(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showMobileSidebar]);

  useEffect(() => {
    if (showMobileSidebar) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileSidebar]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setShowMobileSidebar(prev => !prev);
  }, []);

  return (
    <div className='flex h-screen bg-background'>
      {/* Desktop sidebar */}
      <div className='hidden md:block relative z-10'>
        <Sidebar />
      </div>

      {/* Mobile sidebar with overlay */}
      {showMobileSidebar && (
        <div
          className='md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity duration-300'
          onClick={toggleMobileSidebar}
          aria-hidden='true'
        />
      )}

      <div
        className='md:hidden fixed inset-y-0 left-0 z-50 max-w-[280px] w-[80%] transform transition-all duration-300 ease-in-out shadow-xl'
        style={{
          transform: showMobileSidebar ? 'translateX(0)' : 'translateX(-100%)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <Sidebar onClose={toggleMobileSidebar} isMobile={true} />
      </div>

      <div className='flex flex-col flex-1 overflow-hidden'>
        <Header onMenuClick={toggleMobileSidebar} isScrolled={isScrolled} />

        <main className='flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background transition-all duration-300'>
          <div className='max-w-7xl mx-auto'>
            <VerificationBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
