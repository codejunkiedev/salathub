import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { PAGE_META, SITE_URL, type PageMeta } from '@/constants';

const DEFAULT_TITLE = 'SalatHub';

function setHeadTag(selector: string, create: () => HTMLElement, attr: string, value?: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/** Keeps the title, description and canonical link in step with the current public page. */
export function PageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta: PageMeta | undefined = (PAGE_META as Record<string, PageMeta>)[pathname];
    document.title = meta?.title ?? DEFAULT_TITLE;
    setHeadTag(
      'meta[name="description"]',
      () => Object.assign(document.createElement('meta'), { name: 'description' }),
      'content',
      meta?.description
    );
    setHeadTag(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
      'href',
      meta ? SITE_URL + pathname : undefined
    );
  }, [pathname]);

  return null;
}

/**
 * Pre-rendered pages ship static HTML in #prerender and keep #root hidden.
 * This sits inside the route Suspense boundary, so it only mounts once the
 * real page is ready to replace it.
 */
export function PrerenderCleanup() {
  useEffect(() => {
    document.getElementById('prerender')?.remove();
  }, []);

  return null;
}

/** Opens each newly visited page at the top; back and forward keep the browser's position. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
