import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "links.md");
const outputPath = path.join(root, "data", "links.json");

function cleanInlineMarkdown(value) {
  return value
    .replace(/\\([\\`*_[\]{}()#+.!-])/g, "$1")
    .replace(/[*_~`]+/g, "")
    .trim();
}

export function parseLinksDocument(source) {
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutComments.split(/\r?\n/);
  const categories = [];
  const links = [];
  const categoryNames = new Set();
  const urls = new Set();
  let category = null;
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

    const markdownHeading = trimmed.match(/^#{1,6}\s+(.+?)\s*#*$/);
    const angleHeading = trimmed.match(/^<([^<>/]+)>$/);
    const closingAngleHeading = trimmed.match(/^<\/([^<>]+)>$/);

    if (closingAngleHeading) {
      finishEntry();
      category = null;
      continue;
    }

    if (markdownHeading || angleHeading) {
      finishEntry();
      category = cleanInlineMarkdown((markdownHeading || angleHeading)[1]);
      if (!category) throw new Error(`Line ${lineNumber}: category name is empty.`);
      const key = category.toLocaleLowerCase("en");
      if (categoryNames.has(key)) {
        throw new Error(`Line ${lineNumber}: duplicate category “${category}”. Keep each category in one section.`);
      }
      categoryNames.add(key);
      categories.push(category);
      continue;
    }

    const markdownLink = trimmed.match(/^(?:[-*+]\s+)?\[([^\]]+)]\((https?:\/\/[^\s)]+)\)(?:\s*[—–-]\s*(.*))?$/i);
    const bareLink = trimmed.match(/^(?:[-*+]\s+)?(https?:\/\/\S+)(?:\s+[—–-]\s+(.*))?$/i);

    if (markdownLink || bareLink) {
      finishEntry();
      if (!category) throw new Error(`Line ${lineNumber}: add a category heading before the first link.`);

      const url = (markdownLink ? markdownLink[2] : bareLink[1]).replace(/[.,;:]$/, "");
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Line ${lineNumber}: “${url}” is not a valid URL.`);
      }
      if (!/^https?:$/.test(parsed.protocol)) throw new Error(`Line ${lineNumber}: only http and https links are supported.`);
      if (urls.has(parsed.href)) throw new Error(`Line ${lineNumber}: duplicate URL “${parsed.href}”.`);
      urls.add(parsed.href);

      const title = cleanInlineMarkdown(markdownLink ? markdownLink[1] : parsed.hostname.replace(/^www\./, ""));
      const inlineDescription = markdownLink ? markdownLink[3] : bareLink[2];
      current = {
        id: links.length + 1,
        category,
        title,
        url: parsed.href,
        descriptionLines: inlineDescription ? [inlineDescription.trim()] : [],
      };
      continue;
    }

    if (!current) {
      throw new Error(`Line ${lineNumber}: expected a link beneath the “${category || "(missing)"}” category.`);
    }
    current.descriptionLines.push(cleanInlineMarkdown(trimmed));
  }

  finishEntry();
  const usedCategories = categories.filter((name) => links.some((link) => link.category === name));
  return { source: "links.md", categories: usedCategories, links };
}

async function main() {
  const source = await readFile(sourcePath, "utf8");
  const data = parseLinksDocument(source);
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  process.stdout.write(`Built ${data.links.length} links across ${data.categories.length} categories.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
