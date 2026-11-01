/**
 * Security headers for the pages the Worker answers itself (the site home, the blocked paths) and the words for a path that must
 * never be served. The same list is written in apps/web/public/_headers for every static file; a smoke check compares the two.
 */

/**
 * The page's policy. Scripts only from this site (and Razorpay's checkout when a person pays), styles from this site plus inline
 * styles (React sets style attributes, a few pages render a style element, and Razorpay's checkout adds its own: browsing found all three), fonts from this site, pictures from any https address (people link pictures), video only in the
 * YouTube and Vimeo players, no plugins, no other site may frame this one.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://checkout.razorpay.com https://cdn.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https: blob:",
  "connect-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://lumberjack.razorpay.com",
  'frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://api.razorpay.com https://checkout.razorpay.com',
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Enforcing since 2026-11-01: a browse of 102 pages and sheets, the checkout script and the checkout window itself showed no violation first,
 * as report-only. To go back to watching only, write 'Content-Security-Policy-Report-Only' here and in apps/web/public/_headers.
 */
export const CSP_HEADER = 'Content-Security-Policy';

export const PAGE_HEADERS: Record<string, string> = {
  [CSP_HEADER]: CSP,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

/**
 * Paths that hold nothing and must answer 404, never the app shell: hidden files, repository and editor folders, backups and
 * dumps, config and project files. Never `/.well-known/`, and never the files the site ships (/assets, /fonts, /resources, sw.js,
 * manifest, icons, og.png, licences.json), which none of these patterns can match.
 */
const BLOCKED_NAMES = /^\/(?:backup|backups|db|database|dump|site|www|website|public_html|wwwroot)(?:[._-][\w.-]*)?\.(?:zip|tar|tgz|gz|rar|7z|sql|bak|old|db|sqlite|sqlite3|dump)$/i;
// Every one of these needs a file extension, so a screen of the app (/admin, /settings, /login) is never caught.
const BLOCKED_FILES = /^\/(?:config|configuration|settings|secrets?|credentials|appsettings|database|wp-config|composer|package|package-lock|pnpm-lock|docker-compose|wrangler|tsconfig|vite\.config)\.(?:json|js|ts|yml|yaml|toml|jsonc|php|ini|conf|cfg|xml|txt|lock)$|^\/(?:dockerfile|makefile|id_rsa(?:\.pub)?|id_ed25519(?:\.pub)?|server-status|phpinfo\.php|yarn\.lock)$/i;
const BLOCKED_DIRS = /^\/(?:\.git|\.svn|\.hg|\.idea|\.vscode|wp-admin|wp-content|wp-includes|phpmyadmin|node_modules|cgi-bin|backup|backups|src|logs|tmp|temp)(?:\/|$)/i;
const BLOCKED_EXT = /\.(?:map|sql|sqlite|sqlite3|bak|old|orig|swp|zip|tar|tgz|gz|rar|7z|log|pem|key|pfx|p12|ini|env|ds_store|php|asp|aspx|jsp|cgi)$/i;

export function blockedPath(pathname: string): boolean {
  let p = pathname;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  if (p.startsWith('/.well-known/') || p === '/.well-known') return false;
  // Any segment that starts with a dot (.env, .git, .htaccess, .DS_Store, .dev.vars) is hidden by convention.
  if (p.split('/').some((seg) => seg.startsWith('.') && seg.length > 1)) return true;
  if (BLOCKED_DIRS.test(p) || BLOCKED_FILES.test(p) || BLOCKED_NAMES.test(p) || BLOCKED_EXT.test(p)) return true;
  return false;
}

/** Cloudflare "run worker first" patterns that send these paths to the Worker. Kept short; blockedPath is the real rule. */
export const BLOCKED_PATTERNS = ['/.*', '/*/.*', '/*.map', '/*.sql', '/*.bak', '/*.zip', '/*.tar', '/*.tar.gz', '/*.tgz', '/*.php', '/*.log', '/*.pem', '/*.key', '/*.env', '/backup*', '/db.*', '/dump.*', '/database.*', '/config.*', '/configuration.*', '/settings.json', '/secret*', '/credentials.*', '/package.json', '/package-lock.json', '/pnpm-lock.yaml', '/yarn.lock', '/composer.*', '/tsconfig.json', '/vite.config.*', '/wrangler.*', '/docker-compose.*', '/Dockerfile', '/Makefile', '/wp-*', '/phpmyadmin*', '/cgi-bin/*', '/node_modules/*', '/id_rsa*', '/server-status*', '/src/*', '/logs/*', '/tmp/*', '/temp/*'];

/**
 * A write from a browser page must come from this site. Only checked when the browser sends an Origin (a page does for a
 * write; a script, a webhook and the smoke tests send none and pass). Allowed: the request's own host, PUBLIC_URL's host, and
 * a loopback origin while the request itself is to a loopback host (local development).
 */
export function originAllowed(origin: string, requestUrl: string, publicUrl?: string): boolean {
  let o: URL;
  let r: URL;
  try {
    o = new URL(origin);
    r = new URL(requestUrl);
  } catch {
    return false;
  }
  if (o.host === r.host) return true;
  if (publicUrl) {
    try {
      if (new URL(publicUrl).host === o.host) return true;
    } catch {
      // a bad PUBLIC_URL allows nothing extra
    }
  }
  const loopback = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  return loopback(o.hostname) && loopback(r.hostname);
}
