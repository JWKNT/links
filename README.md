# Links

A searchable, long-form link collection published as a static site. The site has no runtime dependencies and uses the shared [JWKNT site theme](https://jwknt.github.io/site-theme/).

## Add links

Create Markdown files in [`links/`](links/). Each filename minus `.md` is the category name, exactly as written. The files are read alphabetically; each Markdown link starts an entry, and the prose beneath it becomes its description.

```md
# links/arxiv.md

[A paper title](https://example.com/paper)
A note about the paper and why it matters.

# links/news.md

[A useful page](https://example.com/page)
A longer description can continue across lines.
```

Do not add a category heading inside a file; the filename already supplies it. A bare URL is accepted and uses its hostname as the title. Nothing in the application defines or limits category names: `arxiv.md` creates `arxiv`, `Wikipedia.md` creates `Wikipedia`, and `machine learning.md` creates `machine learning`.

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
