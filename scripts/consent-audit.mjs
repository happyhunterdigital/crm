#!/usr/bin/env node
/**
 * happyhunterdigital consent audit.
 *
 * Fails when a browser-delivered analytics/tracking/marketing vendor is
 * referenced without a consent gate nearby. The gate is either the shared
 * helper (hasConsent / HHConsent / CONSENT_KEY) or an HTML declaration such as
 *   <script type="text/plain" data-consent="analytics" data-src="...">
 *
 * Run: node scripts/consent-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', 'vendor', 'vendor_modules', '.turbo', '.vercel',
]);
const SKIP_FILE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lock|\.map$|\.min\.js$|\.lock$)/i;
const TEXT_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|html|htm|vue|svelte|astro|php|py|yml|yaml)$/i;
const SERVER_PATH = /(^|[\\/])(server|api|worker|workers|backend|packages[\\/]telemetry)([\\/]|$)/i;
const CONSENT_HELPER = /(^|[\\/])(consent|cookie-consent|consent-analytics)\.(ts|tsx|js|jsx|mjs)$/i;

const TRACKER_DOMAINS = [
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'connect.facebook.net',
  'analytics.tiktok.com',
  'snap.licdn.com',
  'static.ads-twitter.com',
  'ct.pinterest.com',
  'sc-static.net',
  'clarity.ms',
  'hotjar.com',
  'doubleclick.net',
  'googlesyndication.com',
  'criteo.com',
  'mc.yandex.ru',
  'posthog.com',
  'posthog-js',
  'segment.com',
  'segment.io',
  'api.amplitude.com',
  'cdn.mxpnl.com',
  'plausible.io',
  'matomo.cloud',
  'umami.is',
  'hs-scripts.com',
  'hubspot.com',
  'vercel-insights.com',
  '/_vercel/insights',
  '@vercel/analytics',
];

const INITIALIZERS = [
  /\bgtag\s*\(/,
  /\bfbq\s*\(/,
  /\bposthog\.init\s*\(/,
  /\bgetAnalytics\s*\(/,
  /\bmixpanel\.init\s*\(/,
  /\bamplitude\.init\s*\(/,
  /\bhotjar\.initialize\s*\(/,
  /\bclarity\s*\(\s*['"]/,
  /\bSentry\.init\s*\(/,
];

const CONSENT_MARKER = /hasConsent\s*\(|HHConsent|hh:consent-change|data-consent|CONSENT_KEY|ConsentAnalytics|consent-gated/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
      continue;
    }
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (SKIP_FILE.test(rel) || !TEXT_FILE.test(rel)) continue;
    if (SERVER_PATH.test(rel)) continue;
    if (CONSENT_HELPER.test(rel)) continue;
    if (rel.split(sep).some((part) => part.startsWith('.'))) continue;
    out.push(full);
  }
  return out;
}

function lineAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function snippet(content, index) {
  const start = Math.max(0, index - 40);
  return content.slice(start, index + 80).replace(/\s+/g, ' ').trim();
}

const failures = [];
const files = walk(ROOT);

for (const file of files) {
  const rel = relative(ROOT, file);
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const isHtml = /\.(html?|vue|svelte|astro)$/i.test(rel);
  const hasMarker = CONSENT_MARKER.test(content);

  for (const domain of TRACKER_DOMAINS) {
    let from = 0;
    while (true) {
      const index = content.indexOf(domain, from);
      if (index === -1) break;
      from = index + domain.length;
      if (hasMarker) continue;
      failures.push(`${rel}:${lineAt(content, index)} tracker "${domain}" is not consent-gated (${snippet(content, index)})`);
    }
  }

  for (const pattern of INITIALIZERS) {
    const match = content.match(pattern);
    if (!match || match.index === undefined) continue;
    if (hasMarker) continue;
    failures.push(`${rel}:${lineAt(content, match.index)} initializer "${match[0]}" is not consent-gated (${snippet(content, match.index)})`);
  }

  // A tracker script tag is only acceptable when it is inert until accept.
  if (isHtml) {
    const tagPattern = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*(?:googletagmanager|google-analytics|facebook|tiktok|linkedin|hotjar|clarity|doubleclick|googlesyndication|posthog|segment|amplitude|mixpanel|vercel-insights)[^"']*["'][^>]*>/gi;
    for (const match of content.matchAll(tagPattern)) {
      const tag = match[0];
      if (/type\s*=\s*["']text\/plain["']/i.test(tag) || /data-consent\s*=/i.test(tag)) continue;
      failures.push(`${rel}:${lineAt(content, match.index ?? 0)} external tracker script loads without type="text/plain" data-consent`);
    }
  }
}

if (failures.length) {
  console.error('Consent audit failed. No tracker may load before the visitor clicks Accept.\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${failures.length} issue(s). Fix the gate or update AGENTS.md/CONSENT.md only if the vendor is strictly necessary and documented.`);
  process.exit(1);
}

console.log(`Consent audit passed (${files.length} source files checked). No ungated tracker found.`);
