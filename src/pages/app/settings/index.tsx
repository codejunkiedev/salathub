import { Link } from 'react-router';
import { UserRound, Shield, Smartphone, BadgeCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { AppRoutes } from '@/constants';
import { PageHeader } from '@/components/common';
import { useAuthStore } from '@/store';

const settingsModules = [
  {
    title: 'Profile',
    description: 'Manage masjid profile, logo, and location',
    icon: UserRound,
    route: AppRoutes.SettingsProfile,
    color: 'text-orange-600',
    requiresMasjid: false,
  },
  {
    title: 'Verification',
    description: 'Send the documents our team needs to verify the masjid',
    icon: BadgeCheck,
    route: AppRoutes.SettingsVerification,
    color: 'text-sky-600',
    requiresMasjid: true,
  },
  {
    title: 'Alkhairia App',
    description: 'List the masjid in the mobile app and get its follow QR',
    icon: Smartphone,
    route: AppRoutes.SettingsAlkhairiaApp,
    color: 'text-emerald-600',
    requiresMasjid: true,
  },
  {
    title: 'Account',
    description: 'Manage your email address and password',
    icon: Shield,
    route: AppRoutes.SettingsAccount,
    color: 'text-red-600',
    requiresMasjid: false,
  },
];

export default function Settings() {
  const masjidId = useAuthStore(s => s.masjidId);
  const visibleModules = masjidId
    ? settingsModules
    : settingsModules.filter(m => !m.requiresMasjid);

  return (
    <div className='container mx-auto py-6 space-y-4'>
      <PageHeader
        title='Settings'
        description='Configure your application preferences and display settings'
      />

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {visibleModules.map(module => {
          const Icon = module.icon;
          return (
            <Link key={module.title} to={module.route} className='block'>
              <Card className='h-full hover:shadow-md transition-shadow cursor-pointer gap-4'>
                <CardHeader>
                  <div className='flex items-center gap-3'>
                    <Icon className={`h-8 w-8 ${module.color}`} />
                    <div>
                      <CardTitle className='text-lg'>{module.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className='text-sm'>{module.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
