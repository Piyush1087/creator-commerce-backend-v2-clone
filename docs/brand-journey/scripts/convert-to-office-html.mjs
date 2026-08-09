/**
 * Converts brand-journey Markdown sources to HTML for Word / Google Docs.
 * Run from repo root: node docs/brand-journey/scripts/convert-to-office-html.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(__dirname, "..");
const OUT_DIR = path.join(SOURCE_DIR, "word-google-docs");

const FILES = [
  "START_HERE.md",
  "README.md",
  "FLOW_OVERVIEW.md",
  "ONBOARDING.md",
  "BRAND_CENTRE.md",
  "BRIDGE_TO_UCE.md",
  "UCE.md",
  "DATA_AND_PROMPTS_REFERENCE.md",
  "PARALLEL_AND_DATA_INPUTS.md",
  "PROMPTS_AND_AI_INSTRUCTIONS.md",
];

const COMBINED_FILES = [
  "START_HERE.md",
  "README.md",
  "FLOW_OVERVIEW.md",
  "ONBOARDING.md",
  "BRAND_CENTRE.md",
  "BRIDGE_TO_UCE.md",
  "UCE.md",
  "DATA_AND_PROMPTS_REFERENCE.md",
  "PARALLEL_AND_DATA_INPUTS.md",
  "PROMPTS_AND_AI_INSTRUCTIONS.md",
];

const HTML_SHELL = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #1a1a1a;
      max-width: 8.5in;
      margin: 0.75in auto;
    }
    h1 { font-size: 22pt; color: #0d3b2e; border-bottom: 2px solid #34d399; padding-bottom: 6px; }
    h2 { font-size: 16pt; color: #0d3b2e; margin-top: 24px; }
    h3 { font-size: 13pt; color: #1f4d3d; margin-top: 18px; }
    p { margin: 8px 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0 16px;
      font-size: 10.5pt;
    }
    th, td {
      border: 1px solid #9ca3af;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f0fdf4; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    code, pre {
      font-family: Consolas, "Courier New", monospace;
      font-size: 10pt;
    }
    pre {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      padding: 10px 12px;
      white-space: pre-wrap;
      border-radius: 4px;
    }
    ul, ol { margin: 8px 0 12px; padding-left: 24px; }
    li { margin: 4px 0; }
    hr { border: none; border-top: 1px solid #d1d5db; margin: 20px 0; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    .side-note {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 8px 12px;
      margin: 12px 0;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return s;
}

function isTableRow(line) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function parseTableRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, "")));
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "---") {
      out.push("<hr />");
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const fence = line.trim();
      const lang = fence.slice(3).trim();
      i++;
      const block = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        block.push(lines[i]);
        i++;
      }
      i++;
      out.push(`<pre><code>${escapeHtml(block.join("\n"))}</code></pre>`);
      continue;
    }

    if (isTableRow(line)) {
      const tableLines = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.map(parseTableRow).filter((r) => !isSeparatorRow(r));
      if (rows.length === 0) continue;
      out.push("<table>");
      rows.forEach((row, idx) => {
        const tag = idx === 0 ? "th" : "td";
        const cellTag = (c) => (idx === 0 ? `<th>${inlineFormat(c)}</th>` : `<td>${inlineFormat(c)}</td>`);
        if (idx === 0) {
          out.push("<thead><tr>" + row.map(cellTag).join("") + "</tr></thead><tbody>");
        } else {
          out.push("<tr>" + row.map(cellTag).join("") + "</tr>");
        }
      });
      out.push("</tbody></table>");
      continue;
    }

    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      out.push(`<h3>${inlineFormat(h3[1])}</h3>`);
      i++;
      continue;
    }
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      out.push(`<h2>${inlineFormat(h2[1])}</h2>`);
      i++;
      continue;
    }
    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      out.push(`<h1>${inlineFormat(h1[1])}</h1>`);
      i++;
      continue;
    }

    const ul = line.match(/^- (.+)$/);
    if (ul) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^- (.+)$/);
        if (!m) break;
        const text = m[1];
        if (text.startsWith("[ ]") || text.startsWith("[x]")) {
          items.push(`<li>${inlineFormat(text.replace(/^\[[ x]\] /, ""))}</li>`);
        } else {
          items.push(`<li>${inlineFormat(text)}</li>`);
        }
        i++;
      }
      out.push("<ul>" + items.join("") + "</ul>");
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("**Side note")) {
      const note = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#")) {
        note.push(lines[i]);
        i++;
      }
      out.push(`<div class="side-note">${note.map((l) => `<p>${inlineFormat(l)}</p>`).join("")}</div>`);
      continue;
    }

    out.push(`<p>${inlineFormat(line)}</p>`);
    i++;
  }

  return out.join("\n");
}

function baseName(file) {
  return file.replace(/\.md$/, "");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const file of FILES) {
  const src = path.join(SOURCE_DIR, file);
  const md = fs.readFileSync(src, "utf8");
  const title = baseName(file).replace(/_/g, " ");
  const html = HTML_SHELL(title, markdownToHtml(md));
  const outName = `${baseName(file)}.html`;
  fs.writeFileSync(path.join(OUT_DIR, outName), html, "utf8");
  console.log(`Wrote ${outName}`);
}

const combinedParts = COMBINED_FILES.map((file) => {
  const md = fs.readFileSync(path.join(SOURCE_DIR, file), "utf8");
  const title = baseName(file).replace(/_/g, " ");
  return `<div style="page-break-before: always;"><h1>${escapeHtml(title)}</h1>${markdownToHtml(md)}</div>`;
});

const combinedHtml = HTML_SHELL("Brand Journey — Complete", combinedParts.join("\n"));
fs.writeFileSync(path.join(OUT_DIR, "Brand_Journey_Complete.html"), combinedHtml, "utf8");
console.log("Wrote Brand_Journey_Complete.html");
