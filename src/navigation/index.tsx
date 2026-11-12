import { BrowserRouter, Navigate, Outlet, Route, Routes, type NavigateProps } from 'react-router';
import { useEffect, useState, Suspense } from 'react';
import {
  checkIsPlatformAdmin,
  getCurrentSession,
  getMyMembership,
  updateLastActive,
} from '@/lib/supabase';
import { subscribeToAuthChanges } from '@/lib/supabase';
import { identifySentryUser, clearSentryUser } from '@/lib/sentry';
import { AppRoutes, AuthRoutes, LoadingStep, PlatformRoutes, PublicRoutes } from '@/constants';
import type { Session } from '@supabase/supabase-js';
import { AppLayout, PlatformLayout } from '@/components/layout';
import { DesktopOnly, MemberBlocked } from '@/components/common';
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
  SettingsVerification,
  SettingsBilling,
  SettingsAccount,
  PrayerTimings,
  Display,
  DisplayLogout,
  LoginWithCode,
  YouTubeVideos,
  Support,
  PrivacyPolicy,
  TermsConditions,
  RefundPolicy,
  MasjidFollow,
  Landing,
  PlatformQueue,
  PlatformMasjids,
  PlatformMasjidDetail,
  PlatformReports,
} from '@/pages';
import { useDisplayStore, useAuthStore } from '@/store';
import { PageMeta, PrerenderCleanup, ScrollToTop } from './page-meta';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const role = useAuthStore(s => s.role);
  if (role !== 'admin') return <Navigate to={AppRoutes.Home} />;
  return <>{children}</>;
}

/**
 * Route changes run as transitions, so React keeps the old screen up while the
 * next page's code loads. A bare <Navigate> leaves nothing on screen, so keep
 * the loading screen up during a redirect instead of a blank page.
 */
function Redirect(props: NavigateProps) {
  return (
    <>
      <Navigate {...props} />
      <Loading progress={LoadingStep.Page} />
    </>
  );
}

