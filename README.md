# Sketch Hour

Timed drawing practice with your own references: class-style gesture sessions, a curriculum of 30 units with references made for it, Pinterest boards that refresh every day, a reference viewer with value studies, a Studio for composition and checking your drawings, a drawing timer and a practice log.

Everything runs on **GitHub**: the site is static files published with **GitHub Pages**, and a GitHub Actions workflow syncs your Pinterest boards and deploys the site. No other hosting is needed.

```
app/                          the website and the app; this folder is what gets published
  index.html                  home page
  curriculum/  handbook/  support/  about/  changelog/  privacy/  terms/   (each an index.html)
  404.html
  practice/index.html         the app itself, at /practice/
  assets/
    styles.css                fonts, colors, type and every app component (palette at the top)
    fonts/                    Nunito and Open Sans (SIL Open Font License), served from the site
    site.css                  layout for the website pages
    studio.css                the Studio tab (composition checker and sketch comparison)
    learn.css                 the Learn tab (curriculum and progress)
    curriculum.json           the curriculum: tracks, units, exercises, reference sets (generated, see section 6)
    app.js                    the app's script
    img/                      screenshots used on the home page
  refs/                       the curriculum's rendered reference images (WebP)
boards.json                   the Pinterest boards the site shows (edit this)
scripts/
  sync-boards.js              fetches the boards in boards.json (run by the deploy workflow)
  prefix-base.js              fixes links for a project site at /<repo>/ (run by the deploy workflow)
  lib/                        Pinterest board reader
tools/
  build_curriculum.py         the curriculum's text and structure; writes app/assets/curriculum.json
  museum.json                 the Art Institute of Chicago works used as references
  refs/                       the 3D renderer that made app/refs/
test/                         fake Pinterest, tests, local preview server
.github/workflows/
  deploy.yml                  publishes to GitHub Pages on every push and once a day
  test.yml                    runs the tests on every push
```

## 1. Put it live

1. On GitHub, create an empty repository called **`sketch-hour`**. With GitHub Pro it can be private, but **the published site is public either way**.
2. In the new repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push the project:

   ```bash
   cd sketch-hour
   git init -b main
   git add .
   git commit -m "Sketch Hour 0.1"
   git remote add origin https://github.com/<you>/sketch-hour.git
   git push -u origin main
   ```

4. Open the **Actions** tab and watch **Deploy to GitHub Pages**. When it finishes, the site is at `https://<you>.github.io/sketch-hour/` and the app at `https://<you>.github.io/sketch-hour/practice/`.

If the first run failed because Pages wasn't switched on yet, do step 2 and then **Actions → Deploy to GitHub Pages → Run workflow**.

A different repository name works too; the deploy workflow reads the site's address from GitHub and fixes the links to match.

## 2. Your Pinterest boards

The boards the site shows are listed in `boards.json`:

```json
{
  "boards": [
    { "url": "https://www.pinterest.com/<username>/<board>/", "name": "100 heads" }
  ]
}
```

- `name` is optional; without it the board's Pinterest name is used.
- Add or remove boards, commit and push. The site updates in a minute or two.
- The deploy also runs **once a day** (03:23 UTC) to pick up pins you've saved. Run it any time from **Actions → Deploy to GitHub Pages → Run workflow**.
- Boards must be **public** on Pinterest. Up to 1,000 pins per board.
- If Pinterest refuses a board on a given day, the site keeps the copy that's already live, and the run shows a warning. A board that has never synced is skipped.

**Know the limits of this:**

- The sync reads Pinterest's public board pages, not an official API. Pinterest can change them, or block requests from GitHub's servers, without notice. If that happens, the boards stay as they were last synced; `scripts/lib/pinterest-public.js` is the file to fix.
- Pinterest's terms don't allow scraping. Fine for practicing from your own boards; for the public, paid version, plan to replace it with each user's own boards through Pinterest's official API, which needs a server (see section 8).
- Every visitor sees these boards, because the pin list is published with the site. The images load from Pinterest; they aren't copied into the repository.
- GitHub turns off scheduled workflows in **public** repositories after 60 days without activity. Push a commit or run the workflow by hand to restart it.

