/** @type {import('next').NextConfig} */

// Must match the exact content of THEME_INIT_SCRIPT in src/app/layout.tsx.
// Recompute if that script ever changes:
//   python3 -c "import hashlib,base64; s=open('src/app/layout.tsx').read(); \
//     import re; m=re.search(r'const THEME_INIT_SCRIPT = \`(.*?)\`;', s, re.DOTALL); \
//     print('sha256-' + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode())"
const THEME_SCRIPT_CSP_HASH = "sha256-r2qJBVNKhKFz19zcP4wjY56kkrNRb8V7qorp5nWUlh0=";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // 'unsafe-inline' for styles only: token-chip.tsx sets a computed,
  // per-request background color via the style attribute, which can't
  // be hashed ahead of time. Inline STYLE injection is a materially
  // weaker attack primitive than inline SCRIPT injection (which is
  // fully locked down above), so this is a deliberate, scoped tradeoff.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];

    // CSP is production-only: `next dev` relies on eval-based source maps
    // for Fast Refresh, which a script-src without 'unsafe-eval' blocks.
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // Runs in the Next.js server (Node process, or Vercel's serverless
    // functions), never in the browser -- so from the browser's point of
    // view, every request stays same-origin.
    let appServiceUrl = process.env.APP_SERVICE_URL;
    if (!appServiceUrl || (!appServiceUrl.startsWith("http://") && !appServiceUrl.startsWith("https://"))) {
      appServiceUrl = process.env.NODE_ENV === "development"
        ? "http://localhost:8000"
        : "https://scamguard-app-service.onrender.com";
    }

    return [{ source: "/backend-api/:path*", destination: `${appServiceUrl}/:path*` }];
  },
};

module.exports = nextConfig;
