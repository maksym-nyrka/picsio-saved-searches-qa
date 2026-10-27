#!/usr/bin/env node
/**
 * Renders docs/test-plan.md into a single static docs/index.html.
 *
 * The Markdown file is the source of truth; this script exists only so the
 * plan can be published on GitHub Pages without a Jekyll theme fighting the
 * wide tables. Run with `npm run docs` after editing the plan.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { marked } from 'marked';

const SOURCE = new URL('../docs/test-plan.md', import.meta.url);
const TARGET = new URL('../docs/index.html', import.meta.url);

const markdown = await readFile(SOURCE, 'utf8');

marked.setOptions({ gfm: true, breaks: false });

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/** Split the document into its title and the body that follows it. */
const titleMatch = markdown.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1].trim() : 'Test Plan';
const body = titleMatch ? markdown.replace(titleMatch[0], '') : markdown;

// Scenario count comes from the plan's own TC rows, so the page cannot drift from the Markdown.
const scenarioCount = (markdown.match(/^\| TC-\d+/gm) || []).length;

let html = marked.parse(body);

// Give every h2/h3 a stable id so links from the TOC and from chat work.
const toc = [];
html = html.replace(/<h([23])>(.*?)<\/h\1>/g, (_match, level, inner) => {
  const text = inner.replace(/<[^>]+>/g, '');
  const id = slugify(text);
  if (level === '2') toc.push({ id, text });
  return `<h${level} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`;
});

// Tables are wide; wrap them so they scroll instead of breaking the layout.
html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

const nav = toc
  .map(({ id, text }) => `          <li><a href="#${id}">${text}</a></li>`)
  .join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Pics.io QA</title>
<meta name="description" content="A UI and API test plan for Pics.io Saved Searches: ${scenarioCount} prioritised scenarios, with automation focused on the core set, plus metrics and reporting.">
<link rel="stylesheet" href="assets/style.css?v=${Date.now()}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23111'/%3E%3Cpath d='M9 21l4-10h6l4 10h-3l-.8-2.2h-6.4L12 21H9zm4.6-4.6h4.8L16 11.4l-2.4 5z' fill='%23fff'/%3E%3C/svg%3E">
</head>
<body>
<a class="skip-link" href="#content">Skip to content</a>

<header class="site-header">
  <div class="wrap">
    <p class="eyebrow">Pics.io · QA take-home · Part 1</p>
    <h1>${title}</h1>
    <p class="lede">A test plan for Saved Searches, grounded in a hands-on session on build <code>8.22.4</code> — ${scenarioCount} scenarios split into core and secondary, with automation focused on the core set, all scoped to UI and API testing.</p>
    <p class="meta">
      <span>27 Oct 2026</span>
      <span>${scenarioCount} scenarios</span>
      <a href="test-plan.md">Markdown source</a>
    </p>
  </div>
</header>

<div class="layout wrap">
  <nav class="toc" aria-label="Table of contents">
    <p class="toc-title">Contents</p>
    <ol>
${nav}
    </ol>
  </nav>

  <main id="content" class="content">
${html}
  </main>
</div>

<footer class="site-footer">
  <div class="wrap">
    <p>Generated from <code>docs/test-plan.md</code> with <code>npm run docs</code>. Source of truth is the Markdown file.</p>
  </div>
</footer>
</body>
</html>
`;

await writeFile(TARGET, page);
console.log(`Rendered ${toc.length} sections -> docs/index.html`);
