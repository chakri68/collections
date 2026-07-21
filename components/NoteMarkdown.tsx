import { Fragment, type ReactNode } from "react";
import styles from "./NoteMarkdown.module.css";

/**
 * A restricted, safe Markdown subset (spec §4.3 / §14): paragraphs, emphasis,
 * inline code, links, blockquotes, and lists. It renders to React elements and
 * NEVER uses dangerouslySetInnerHTML, so raw HTML/script/handlers in the source
 * are impossible to inject — unrecognized markup is just shown as text.
 */

const SAFE_SCHEME = /^(https?:|mailto:)/i;

export function NoteMarkdown({ source, format }: { source: string; format?: "plain" | "markdown" }) {
  if (format !== "markdown") {
    // Plain notes: preserve paragraph breaks, escape nothing (it's text, in a text node).
    return (
      <div className={styles.note}>
        {source.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }
  return <div className={styles.note}>{renderBlocks(source)}</div>;
}

function renderBlocks(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading (#, ##, ###) — capped so notes can't forge page-level headings.
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 2, 6); // # → h3
      const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
      blocks.push(<Tag key={key++}>{renderInline(heading[2])}</Tag>);
      i++;
      continue;
    }

    // Blockquote — consume consecutive `>` lines.
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(<blockquote key={key++}>{renderInline(quote.join(" "))}</blockquote>);
      continue;
    }

    // Unordered / ordered list — consume consecutive item lines.
    const ordered = /^\d+\.\s+/.test(line);
    const unordered = /^[-*]\s+/.test(line);
    if (ordered || unordered) {
      const items: string[] = [];
      const re = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].replace(re, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }

    // Paragraph — consume until a blank line.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|>|[-*]\s|\d+\.\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(para.join(" "))}</p>);
  }

  return blocks;
}

/** Inline spans: bold, italic, inline code, and links. Order matters. */
function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|([*_]([^*_]+)[*_])|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);

    if (m[2] !== undefined) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[4] !== undefined) nodes.push(<code key={key++}>{m[4]}</code>);
    else if (m[6] !== undefined) nodes.push(<em key={key++}>{m[6]}</em>);
    else if (m[8] !== undefined) {
      const href = m[9].trim();
      if (SAFE_SCHEME.test(href)) {
        nodes.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {m[8]}
          </a>,
        );
      } else {
        // Unsafe scheme (javascript:, data:, …) → render as inert text.
        nodes.push(<Fragment key={key++}>{m[8]}</Fragment>);
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}
