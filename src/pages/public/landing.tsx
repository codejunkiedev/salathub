import { Link } from 'react-router';
import {
  BellRing,
  BookOpen,
  CalendarDays,
  Clock,
  Languages,
  Megaphone,
  MonitorSmartphone,
  QrCode,
  Smartphone,
  Tv,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { buttonVariants, ThemeToggle } from '@/components/ui';
import { AppRoutes, AuthRoutes, PublicRoutes } from '@/constants';
import { ALKHAIRIA_PLAY_STORE_URL } from '@/helpers';
import { useAuthStore } from '@/store';

type Feature = { icon: LucideIcon; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: Clock,
    title: 'Prayer times, always right',
    body: 'Calculated for your location and timezone, with your own iqamah times and Jumma. Pick a ready-made theme or design your own.',
  },
  {
    icon: Megaphone,
    title: 'Announcements & events',
    body: 'Post a notice once and choose which screens show it. Schedule events and take them down when they are over.',
  },
  {
    icon: BookOpen,
    title: 'Ayat & Hadith designer',
    body: 'Lay out verses and hadith on a canvas with your own backgrounds and fonts, ready for landscape or portrait screens.',
  },
  {
    icon: Video,
    title: 'Posts & videos',
    body: 'Show images and YouTube videos between slides. Videos play through, then the slideshow carries on.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Every screen its own playlist',
    body: 'Run as many screens as you need. Each has its own theme, language, slide timing and running order.',
  },
  {
    icon: Users,
    title: 'Your whole team',
    body: 'Invite moderators to keep content fresh while admins look after prayer times, screens and settings.',
  },
];

const STEPS = [
  {
    title: 'Register your masjid',
    body: 'Create an account and add your masjid’s name, location and prayer settings.',
  },
  {
    title: 'Add your content',
    body: 'Set iqamah times and add announcements, events, posts and ayat & hadith.',
  },
  {
    title: 'Connect a screen',
    body: 'Open SalatHub on any TV or tablet browser and sign in with the screen’s code.',
  },
];

const PRAYERS = [
  { name: 'Fajr', adhan: '5:12', iqamah: '5:45' },
  { name: 'Dhuhr', adhan: '12:24', iqamah: '1:30', next: true },
  { name: 'Asr', adhan: '3:18', iqamah: '3:45' },
  { name: 'Maghrib', adhan: '5:41', iqamah: '5:46' },
  { name: 'Isha', adhan: '7:02', iqamah: '7:45' },
];

function DisplayPreview() {
  return (
    <div className='relative mx-auto w-full max-w-xl'>
      <div className='rounded-2xl border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl dark:border-neutral-800'>
        <div className='overflow-hidden rounded-md bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-4 text-white sm:p-6'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-[10px] uppercase tracking-widest text-emerald-200 sm:text-xs'>
                Your Masjid
              </p>
              <p className='text-2xl font-semibold tabular-nums sm:text-4xl'>12:06</p>
            </div>
            <div className='text-right text-[10px] text-emerald-100 sm:text-xs'>
              <p>Wednesday</p>
              <p>20 Jumada al-Ula 1448</p>
            </div>
          </div>

          <div className='mt-4 grid grid-cols-5 gap-1.5 sm:mt-6 sm:gap-2'>
            {PRAYERS.map(p => (
              <div
                key={p.name}
                className={`rounded-lg px-1 py-2 text-center sm:py-3 ${
                  p.next ? 'bg-amber-400 text-emerald-950' : 'bg-white/10'
                }`}
              >
                <p className='text-[9px] font-medium sm:text-xs'>{p.name}</p>
                <p className='text-sm font-semibold tabular-nums sm:text-lg'>{p.iqamah}</p>
                <p className='text-[8px] tabular-nums opacity-70 sm:text-[10px]'>{p.adhan}</p>
              </div>
            ))}
          </div>

          <p className='mt-3 text-center text-[10px] text-emerald-100 sm:mt-4 sm:text-xs'>
            Dhuhr iqamah in 1h 24m
          </p>
        </div>
      </div>
      <div className='mx-auto h-4 w-24 rounded-b-lg bg-neutral-800' />
    </div>
  );
}

