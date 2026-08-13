import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseLinksDocument } from "../tools/build.mjs";

test("parses categories from the document without a schema", () => {
  const result = parseLinksDocument(`# Papers

[One paper](https://arxiv.org/abs/1)
First line of the description.
Second line.

<news>

https://example.com/story — A bare link description.
</news>`);

  assert.deepEqual(result.categories, ["Papers", "news"]);
  assert.equal(result.links.length, 2);
  assert.deepEqual(result.links[0], {
    id: 1,
    category: "Papers",
    title: "One paper",
    url: "https://arxiv.org/abs/1",
    description: "First line of the description. Second line.",
  });
  assert.equal(result.links[1].title, "example.com");
  assert.equal(result.links[1].description, "A bare link description.");
});

test("rejects entries without a category", () => {
  assert.throws(() => parseLinksDocument("[No category](https://example.com)"), /category heading/);
});

test("rejects duplicate URLs", () => {
  assert.throws(
    () => parseLinksDocument("# One\n[First](https://example.com)\n# Two\n[Second](https://example.com)"),
    /duplicate URL/,
  );
});

test("the checked-in data matches the source document", async () => {
  const source = await readFile(new URL("../links.md", import.meta.url), "utf8");
  const built = JSON.parse(await readFile(new URL("../data/links.json", import.meta.url), "utf8"));
  assert.deepEqual(built, parseLinksDocument(source));
});

test("site references the shared theme and local application", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /jwknt\.github\.io\/site-theme\/v1\/base\.css/);
  assert.match(html, /assets\/app\.js/);
  assert.match(html, /data-theme-toggle/);
});
