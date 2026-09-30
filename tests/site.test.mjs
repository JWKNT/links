import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildCollection, categoryFromFilename, parseCategoryDocument } from "../tools/build.mjs";

test("uses the filename stem as the category", () => {
  assert.equal(categoryFromFilename("arxiv.md"), "arxiv");
  assert.equal(categoryFromFilename("Wikipedia.md"), "Wikipedia");
  assert.equal(categoryFromFilename("machine learning.md"), "machine learning");
});

test("parses links and descriptions within one category file", () => {
  const result = parseCategoryDocument(`[One paper](https://arxiv.org/abs/1)
First line of the description.
Second line.

https://example.com/story — A bare link description.`, "arxiv", "arxiv.md");

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    category: "arxiv",
    title: "One paper",
    url: "https://arxiv.org/abs/1",
    description: "First line of the description. Second line.",
  });
  assert.equal(result[1].title, "example.com");
  assert.equal(result[1].description, "A bare link description.");
});

test("rejects category headings inside a category file", () => {
  assert.throws(() => parseCategoryDocument("# arxiv", "arxiv", "arxiv.md"), /filename already supplies the category/);
});

test("rejects duplicate URLs within a category file", () => {
  assert.throws(
    () => parseCategoryDocument("[First](https://example.com)\n[Second](https://example.com)", "one", "one.md"),
    /duplicate URL/,
  );
});

test("builds alphabetized categories from every Markdown filename", async () => {
  const fixtureDirectory = fileURLToPath(new URL("fixtures/categories/", import.meta.url));
  const result = await buildCollection(fixtureDirectory);

  assert.deepEqual(result.categories, ["arxiv", "news"]);
  assert.deepEqual(result.links.map(({ id, category, title }) => ({ id, category, title })), [
    { id: 1, category: "arxiv", title: "One paper" },
    { id: 2, category: "news", title: "One story" },
  ]);
});

test("the checked-in data matches the category directory", async () => {
  const built = JSON.parse(await readFile(new URL("../data/links.json", import.meta.url), "utf8"));
  assert.deepEqual(built, await buildCollection());
});

test("site references the shared theme and local application", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /jehlp\.net\/site-theme\/v2\/base\.css/);
  assert.match(html, /assets\/app\.js/);
  assert.match(html, /data-theme-toggle/);
});


test("empty collection and filtered results have distinct recovery states", async () => {
  const { runInNewContext } = await import("node:vm");
  const source = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");
  const successfulLoad = source.match(/state.links = Array.isArray\(data.links\)[\s\S]*?elements.emptyReset.hidden = state.links.length === 0;/)[0];
  for (const populated of [false, true]) {
    const paragraph = { textContent: "" };
    const elements = { empty: { querySelector: () => paragraph }, emptyReset: {} };
    const state = {};
    runInNewContext(successfulLoad, {
      state, elements, data: { links: populated ? [{}] : [] }, prepare: value => value
    });
    assert.equal(elements.emptyReset.hidden, !populated);
    assert.equal(paragraph.textContent, populated ? "No links match this view." : "No links have been added yet.");
  }
  const render = source.match(/function renderNow\(\) \{([\s\S]*?)\n  \}/)[0];
  assert.doesNotMatch(render, /empty\.querySelector/, "filter changes must not overwrite a load failure message");
});