export default function Landing() {
  const signedIn = useAuthStore(s => s.role !== null);

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <header className='sticky top-0 z-10 border-b bg-background/80 backdrop-blur'>
        <div className='mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6'>
          <Link to={PublicRoutes.Landing} className='flex items-center gap-2'>
            <img src='/icons/icon-192.png' alt='' className='h-8 w-8' />
            <span className='text-lg font-semibold'>SalatHub</span>
          </Link>
          <nav className='flex items-center gap-2'>
            <ThemeToggle />
            {signedIn ? (
              <Link to={AppRoutes.Home} className={buttonVariants()}>
                Open console
              </Link>
            ) : (
              <>
                <Link
                  to={AuthRoutes.Login}
                  className={buttonVariants({
                    variant: 'ghost',
                    className: 'hidden sm:inline-flex',
                  })}
                >
                  Sign in
                </Link>
                <Link to={AuthRoutes.Register} className={buttonVariants()}>
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className='mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24'>
          <div className='space-y-6 text-center lg:text-left'>
            <span className='inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground'>
              <Tv size={14} className='text-emerald-600' />
              Digital screens for your masjid
            </span>
            <h1 className='text-4xl font-bold tracking-tight sm:text-5xl'>
              Prayer times and notices on every screen in your masjid
            </h1>
            <p className='mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0'>
              SalatHub turns any TV or tablet into a prayer-time display. Update iqamah times,
              announcements and events from your phone or computer, and every screen follows.
            </p>
            <div className='flex flex-col justify-center gap-3 sm:flex-row lg:justify-start'>
              <Link to={AuthRoutes.Register} className={buttonVariants({ size: 'lg' })}>
                Register your masjid
              </Link>
              <Link
                to={AuthRoutes.LoginWithCode}
                className={buttonVariants({ size: 'lg', variant: 'outline' })}
              >
                Connect a screen
              </Link>
            </div>
          </div>
          <DisplayPreview />
        </section>

        <section className='border-y bg-muted/40'>
          <div className='mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20'>
            <div className='mx-auto max-w-2xl space-y-3 text-center'>
              <h2 className='text-3xl font-bold tracking-tight'>Everything your screens need</h2>
              <p className='text-muted-foreground'>
                One console for the people who run the masjid. One slideshow for everyone who walks
                in.
              </p>
            </div>
            <div className='mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className='rounded-xl border bg-card p-6 shadow-sm'>
                  <div className='mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600'>
                    <Icon size={20} />
                  </div>
                  <h3 className='font-semibold'>{title}</h3>
                  <p className='mt-2 text-sm text-muted-foreground'>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20'>
          <div className='mx-auto max-w-2xl space-y-3 text-center'>
            <h2 className='text-3xl font-bold tracking-tight'>Up and running in minutes</h2>
            <p className='text-muted-foreground'>
              No special hardware. Smart TVs, Android TV boxes and tablets all work.
            </p>
          </div>
          <ol className='mt-12 grid gap-6 md:grid-cols-3'>
            {STEPS.map((step, i) => (
              <li key={step.title} className='space-y-3 text-center md:text-left'>
                <span className='inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground'>
                  {i + 1}
                </span>
                <h3 className='font-semibold'>{step.title}</h3>
                <p className='text-sm text-muted-foreground'>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className='border-y bg-muted/40'>
          <div className='mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20'>
            <div className='space-y-4 text-center lg:text-left'>
              <h2 className='text-3xl font-bold tracking-tight'>
                Reach your community beyond the walls
              </h2>
              <p className='text-muted-foreground'>
                Worshippers follow your masjid in the Alkhairia app to see its prayer times and
                content wherever they are.
              </p>
              <a
                href={ALKHAIRIA_PLAY_STORE_URL}
                target='_blank'
                rel='noreferrer'
                className={buttonVariants({ variant: 'outline' })}
              >
                <Smartphone />
                Get Alkhairia on Google Play
              </a>
            </div>
            <ul className='grid gap-4 sm:grid-cols-2'>
              {[
                {
                  icon: QrCode,
                  title: 'Follow by QR',
                  body: 'Your screens can show a QR code people scan to follow your masjid.',
                },
                {
                  icon: BellRing,
                  title: 'Push notifications',
                  body: 'Followers hear when prayer times change and when you post something new.',
                },
                {
                  icon: CalendarDays,
                  title: 'Events in their pocket',
                  body: 'Announcements, events and posts you choose appear in the app too.',
                },
                {
                  icon: Languages,
                  title: 'Their language',
                  body: 'Screens can show prayer times in English, Urdu or Arabic.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <li key={title} className='rounded-xl border bg-card p-5'>
                  <Icon size={20} className='text-emerald-600' />
                  <h3 className='mt-3 font-semibold'>{title}</h3>
                  <p className='mt-1 text-sm text-muted-foreground'>{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className='mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24'>
          <h2 className='text-3xl font-bold tracking-tight'>Bring your masjid’s screens to life</h2>
          <p className='mt-3 text-muted-foreground'>
            Set up your masjid today and have your first screen running before the next prayer.
          </p>
          <div className='mt-8 flex flex-col justify-center gap-3 sm:flex-row'>
            <Link to={AuthRoutes.Register} className={buttonVariants({ size: 'lg' })}>
              Register your masjid
            </Link>
            <Link
              to={AuthRoutes.Login}
              className={buttonVariants({ size: 'lg', variant: 'outline' })}
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className='border-t'>
        <div className='mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6'>
          <span>&copy; {new Date().getFullYear()} SalatHub</span>
          <div className='flex items-center gap-4'>
            <Link
              to={PublicRoutes.PrivacyPolicy}
              className='underline-offset-4 hover:text-foreground hover:underline'
            >
              Privacy Policy
            </Link>
            <Link
              to={PublicRoutes.TermsConditions}
              className='underline-offset-4 hover:text-foreground hover:underline'
            >
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
