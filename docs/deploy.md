# Deploying Trail Bingo

The app is a static site on **Netlify**. The BioCLIP model (~300 MB) isn't part of it: the app
downloads it on first launch from a **Hugging Face** model repository, which allows cross-origin
downloads and has no file-size or bandwidth worries. GitHub Actions builds and deploys on every push
to `main` (`.github/workflows/deploy.yml`), and can be run by hand.

```
GitHub (main) ──▶ Actions: test, build with VITE_MODEL_URL ──▶ Netlify: app shell (~27 MB)
                                                                   │ first launch
                                                                   ▼
                                        Hugging Face: model files (~300 MB, once per phone)
```

## One-time setup

### 1. Publish the model to Hugging Face

You need a Hugging Face account and a **write** access token (huggingface.co/settings/tokens),
and the ONNX export in `spike/web/public/models` (`spike/export/export.py`).

```sh
spike/export/.venv/bin/hf auth login
HF_REPO=yourname/trail-bingo-bioclip-onnx scripts/publish-model.sh
```

The script uploads the five files the app downloads and a model card crediting BioCLIP (MIT licence),
then prints the `MODEL_URL` to use: `https://huggingface.co/<repo>/resolve/<commit>/`. Pinning a
commit means the files never change under the app; re-run the script and update `MODEL_URL` to
publish a new export.

### 2. Create the Netlify site

1. In Netlify: **Add new project → Deploy manually**, and drop any folder to create the site (the
   workflow replaces it), or use `npx netlify-cli sites:create`.
2. Note its ID (labelled Project ID or Site ID in its configuration, under General): that's `NETLIFY_SITE_ID`.
3. Create a **personal access token** (User settings → Applications): that's `NETLIFY_AUTH_TOKEN`.

Response headers come from `public/_headers`: cross-origin isolation (COOP/COEP) for multi-threaded
WebAssembly, no caching for `sw.js`, and long caching for the content-hashed `assets/`.

### 3. Configure GitHub

In the repository's **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `NETLIFY_AUTH_TOKEN` | the Netlify access token |
| Secret | `NETLIFY_SITE_ID` | the Netlify Project ID |
| Variable | `MODEL_URL` | the URL `publish-model.sh` printed, ending in `/` |

The workflow runs in a `production` environment, which GitHub creates on the first run; secrets and
variables can live there or at the repository level.

### 4. Deploy

Push to `main`, or run **Actions → Deploy → Run workflow**. Before deploying, the workflow checks the
settings are present, that `MODEL_URL/manifest.json` allows cross-origin downloads, and that the
model didn't end up in the build. Each production deploy uses Netlify credits (the free plan has a
monthly cap, and the site pauses if it runs out), so it doesn't deploy pull requests.

## Rehearsing locally

```sh
node scripts/serve-models.mjs                                   # the model, from another origin, with CORS
VITE_MODEL_URL=http://localhost:4180/ npm run build && npm run preview
```

Open http://localhost:4173: the setup screen downloads the model from port 4180. (`npm run models`
still links the export into `public/models/` for development without a model host.)

## Notes

- **Bandwidth:** each new player downloads the app shell from Netlify (~27 MB) and the model from
  Hugging Face (~300 MB) once; returning players load everything from the phone.
- **Updates:** a new deploy reaches installed apps once they're fully closed and reopened (the service
  worker waits rather than swapping files mid-game). The stored model is kept.
- **Moving the model:** stored models are keyed by the app's own `models/` URLs, not where they were
  downloaded from, so changing `MODEL_URL` doesn't make players download again.
