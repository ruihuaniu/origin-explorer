# SCALE — deploying this app

A static site. No build step, no dependencies to install, no server-side code,
no database. Nine files, all of them already in this folder.

## Run it locally

Either works:

- **Double-click `index.html`.** The app is built to run from `file://` — Three.js
  is vendored as a classic script and every asset is generated in code, so there
  is nothing for the browser to block.
- **Or serve the folder**, which is closer to production:

  ```
  python -m http.server 8000     # then open http://localhost:8000/
  npx serve .                    # or this
  ```

## Deploy it

Upload the whole folder to any static host. Nothing else is required.

| host | how |
|---|---|
| **Netlify Drop** | drag the folder onto <https://app.netlify.com/drop>. Fastest way to a URL; no account needed to try. |
| **Cloudflare Pages** | connect a repo, or upload directly. Build command: *none*. Output directory: `/`. |
| **Vercel** | `npx vercel --prod` in this folder. Framework preset: **Other**. |
| **GitHub Pages** | push the folder to a repo, then Settings → Pages → deploy from branch, root folder. |
| **Surge** | `npx surge` — one command, gives a public URL. |
| **S3 / CloudFront** | sync the folder to a bucket with static website hosting enabled. |
| **nginx / Apache** | copy the folder into the document root. No config needed. |

### Host settings that matter

- **No build command, no output directory transform.** This is already the
  built site. If a host insists on a build step, set it to something harmless
  like `echo skip` — or use a plain file upload instead of a Git integration.
- **Serve `.js` as `text/javascript`.** Every mainstream host does this by
  default; it only bites on a hand-configured nginx/Apache. If the page loads
  but stays blank, check the console for a MIME-type refusal.
- **Deploy at a subpath or a domain root — both work.** Every reference in
  `index.html` is relative, so `https://example.com/scale/` is fine.
- **HTTPS is not required.** Nothing is fetched over the network.

## What is in the archive

```
index.html          the page, and the only entry point
styles.css          all styling
src/data.js         the 12 levels, their facts, and the links between them
src/i18n.js         the English/Chinese dictionary
src/models.js       every 3D model, generated in code
src/main.js         scene, camera, navigation, UI wiring
vendor/three.classic.js      Three.js r169
vendor/orbit-controls.js     camera controls
vendor/room-environment.js   the lighting environment
DEPLOY.md           this file
```

## What is deliberately not in the archive

These are development-only and would only add weight to a deploy:

- `tools/` — the test harness, the screenshot driver, and the patch scripts
- `preview/` — throwaway snapshots used to work around preview caching
- `shots/` — captured screenshots
- `vendor/three.module.js` and `vendor/addons/` — the upstream ESM sources that
  `tools/build-vendor.py` converted into the classic scripts above. Not loaded
  at runtime.
- `tools/patches/*.bak` — editor backups

## Verifying a deploy

Open the site and check three things:

1. The scene appears and the level name reads **Human Body**.
2. Scrolling zooms; crossing the zoom limit descends a level, and the depth rail
   on the right tracks it.
3. The **EN / 中文** switch in the top bar translates the whole UI, annotations
   included.

If you get "Could not start the 3D scene", the browser has no WebGL or the
Three.js script did not load — check the console.
