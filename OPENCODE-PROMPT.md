# OpenCode brief — Resala Third-Quarter Gathering

Build and maintain a complete Arabic RTL invitation website for Resala Association's third-quarter gathering. The selected visual concept is **أرشيف الحكايات (The Story Archive)**: warm editorial scrapbook collage, lively and welcoming rather than wedding-like or SaaS-like. Use the authentic Resala logo without changing its proportions. Palette: deep Resala blue `#27318B`, Resala red `#C62727`, paper ivory `#F8F2E8`, festive yellow `#F4D35E`, with restrained orange `#F28A54`. Use Cairo for body/headline text, Aref Ruqaa for warm editorial accents, and DM Mono for archival numerals.

## Stack and hosting

- React + TypeScript + Vite; mobile-first and fully responsive.
- Public static frontend on GitHub Pages, built from `main` with GitHub Actions.
- Supabase Free backend for Postgres, Auth, Storage, RSVP submission, and aggregate metrics. Do not reuse any unrelated Supabase project.
- GitHub Pages repository path is `/resala-third-gathering/`; preserve the Vite `base` path.
- Never request, print, commit, or expose a Supabase `service_role` key. The browser may use only the public `publishable` key; enforce all access with RLS and database constraints.

## Public site

Create a long-form invitation with: Resala-branded navigation; striking collage hero; warm welcome and story copy; event details; optional program; honoree tribute cards; RSVP; and a footer with an unobtrusive admin entry. Arabic copy should feel natural and welcoming. Personal invite links should use an opaque random UUID token in `?invite=...`, never the guest's name in the URL. Show a special personalized greeting when the token resolves. The page must work in a draft state without fake event data.

Do not invent date, venue, honoree names, or real people's imagery. Start unpublished with date and venue unset. Use neutral illustration/placeholders until organizers upload real images. Require the organizer to confirm image/publication rights before a photo or name is made public. Do not use unrelated web-search people photos as stand-ins.

## Administration and data

Provide `/resala-third-gathering/?admin=1` as a dashboard route. Use Supabase Auth passwordless email sign-in, then verify authorization by calling `is_event_admin()`. An authenticated but non-allowlisted account must see no dashboard data. Admin screens must cover event title/copy/date/venue/map URL, publication and section visibility, program rows, honoree profiles with image upload, personal invitation links, private RSVP responses, CSV export, and privacy-minimizing aggregate metrics.

Public visitors may read only published event content. RSVP writes must go through the `submit_rsvp` RPC; no public select access to names, phone numbers, RSVP messages, invites, or admin allowlist. Use honeypot and input-size/party-size constraints. Honoree photos live in the public `honoree-photos` bucket, but only authenticated admins may upload/update/delete. Public metrics must not record IP addresses, persistent visitor identifiers, or device fingerprints; call the counts approximate, not unique visitors. Keep `admin_allowlist` private and use least-privilege policies.

Do not enable public account creation as an access grant: authenticated users who are not explicitly allowlisted must remain unable to read or mutate administrative data. Never store passwords in source code, logs, or chat.

## GitHub Pages and final checks

Include `npm ci`, `npm run build`, and deployment via the official GitHub Pages Actions workflow. Build with public repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Test the build with the repository base path, inspect mobile behavior, validate RSVP RPC with a safe test, check Supabase security advisors, confirm no human photos are bundled without approval, and verify the GitHub Pages workflow succeeds. Leave the event unpublished until an organizer enters accurate details and explicitly publishes it.
