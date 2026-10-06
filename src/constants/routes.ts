export enum AuthRoutes {
  Login = '/login',
  LoginWithCode = '/login-with-code',
  Register = '/register',
  ForgotPassword = '/forgot-password',
}

export enum PublicRoutes {
  PrivacyPolicy = '/privacy',
  TermsConditions = '/terms',
  Masjid = '/masjid/:id',
}

export enum AppRoutes {
  Display = '/',
  DisplayLogout = '/logout',
  Home = '/admin',
  ResetPassword = '/admin/reset-password',
  Announcements = '/admin/announcements',
  Events = '/admin/events',
  Posts = '/admin/posts',
  YouTubeVideos = '/admin/youtube-videos',
  PrayerTimings = '/admin/prayer-timings',
  Screens = '/admin/screens',
  ScreenDetail = '/admin/screens/:id',
  ScreenCustomTheme = '/admin/screens/:id/customize-theme',
  Settings = '/admin/settings',
  SettingsProfile = '/admin/settings/profile',
  SettingsAlkhairiaApp = '/admin/settings/alkhairia-app',

  SettingsAccount = '/admin/settings/account',
  Moderators = '/admin/moderators',
  Support = '/admin/support',
  AyatAndHadith = '/admin/ayat-and-hadith',
  AyatAndHadithNew = '/admin/ayat-and-hadith/new',
  AyatAndHadithEdit = '/admin/ayat-and-hadith/:id/edit',
}
