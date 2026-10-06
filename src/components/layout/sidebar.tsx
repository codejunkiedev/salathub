import { NavLink, useLocation } from 'react-router';
import {
  ChevronLeft,
  Home,
  Bell,
  BookOpen,
  Clock,
  Settings,
  X,
  Images,
  Tickets,
  Monitor,
  Video,
  LifeBuoy,
  Users,
} from 'lucide-react';
import { AppRoutes } from '@/constants';
import { Button } from '@/components/ui';
import { cn } from '@/utils';
import { useSidebarState } from '@/hooks';
import { useAuthStore } from '@/store';

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

/**
 * Navigation sidebar component with collapsible functionality and responsive design
 */
export default function Sidebar({ onClose, isMobile = false }: SidebarProps) {
  const [collapsed, toggleSidebar] = useSidebarState(false);
  const location = useLocation();
  const role = useAuthStore(s => s.role);
  const masjidId = useAuthStore(s => s.masjidId);

  /**
   * Determines if a navigation item should be active
   * Handles child route matching for parent nav items
   */
  const isNavItemActive = (path: string) => {
    // For home route, only exact match to avoid matching other admin routes
    if (path === AppRoutes.Home) {
      return location.pathname === path;
    }

    // For other routes, check if current path matches exactly or is a child route
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isAdmin = role === 'admin';
  const needsOnboarding = !masjidId;

  const contentNavItems = needsOnboarding
    ? []
    : [
        {
          label: 'Announcements',
          path: AppRoutes.Announcements,
          icon: <Bell size={20} />,
        },
        {
          label: 'Events',
          path: AppRoutes.Events,
          icon: <Tickets size={20} />,
        },
        {
          label: 'Posts',
          path: AppRoutes.Posts,
          icon: <Images size={20} />,
        },
        {
          label: 'YouTube Videos',
          path: AppRoutes.YouTubeVideos,
          icon: <Video size={20} />,
        },
        {
          label: 'Ayat & Hadith',
          path: AppRoutes.AyatAndHadith,
          icon: <BookOpen size={20} />,
        },
      ];

  const adminNavItems = !isAdmin
    ? []
    : needsOnboarding
      ? [
          {
            label: 'Settings',
            path: AppRoutes.Settings,
            icon: <Settings size={20} />,
          },
        ]
      : [
          {
            label: 'Screens',
            path: AppRoutes.Screens,
            icon: <Monitor size={20} />,
          },
          {
            label: 'Prayer Timings',
            path: AppRoutes.PrayerTimings,
            icon: <Clock size={20} />,
          },
          {
            label: 'Settings',
            path: AppRoutes.Settings,
            icon: <Settings size={20} />,
          },
          {
            label: 'Moderators',
            path: AppRoutes.Moderators,
            icon: <Users size={20} />,
          },
          {
            label: 'Support',
            path: AppRoutes.Support,
            icon: <LifeBuoy size={20} />,
          },
        ];

  const allNavItems = [
    {
      label: 'Home',
      path: AppRoutes.Home,
      icon: <Home size={20} />,
    },
    ...contentNavItems,
    ...adminNavItems,
  ];

  const navItems = allNavItems;

  return (
    <div className='relative h-screen flex overflow-hidden'>
      {/* Main Sidebar */}
      <aside
        className={cn(
          'h-full bg-gradient-to-b from-slate-800 to-slate-900 text-white transition-width duration-300 ease-in-out flex flex-col border-r border-slate-700/50 shadow-lg z-10 overflow-hidden',
          collapsed && !isMobile ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className='p-4 flex items-center justify-between border-b border-slate-700/50'>
          <div
            className={cn(
              'flex items-center',
              collapsed && !isMobile ? 'w-full justify-center cursor-pointer' : ''
            )}
            onClick={collapsed && !isMobile ? toggleSidebar : undefined}
            title={collapsed && !isMobile ? 'Expand Sidebar' : undefined}
          >
            <img
              src='/icons/icon-192.png'
              alt=''
              className={cn(
                'w-8 h-8 min-w-[32px] transition-transform duration-200',
                collapsed && !isMobile ? 'hover:scale-110 mx-auto' : ''
              )}
            />
            <div
              className={cn(
                'ml-3 overflow-hidden transition-all duration-300 ease-in-out',
                collapsed && !isMobile ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'
              )}
            >
              <h1 className='text-xl font-semibold whitespace-nowrap'>SalatHub</h1>
            </div>
          </div>

          {isMobile ? (
            <Button
              variant='ghost'
              size='icon'
              className='text-white hover:bg-slate-700/50'
              onClick={onClose}
            >
              <X size={20} />
            </Button>
          ) : (
            !collapsed && (
              <Button
                variant='ghost'
                size='icon'
                className='text-white hover:bg-slate-700/50'
                onClick={toggleSidebar}
                aria-label='Collapse sidebar'
              >
                <ChevronLeft size={18} className='text-emerald-400' />
              </Button>
            )
          )}
        </div>

        {/* Navigation */}
        <nav className='flex-1 overflow-y-auto scrollbar-custom py-4'>
          <ul className={cn('space-y-1', collapsed && !isMobile ? 'px-2' : 'px-3')}>
            {navItems.map(item => {
              const isActive = isNavItemActive(item.path);

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={cn(
                      'flex items-center rounded-md px-3 py-2.5 transition-all',
                      isActive
                        ? 'bg-slate-700/70 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-700/40 hover:text-white',
                      collapsed && !isMobile ? 'justify-center px-2' : 'space-x-3'
                    )}
                    onClick={isMobile ? onClose : undefined}
                    title={collapsed && !isMobile ? item.label : undefined}
                  >
                    <span
                      className={cn(
                        'transition-transform duration-200 flex-shrink-0',
                        isActive ? 'text-emerald-400 scale-110' : '',
                        collapsed && !isMobile && isActive ? 'scale-125' : ''
                      )}
                    >
                      {item.icon}
                    </span>
                    <div
                      className={cn(
                        'transition-all duration-300 overflow-hidden',
                        collapsed && !isMobile ? 'w-0 opacity-0' : 'w-auto opacity-100'
                      )}
                    >
                      <span className='font-medium whitespace-nowrap'>{item.label}</span>
                    </div>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
