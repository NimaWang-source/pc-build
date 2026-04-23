# GitHub Pages Deployment

This project is static.

## Files already ready for Pages

- `index.html`
- `styles.css`
- `app.js`
- `fallback.js`
- `premium-fallback.js`
- `data/`

## Included deployment setup

- `.github/workflows/deploy-pages.yml`
- `.nojekyll`

## Current local state

- local git repo: **initialized**
- local branch: `main`
- GitHub remote: **not configured yet**
- GitHub Pages: **not deployed yet**

## What you still need

1. Create GitHub repository on your account
2. Add that repository as `origin`
3. Create first commit locally
4. Push branch `main`
5. In GitHub repo settings:
   - Pages → Source = **GitHub Actions**
6. Wait for workflow `Deploy static site to GitHub Pages`

## Expected URL

`https://<your-account>.github.io/<repo-name>/`

## Exact command sequence

Run these in this folder after you create the GitHub repo:

```powershell
git add .
git commit -m "Initial workstation configurator"
git remote add origin https://github.com/<your-account>/<repo-name>.git
git push -u origin main
```

If remote already exists and you only need to update URL:

```powershell
git remote set-url origin https://github.com/<your-account>/<repo-name>.git
git push -u origin main
```

## First deployment check

After push:

1. Open GitHub repo
2. Go to **Actions**
3. Confirm workflow `Deploy static site to GitHub Pages` runs successfully
4. Go to **Settings → Pages**
5. Confirm published URL appears

## Files that should be committed

- `index.html`
- `styles.css`
- `app.js`
- `fallback.js`
- `premium-fallback.js`
- `data/`
- `.github/workflows/deploy-pages.yml`
- `.nojekyll`
- `DEPLOYMENT.md`
- `.gitignore`

## Notes

- Site uses local static JSON under `data/`
- `fallback.js` keeps local `file://` open behavior working
- GitHub Pages will serve normal `fetch()` access, so dataset loading works there

## If you want me to finish upload

I still need either:

- your GitHub repo URL, plus local push permission/auth already working, or
- your GitHub account + repo name after you create the empty repository
