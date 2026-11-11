// Writes static HTML for the public pages into dist/ after `vite build`, so
// crawlers and link previews that don't run JavaScript still see the content.
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { render } = await vite.ssrLoadModule('/src/prerender.tsx');
  const { PAGE_META, PRERENDERED_PATHS, SITE_URL } =
    await vite.ssrLoadModule('/src/constants/seo.ts');
  const shell = await readFile('dist/index.html', 'utf8');

  // Every route that isn't pre-rendered is served this untouched shell (see
  // vercel.json), so it never carries the landing page's content or canonical.
  await writeFile('dist/app.html', shell);

  const escape = s =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  for (const path of PRERENDERED_PATHS) {
    const { title, description } = PAGE_META[path];
    const url = SITE_URL + path;

    const head = [
      `<title>${escape(title)}</title>`,
      `<meta name="description" content="${escape(description)}" />`,
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:title" content="${escape(title)}" />`,
      `<meta property="og:description" content="${escape(description)}" />`,
      `<meta property="og:url" content="${url}" />`,
    ].join('\n  ');

    // Dropped before paint when this file is served as the SPA fallback for
    // another path, or when a signed-in screen opens the root.
    const guard = `<script>(function(){var p=document.getElementById('prerender');var s=false;try{s=JSON.parse(localStorage.getItem('display')).state.loggedIn}catch(e){}if(location.pathname.replace(/\\/+$/,'')!==${JSON.stringify(path.replace(/\/+$/, ''))}||s)p.remove();})();</script>`;

    const html = shell
      .replace(/<title>[^<]*<\/title>/, '')
      .replace(/<meta name="description"[^>]*>/, '')
      .replace('</head>', `  ${head}\n</head>`)
      .replace(
        '<div id="root">',
        `<div id="prerender">${render(path)}</div>${guard}<div id="root">`
      );

    const file = path === '/' ? 'dist/index.html' : `dist${path}.html`;
    await writeFile(file, html);
    console.log(`prerendered ${path} -> ${file}`);
  }
} finally {
  await vite.close();
}
