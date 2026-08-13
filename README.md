# Links

A searchable, long-form link collection published as a static site. The site has no runtime dependencies and uses the shared [JWKNT site theme](https://jwknt.github.io/site-theme/).

## Add links

Edit [`links.md`](links.md). Headings create categories; each Markdown link starts an entry; the prose beneath it becomes its description.

```md
# Papers

[A paper title](https://example.com/paper)
A note about the paper and why it matters.

# Any category you want

[A useful page](https://example.com/page)
A longer description can continue across lines.
```

Angle-bracket headings such as `<papers>` are also accepted. A bare URL is accepted and uses its hostname as the title. Nothing in the application defines or limits category names.

After editing, rebuild and test:

```sh
npm run build
npm test
```

Pushing to `main` rebuilds the data, runs the tests, and deploys the site to GitHub Pages. Search covers title, description, category, and URL. Results are grouped by category, and pagination keeps the rendered document bounded even when the collection contains many thousands of links.

## Local preview

```sh
npm run build
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.
