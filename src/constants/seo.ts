import { AuthRoutes, PublicRoutes } from './routes';

export const SITE_URL = 'https://salathub.alkhairia.org';

export type PageMeta = { title: string; description: string };

export const PAGE_META = {
  [PublicRoutes.Landing]: {
    title: 'SalatHub – Digital prayer time screens for your masjid',
    description:
      'SalatHub turns any TV or tablet into a prayer-time display for your masjid. Manage iqamah times, announcements and events from one console.',
  },
  [PublicRoutes.PrivacyPolicy]: {
    title: 'Privacy Policy – SalatHub',
    description: 'How SalatHub and the Alkhairia app collect, use and protect your information.',
  },
  [PublicRoutes.TermsConditions]: {
    title: 'Terms & Conditions – SalatHub',
    description: 'The terms that govern your use of SalatHub and its related services.',
  },
  [PublicRoutes.RefundPolicy]: {
    title: 'Refund Policy – SalatHub',
    description:
      'When you can get a refund for a SalatHub Pro subscription, and how to ask for one.',
  },
  [AuthRoutes.Login]: {
    title: 'Sign in – SalatHub',
    description: 'Sign in to the SalatHub console to manage your masjid’s screens.',
  },
  [AuthRoutes.Register]: {
    title: 'Register your masjid – SalatHub',
    description: 'Create a SalatHub account and put prayer times on every screen in your masjid.',
  },
  [AuthRoutes.LoginWithCode]: {
    title: 'Connect a screen – SalatHub',
    description: 'Sign a display screen in to SalatHub with its screen code.',
  },
} satisfies Record<string, PageMeta>;

export const PRERENDERED_PATHS = [
  PublicRoutes.Landing,
  PublicRoutes.PrivacyPolicy,
  PublicRoutes.TermsConditions,
  PublicRoutes.RefundPolicy,
] as const;
