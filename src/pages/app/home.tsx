import { Bell, Clock, Settings, Images, Tickets, User } from 'lucide-react';
import { AppRoutes } from '@/constants';
import { ModuleCard, QuickActionButton, WelcomeHeader, SectionTitle } from '@/components/home';
import { useAuthStore } from '@/store';

export default function Home() {
  const role = useAuthStore(s => s.role);
  const masjidId = useAuthStore(s => s.masjidId);
  const isAdmin = role === 'admin';
  const needsOnboarding = !masjidId;

  if (needsOnboarding) {
    return (
      <div className='container mx-auto py-8 space-y-6'>
        <WelcomeHeader
          title='Welcome to SalatHub'
          subtitle='Set up your masjid profile to get started'
        />
        <ModuleCard
          title='Masjid Profile'
          description='Add your masjid name, area, and location so you can start managing content.'
          icon={<User className='h-10 w-10 text-primary' />}
          path={AppRoutes.SettingsProfile}
          color='bg-emerald-50 dark:bg-emerald-950/30'
        />
      </div>
    );
  }

  const modules = [
    ...(isAdmin
      ? [
          {
            title: 'Prayer Timings',
            description: 'Manage prayer times for your masjid',
            icon: <Clock className='h-10 w-10 text-primary' />,
            path: AppRoutes.PrayerTimings,
            color: 'bg-red-50 dark:bg-red-950/30',
          },
        ]
      : []),
    {
      title: 'Announcements',
      description: 'Create and manage masjid announcements for your community',
      icon: <Bell className='h-10 w-10 text-primary' />,
      path: AppRoutes.Announcements,
      color: 'bg-green-50 dark:bg-green-950/30',
    },
  ];

  const quickActions = [
    {
      title: 'Schedule Event',
      description: 'Plan your next gathering',
      icon: <Tickets className='h-5 w-5' />,
      path: AppRoutes.Events,
    },
    {
      title: 'Add Post',
      description: 'Share content with your community',
      icon: <Images className='h-5 w-5' />,
      path: AppRoutes.Posts,
    },
    ...(isAdmin
      ? [
          {
            title: 'Update Profile',
            description: 'Manage your masjid information',
            icon: <User className='h-5 w-5' />,
            path: AppRoutes.SettingsProfile,
          },
          {
            title: 'Settings',
            description: 'Update the display settings',
            icon: <Settings className='h-5 w-5' />,
            path: AppRoutes.Settings,
          },
        ]
      : []),
  ];

  return (
    <div className='container mx-auto py-8 space-y-8'>
      <WelcomeHeader
        title='Welcome to SalatHub'
        subtitle="Manage all your masjid's digital needs in one place"
      />

      <div className='overflow-x-auto pb-4'>
        <div className='flex md:grid md:grid-cols-3 gap-6' style={{ minWidth: 'min-content' }}>
          {modules.map((module, index) => (
            <div key={module.path} className='w-[320px] md:w-auto flex-shrink-0'>
              <ModuleCard
                title={module.title}
                description={module.description}
                icon={module.icon}
                path={module.path}
                color={module.color}
                key={index}
              />
            </div>
          ))}
        </div>
      </div>

      <div className='mt-12'>
        <SectionTitle title='Quick Actions' />
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          {quickActions.map((action, index) => (
            <QuickActionButton
              key={index}
              title={action.title}
              description={action.description}
              icon={action.icon}
              path={action.path}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
