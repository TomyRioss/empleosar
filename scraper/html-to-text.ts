import * as cheerio from "cheerio";

const MAX_DESCRIPTION_LENGTH = 6000;

// Strips tags/decodes entities from a description that may be plain text or
// an HTML fragment. Block-level tags are turned into line breaks first so
// paragraphs and list items don't get smashed together by cheerio's .text().
export function htmlToText(input: string): string {
  const withBreaks = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n\n");

  const text = cheerio.load(`<div>${withBreaks}</div>`)("div").text();
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
}
