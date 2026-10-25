# Consent-gated third-party scripts

Organisation-wide rule: **no analytics, tracking pixel, advertising tag, session replay, marketing script, or other non-essential third-party script may load, initialise, make a request, or store an identifier until the visitor clicks Accept on the cookie banner.**

This repository follows `AGENTS.md` at the happyhunterdigital workspace root. The reusable implementation guide is the `consent-gated-analytics` skill.

## Rules

1. The banner is first-party and offers Accept and Decline. Declining, dismissing, or ignoring loads nothing optional.
2. Accept loads the vendor immediately, without a reload.
3. The choice is stored under `hh-cookie-consent` with a timestamp and can be changed with the “Cookie settings” link.
4. Client code uses `hasConsent()` / `onConsentChange()` from the first-party consent helper. Static HTML uses:
   ```html
   <script src="/consent.js"></script>
   <script type="text/plain" data-consent="analytics"
           data-src="https://vendor.example/tag.js"></script>
   ```
5. Never place a tracker in `index.html`, a Next.js root layout, or a module top level.
6. Strictly necessary first-party code (routing, auth, cart, product Firebase) is exempt. Third-party functional libraries must be documented here.
7. Privacy policy must name the vendor and purpose.

## Local check

```bash
node scripts/consent-audit.mjs
```

CI runs the same command in `.github/workflows/consent-audit.yml` on every push and pull request.

## Adding a new tracker

1. Add the vendor to the privacy policy.
2. Load it only through the consent helper (or a `text/plain` declaration).
3. Verify in DevTools Network that Decline and ignore produce zero vendor requests.
4. Verify Accept loads the vendor without a reload.
5. Run the audit and merge.
