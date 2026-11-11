# Deployment

## Static hosting

```sh
npm test
npm run check
npm run build
```

Publish the **contents of `dist/`**, with `index.html` at the site's entry path. Keep `src/` and `public/` in their copied locations. Serve `.js` as JavaScript and `.css` as CSS; the included local server provides these MIME types.

The app uses relative asset paths. A build can be hosted at a domain root or at a project path such as `https://example.org/hearing-lab/`. Use a trailing slash for the directory entry URL so relative references resolve under the project path.

Use an HTTPS host for a public site. No application secrets, environment substitution, database, package CDN, or backend process are needed. Retain the license and make the corresponding source for the deployed version easy to find. Update the source link when deploying a modified fork.

The build includes `hearing-lab-source.tar.gz` for the app's source-download link. Publish it with the other files so visitors can obtain the full corresponding source directly from the deployed site. Rebuild after source changes to keep the archive and served application aligned.

## Local preview

```sh
node scripts/serve.mjs --dist --port 4173
```

The server binds to `0.0.0.0` by default. `--host 127.0.0.1` makes it local to the computer; `PORT` and `HOST` can also be supplied through the environment. Port `0` asks the OS to choose an available port, which the server prints.

The server rejects paths outside its selected root, including escaping symlinks, and does not expose hidden files. This utility is for development and previews; a production static host can provide TLS, caching, and access controls as needed.

In source mode, the exact `/hearing-lab-source.tar.gz` path serves the archive from `dist/`. Run the build to create or refresh it before checking the download link.

## Production deploy (`pgs.sh`)

```sh
npm run deploy
```

Builds `dist/` (including `hearing-lab-source.tar.gz`) and syncs it via `rsync` to `pgs.sh:hearing-lab` ([https://silvio-hearing-lab.pgs.sh/](https://silvio-hearing-lab.pgs.sh/)).

## GitHub Pages

The repository includes two workflows:

- **CI** runs the tests, checks, and build on pushes and pull requests.
- **Deploy GitHub Pages** runs only when manually dispatched.

To choose Pages hosting:

1. In repository **Settings → Pages**, set the build source to **GitHub Actions**.
2. Open **Actions → Deploy GitHub Pages → Run workflow**.
3. Select the branch to publish and run it.
4. Wait for the deployment job and use the URL it reports.

The publishing workflow checks the project before uploading `dist/`. Repository permissions, environment protection rules, or organization settings can require additional configuration. Adding the workflow alone does not establish that Pages has been enabled or deployed.

GitHub's [custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [publishing-source configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) describe the hosting setup.

## Offline operation

Download or clone the source, then use the local server. The build and app have no external runtime dependencies. Browser access to a hosted copy initially needs its page and assets; ordinary cache behaviour should not be advertised as a guaranteed offline installer.