## 3. Before you share the link

- [ ] Replace the placeholder address `hello@example.com` in `app/support/index.html`, `app/privacy/index.html` and `app/terms/index.html`.
- [ ] Have the Privacy and Terms pages reviewed. They describe what the code does in plain language but weren't written by a lawyer, and EU rules (GDPR) apply to visitors from Sweden and the rest of the EU.
- [ ] Check that the name and a domain are free to use (a web search found no drawing app called Sketch Hour, but that isn't a trademark search).
- [ ] Choose a license if the repository is public (none is included, which means all rights reserved).

## 4. Custom domain (optional)

**Settings → Pages → Custom domain**, then add the DNS records GitHub shows you. Nothing in the code needs to change: the deploy workflow notices the site now lives at the domain root.

## 5. Editing

- **Colors:** the PALETTE block at the top of `app/assets/styles.css` names the five colors plus the near-black `--ink`, and the ROLES block below it says which color does what, including the highlight gradient `--grad`. Dark mode has its own block under that.
- **Fonts:** Nunito 700/800 (headings, navigation, buttons) and Open Sans 400/600 (text) are in `app/assets/fonts/`; each file is a variable font covering both weights. The website's type scale is at the top of `app/assets/site.css`. The files are Latin and Latin Extended only, with their licences. They're served from the site, so visitors' browsers don't contact Google.
- **Website pages** are plain HTML. Keep links starting with `/` (for example `/handbook/`); the deploy workflow adds the `/sketch-hour` part. The header and footer are repeated in each page, so change them everywhere with search and replace across `app/**/*.html`.
- **Screenshots** in `app/assets/img/` are 1600 × 1000 WebP. Replace them with your own captures at the same size.
- **Changelog:** add a new section at the top of `app/changelog/index.html` for each release.
- **Curriculum:** see section 6.

## 6. The curriculum

The Learn tab and the `/curriculum/` page both read `app/assets/curriculum.json`. Don't edit that file by hand; it's generated:

```bash
python3 tools/build_curriculum.py
```

- **Tracks, units and exercises** are written out in `tools/build_curriculum.py` (`TRACKS` and the suggested order in `PATH`). Each exercise is a timed session (`S`), a session from one of your boards (`B`), a study with the timer (`STUDY`), a Studio exercise (`STUDIO`) or a timer with no reference (`FREE`).
- **Museum references** are listed in `tools/museum.json` by Art Institute of Chicago artwork and image IDs. They're public-domain works the museum releases as CC0, and they load from the museum's image server, so they don't take space in the repository.
- **Rendered references** are in `app/refs/` (about 4 MB). To change or add some, edit `tools/refs/poses.js` or `tools/refs/jobs-all.js`, then run `cd tools/refs && npm install && npx playwright install chromium && npm run render`, and rebuild the curriculum.
- The same command updates the `/curriculum/` web page (the part between the `generated:curriculum` comments).
- Progress is stored in each visitor's browser, like the rest of their data. Accounts that keep progress across devices need a server (see section 8).

## 7. Preview locally

```bash
node scripts/sync-boards.js     # optional: fetch your boards into app/data/boards.json (not committed)
node test/dev-server.js         # http://localhost:4280, app at /practice/
```

The preview server answers like GitHub Pages: folders open their `index.html`, and missing pages show `404.html`.

**Tests:** `node --test test/sync.test.js` (board sync against a fake Pinterest, link prefixing). GitHub Actions runs them on every push.

## 8. What GitHub Pages can't do

GitHub Pages only serves files, so this version has no server. That rules out:

- visitors syncing **their own** Pinterest boards (they paste pins instead),
- signing in with Pinterest, accounts, and payments for paid features,
- sharing a library or curriculum progress between devices (everything a visitor adds stays in their browser).

When you add paid features you'll need a service that runs code next to the site. The earlier Azure version of this project already has board sync by link and Pinterest sign-in written for that, if you want to start from it.
