import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { PublicRoutes } from '@/constants/routes';
import Landing from '@/pages/public/landing';
import PrivacyPolicy from '@/pages/legal/privacy-policy';
import TermsConditions from '@/pages/legal/terms-conditions';
import RefundPolicy from '@/pages/legal/refund-policy';
import AppSupport from '@/pages/legal/app-support';

const PAGES: Record<string, () => React.JSX.Element> = {
  [PublicRoutes.Landing]: Landing,
  [PublicRoutes.PrivacyPolicy]: PrivacyPolicy,
  [PublicRoutes.TermsConditions]: TermsConditions,
  [PublicRoutes.RefundPolicy]: RefundPolicy,
  [PublicRoutes.AppSupport]: AppSupport,
};

/** Build-time only: see scripts/prerender.mjs. */
export function render(path: string): string {
  const Page = PAGES[path];
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>
  );
}
