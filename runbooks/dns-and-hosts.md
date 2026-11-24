# DNS, hosts and certificates

## Where the site is served

| Host | What | Deployed by |
| --- | --- | --- |
| `https://relatedb.ai/` | Cloudflare Pages, project `relate-web`: the apex serves it and `www` redirects (301) to the apex. Indexable. | `deploy-cf.yml` |
| `https://relate-web.pages.dev/` | The project's own Cloudflare address; the same deployment. | `deploy-cf.yml` |

GitHub Pages is retired (ADR-0074): no workflow publishes to it, and the repository ships no `CNAME` file.

## Check

```bash
dig +short A relatedb.ai                       # expect: Cloudflare addresses (104.21.x.x, 172.67.x.x)
curl -sI https://relatedb.ai/ | grep -i -E '^(HTTP|server)'   # expect: 200, server: cloudflare
curl -sI -H 'Accept: text/markdown' https://relatedb.ai/docs/ | grep -i content-type   # expect: text/markdown
echo | openssl s_client -connect relatedb.ai:443 -servername relatedb.ai 2>/dev/null | openssl x509 -noout -subject -dates
```

## Failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `dig` returns nothing or non-Cloudflare addresses | The apex record is missing, mistyped or pointing at an old host. | Fix it in the Cloudflare DNS dashboard; re-run `dig`. Propagation is minutes. |
| Browser: certificate error, or no HTTPS | The custom domain is not attached to the Pages project, or the certificate is still issuing. | Cloudflare dashboard → Workers & Pages → `relate-web` → Custom domains: confirm `relatedb.ai` is active. |
| 404 or an old page on `relatedb.ai`, but `relate-web.pages.dev` is current | The custom domain is attached to a different deployment or branch, or a cache holds the old page. | Check the production branch is `main` and the custom domain points at the project; see [deploy-failed.md](deploy-failed.md). |
| `Accept: text/markdown` returns HTML | The Pages Function did not deploy, or `functions/` failed to bundle. | Look at the `Deploy to Cloudflare Pages` run; `npm run docs:negotiation-check` after a build reproduces it. |