export default function Navigation() {
  const [isLoggedInWithEmail, setIsLoggedInWithEmail] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bootProgress, setBootProgress] = useState<number>(LoadingStep.Session);
  const [memberBlocked, setMemberBlocked] = useState(false);

  const { loggedIn: isLoggedInWithCode } = useDisplayStore();
  const { setAuth, setPlatformAdmin, clearAuth, masjidId, isPlatformAdmin } = useAuthStore();

  // A platform admin who runs no masjid has nothing in the masjid console.
  const platformOnly = isPlatformAdmin && !masjidId;
  const home = platformOnly ? PlatformRoutes.Queue : AppRoutes.Home;
  const route = isLoggedInWithEmail
    ? home
    : isLoggedInWithCode
      ? AppRoutes.Display
      : PublicRoutes.Landing;

  useEffect(() => {
    const loadAccount = async (session: Session) => {
      const [platformAdmin, membership] = await Promise.all([
        checkIsPlatformAdmin(),
        getMyMembership().catch(() => null),
      ]);
      setPlatformAdmin(platformAdmin);
      setMemberBlocked(!!membership?.blocked);
      if (membership?.blocked) {
        setAuth(null, membership.role);
        return null;
      }
      if (membership) {
        setAuth(membership.masjid_id, membership.role);
        identifySentryUser(session, membership.masjid_id, membership.role);
      } else {
        // Fresh signup: no membership yet. Grant transient admin with
        // a null masjidId so onboarding (Settings → Profile) is reachable.
        setAuth(null, 'admin');
        identifySentryUser(session, null, 'admin');
      }
      return membership;
    };

    const checkUser = async () => {
      try {
        const session = await getCurrentSession();
        setIsLoggedInWithEmail(!!session);

        if (session?.user) {
          setBootProgress(LoadingStep.Account);
          if (await loadAccount(session)) updateLastActive();
        } else {
          clearAuth();
          clearSentryUser();
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
    } = subscribeToAuthChanges((session, event) => {
      // checkUser already handled the session this page loaded with, and a
      // token refresh changes nothing we track.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

      setIsLoggedInWithEmail(!!session?.user);

      if (session?.user) {
        void loadAccount(session);
      } else {
        clearAuth();
        clearSentryUser();
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [setAuth, setPlatformAdmin, clearAuth]);

  if (isLoading) {
    return (
      <Loading
        progress={bootProgress}
        label={
          bootProgress === LoadingStep.Account ? 'Loading your masjid' : 'Checking your sign-in'
        }
      />
    );
  }

  if (isLoggedInWithEmail && memberBlocked) return <MemberBlocked />;

  return (
    <BrowserRouter>
      <PageMeta />
      <ScrollToTop />
      <Suspense fallback={<Loading progress={LoadingStep.Page} />}>
        <PrerenderCleanup />
        <Routes>
          {/* Public legal routes - accessible without authentication */}
          <Route path={PublicRoutes.PrivacyPolicy} element={<PrivacyPolicy />} />
          <Route path={PublicRoutes.TermsConditions} element={<TermsConditions />} />
          <Route path={PublicRoutes.RefundPolicy} element={<RefundPolicy />} />
          <Route path={PublicRoutes.Masjid} element={<MasjidFollow />} />

          {/* Email auth routes - only accessible when not logged in with email */}
          <Route element={isLoggedInWithEmail ? <Redirect to={home} /> : <Outlet />}>
            <Route path={AuthRoutes.Login} element={<Login />} />
            <Route path={AuthRoutes.Register} element={<Register />} />
            <Route path={AuthRoutes.ForgotPassword} element={<ForgotPassword />} />
          </Route>

          {/* Code auth route - only accessible when not logged in with code */}
          <Route element={isLoggedInWithCode ? <Redirect to={AppRoutes.Display} /> : <Outlet />}>
            <Route path={AuthRoutes.LoginWithCode} element={<LoginWithCode />} />
          </Route>

          {/* Admin routes WITHOUT layout - require authentication */}
          <Route element={isLoggedInWithEmail ? <Outlet /> : <Redirect to={AuthRoutes.Login} />}>
            <Route
              path={AppRoutes.AyatAndHadithNew}
              element={
                <DesktopOnly backTo={AppRoutes.AyatAndHadith} backLabel='Back to Ayat & Hadith'>
                  <AyatHadithDesigner />
                </DesktopOnly>
              }
            />
            <Route
              path={AppRoutes.AyatAndHadithEdit}
              element={
                <DesktopOnly backTo={AppRoutes.AyatAndHadith} backLabel='Back to Ayat & Hadith'>
                  <AyatHadithDesigner />
                </DesktopOnly>
              }
            />
            <Route
              path={AppRoutes.ScreenCustomTheme}
              element={
                <RequireAdmin>
                  <DesktopOnly backTo={AppRoutes.Screens} backLabel='Back to Screens'>
                    <CustomThemeEditor />
                  </DesktopOnly>
                </RequireAdmin>
              }
            />
          </Route>

          {/* Admin routes with layout - require authentication */}
          <Route
            element={
              !isLoggedInWithEmail ? (
                <Redirect to={AuthRoutes.Login} />
              ) : isPlatformAdmin ? (
                <PlatformLayout />
              ) : (
                <Redirect to={AppRoutes.Home} />
              )
            }
          >
            <Route path={PlatformRoutes.Queue} element={<PlatformQueue />} />
            <Route path={PlatformRoutes.Masjids} element={<PlatformMasjids />} />
            <Route path={PlatformRoutes.Masjid} element={<PlatformMasjidDetail />} />
            <Route path={PlatformRoutes.Reports} element={<PlatformReports />} />
          </Route>

          <Route
            element={
              !isLoggedInWithEmail ? (
                <Redirect to={AuthRoutes.Login} />
              ) : platformOnly ? (
                <Redirect to={PlatformRoutes.Queue} />
              ) : (
                <AppLayout />
              )
            }
          >
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
            <Route path={AppRoutes.SettingsAlkhairiaApp} element={<SettingsAlkhairiaApp />} />
            <Route
              path={AppRoutes.SettingsVerification}
              element={
                <RequireAdmin>
                  <SettingsVerification />
                </RequireAdmin>
              }
            />
            <Route
              path={AppRoutes.SettingsBilling}
              element={
                <RequireAdmin>
                  <SettingsBilling />
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

          {/* Screens that still open the root (bookmarks, installed PWAs) go on to the display */}
          <Route
            path={PublicRoutes.Landing}
            element={isLoggedInWithCode ? <Redirect to={AppRoutes.Display} replace /> : <Landing />}
          />

          {/* Display routes - require authentication */}
          <Route
            element={isLoggedInWithCode ? <Outlet /> : <Redirect to={AuthRoutes.LoginWithCode} />}
          >
            <Route path={AppRoutes.Display} element={<Display />} />
            <Route path={AppRoutes.DisplayLogout} element={<DisplayLogout />} />
          </Route>

          <Route path={'*'} element={<Redirect to={route} />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
