import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { useEffect, useState, Suspense } from 'react';
import { getCurrentSession, getMasjidMembership, updateLastActive } from '@/lib/supabase';
import { subscribeToAuthChanges } from '@/lib/supabase';
import { identifySentryUser, clearSentryUser } from '@/lib/sentry';
import { AppRoutes, AuthRoutes, PublicRoutes } from '@/constants';
import { AppLayout } from '@/components/layout';
import {
  Announcements,
  AyatAndHadith,
  AyatHadithDesigner,
  CustomThemeEditor,
  Events,
  ForgotPassword,
  Home,
  Loading,
  Login,
  Moderators,
  NotifyFollowers,
  Posts,
  Register,
  ResetPassword,
  Screens,
  ScreenDetail,
  Settings,
  SettingsProfile,
  SettingsAlkhairiaApp,
  SettingsAccount,
  PrayerTimings,
  Display,
  DisplayLogout,
  LoginWithCode,
  YouTubeVideos,
  Support,
  PrivacyPolicy,
  TermsConditions,
  MasjidFollow,
} from '@/pages';
import { useDisplayStore, useAuthStore } from '@/store';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const role = useAuthStore(s => s.role);
  if (role !== 'admin') return <Navigate to={AppRoutes.Home} />;
  return <>{children}</>;
}

export default function Navigation() {
  const [isLoggedInWithEmail, setIsLoggedInWithEmail] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { loggedIn: isLoggedInWithCode } = useDisplayStore();
  const { setAuth, clearAuth } = useAuthStore();

  const route = isLoggedInWithEmail ? AppRoutes.Home : AppRoutes.Display;

  useEffect(() => {
    const checkUser = async () => {
      try {
        const session = await getCurrentSession();
        setIsLoggedInWithEmail(!!session);

        if (session?.user) {
          try {
            const membership = await getMasjidMembership();
            setAuth(membership.masjid_id, membership.role);
            identifySentryUser(session, membership.masjid_id, membership.role);
            updateLastActive();
          } catch {
            // Fresh signup: no membership yet. Grant transient admin with
            // a null masjidId so onboarding (Settings → Profile) is reachable.
            setAuth(null, 'admin');
            identifySentryUser(session, null, 'admin');
          }
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = subscribeToAuthChanges(async session => {
      setIsLoggedInWithEmail(!!session?.user);

      if (session?.user) {
        try {
          const membership = await getMasjidMembership();
          setAuth(membership.masjid_id, membership.role);
          identifySentryUser(session, membership.masjid_id, membership.role);
        } catch {
          setAuth(null, 'admin');
          identifySentryUser(session, null, 'admin');
        }
      } else {
        clearAuth();
        clearSentryUser();
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [setAuth, clearAuth]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public legal routes - accessible without authentication */}
          <Route path={PublicRoutes.PrivacyPolicy} element={<PrivacyPolicy />} />
          <Route path={PublicRoutes.TermsConditions} element={<TermsConditions />} />
          <Route path={PublicRoutes.Masjid} element={<MasjidFollow />} />

          {/* Email auth routes - only accessible when not logged in with email */}
          <Route element={isLoggedInWithEmail ? <Navigate to={AppRoutes.Home} /> : <Outlet />}>
            <Route path={AuthRoutes.Login} element={<Login />} />
            <Route path={AuthRoutes.Register} element={<Register />} />
            <Route path={AuthRoutes.ForgotPassword} element={<ForgotPassword />} />
          </Route>

          {/* Code auth route - only accessible when not logged in with code */}
          <Route element={isLoggedInWithCode ? <Navigate to={AppRoutes.Display} /> : <Outlet />}>
            <Route path={AuthRoutes.LoginWithCode} element={<LoginWithCode />} />
          </Route>

          {/* Admin routes WITHOUT layout - require authentication */}
          <Route element={isLoggedInWithEmail ? <Outlet /> : <Navigate to={AuthRoutes.Login} />}>
            <Route path={AppRoutes.AyatAndHadithNew} element={<AyatHadithDesigner />} />
            <Route path={AppRoutes.AyatAndHadithEdit} element={<AyatHadithDesigner />} />
            <Route
              path={AppRoutes.ScreenCustomTheme}
              element={
                <RequireAdmin>
                  <CustomThemeEditor />
                </RequireAdmin>
              }
            />
          </Route>

          {/* Admin routes with layout - require authentication */}
          <Route element={isLoggedInWithEmail ? <AppLayout /> : <Navigate to={AuthRoutes.Login} />}>
            <Route path={AppRoutes.Home} element={<Home />} />
            <Route path={AppRoutes.ResetPassword} element={<ResetPassword />} />
            <Route path={AppRoutes.SettingsAccount} element={<SettingsAccount />} />
            <Route path={AppRoutes.Announcements} element={<Announcements />} />
            <Route path={AppRoutes.Events} element={<Events />} />
            <Route path={AppRoutes.Posts} element={<Posts />} />
            <Route path={AppRoutes.YouTubeVideos} element={<YouTubeVideos />} />
            <Route path={AppRoutes.AyatAndHadith} element={<AyatAndHadith />} />
            <Route path={AppRoutes.NotifyFollowers} element={<NotifyFollowers />} />
            <Route
              path={AppRoutes.Screens}
              element={
                <RequireAdmin>
                  <Screens />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.ScreenDetail}
              element={
                <RequireAdmin>
                  <ScreenDetail />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.PrayerTimings}
              element={
                <RequireAdmin>
                  <PrayerTimings />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.Settings}
              element={
                <RequireAdmin>
                  <Settings />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.SettingsProfile}
              element={
                <RequireAdmin>
                  <SettingsProfile />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.SettingsAlkhairiaApp}
              element={
                <RequireAdmin>
                  <SettingsAlkhairiaApp />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.Moderators}
              element={
                <RequireAdmin>
                  <Moderators />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.Support}
              element={
                <RequireAdmin>
                  <Support />
                </RequireAdmin>
              }
            />
          </Route>

          {/* Display routes - require authentication */}
          <Route
            element={isLoggedInWithCode ? <Outlet /> : <Navigate to={AuthRoutes.LoginWithCode} />}
          >
            <Route path={AppRoutes.Display} element={<Display />} />
            <Route path={AppRoutes.DisplayLogout} element={<DisplayLogout />} />
          </Route>

          <Route path={'*'} element={<Navigate to={route} />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
