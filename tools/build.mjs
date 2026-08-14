import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "links");
const outputPath = path.join(root, "data", "links.json");

function cleanInlineMarkdown(value) {
  return value
    .replace(/\\([\\`*_[\]{}()#+.!-])/g, "$1")
    .replace(/[*_~`]+/g, "")
    .trim();
}

export function categoryFromFilename(filename) {
  if (!filename.toLocaleLowerCase("en").endsWith(".md")) {
    throw new Error(`“${filename}” is not a Markdown filename.`);
  }
  const category = filename.slice(0, -3).trim();
  if (!category) throw new Error(`“${filename}” does not contain a category name.`);
  return category;
}

export function parseCategoryDocument(source, category, sourceName = `${category}.md`) {
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutComments.split(/\r?\n/);
  const links = [];
  const urls = new Set();
  let current = null;

  const finishEntry = () => {
    if (!current) return;
    current.description = current.descriptionLines.join(" ").replace(/\s+/g, " ").trim();
    delete current.descriptionLines;
    links.push(current);
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const markdownLink = trimmed.match(/^(?:[-*+]\s+)?\[([^\]]+)]\((https?:\/\/[^\s)]+)\)(?:\s*[—–-]\s*(.*))?$/i);
    const bareLink = trimmed.match(/^(?:[-*+]\s+)?(https?:\/\/\S+)(?:\s+[—–-]\s+(.*))?$/i);

    if (markdownLink || bareLink) {
      finishEntry();

      const url = (markdownLink ? markdownLink[2] : bareLink[1]).replace(/[.,;:]$/, "");
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`${sourceName}:${lineNumber}: “${url}” is not a valid URL.`);
      }
      if (!/^https?:$/.test(parsed.protocol)) throw new Error(`${sourceName}:${lineNumber}: only http and https links are supported.`);
      if (urls.has(parsed.href)) throw new Error(`${sourceName}:${lineNumber}: duplicate URL “${parsed.href}”.`);
      urls.add(parsed.href);

      const title = cleanInlineMarkdown(markdownLink ? markdownLink[1] : parsed.hostname.replace(/^www\./, ""));
      const inlineDescription = markdownLink ? markdownLink[3] : bareLink[2];
      current = {
        category,
        title,
        url: parsed.href,
        descriptionLines: inlineDescription ? [inlineDescription.trim()] : [],
      };
      continue;
    }

    if (!current) {
      throw new Error(`${sourceName}:${lineNumber}: expected a link. The filename already supplies the category.`);
    }
    current.descriptionLines.push(cleanInlineMarkdown(trimmed));
  }

  finishEntry();
  return links;
}

export async function buildCollection(directory = sourceDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && entry.name.toLocaleLowerCase("en").endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const categories = [];
  const links = [];
  const categoryNames = new Set();
  const urls = new Map();

  for (const file of files) {
    const category = categoryFromFilename(file.name);
    const categoryKey = category.toLocaleLowerCase("en");
    if (categoryNames.has(categoryKey)) throw new Error(`Duplicate category filename for “${category}”.`);
    categoryNames.add(categoryKey);
    categories.push(category);

    const source = await readFile(path.join(directory, file.name), "utf8");
    for (const link of parseCategoryDocument(source, category, file.name)) {
      const previousFile = urls.get(link.url);
      if (previousFile) throw new Error(`${file.name}: duplicate URL “${link.url}” already appears in ${previousFile}.`);
      urls.set(link.url, file.name);
      links.push({ id: links.length + 1, ...link });
    }
  }

  return { source: "links/*.md", categories, links };
}

async function main() {
  const data = await buildCollection();
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  process.stdout.write(`Built ${data.links.length} links across ${data.categories.length} categories.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
