import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ContentItem } from "../content/types";

const exec = promisify(execFile);
const REPO_ROOT = process.cwd();

export interface CommitResult {
  /** Commit SHA (or a synthetic ref when git isn't available). */
  commit: string;
  /** True if a real VCS commit was made; false if we only wrote the file. */
  committed: boolean;
}

/**
 * The write seam (spec §8). A locally-run owner commits to their own repo; a
 * serverless deployment would swap in a committer that calls the Git provider
 * API with a repository-scoped token. Both honor the same contract, and neither
 * ever exposes a credential to the browser.
 */
export interface Committer {
  write(item: ContentItem, message: string): Promise<CommitResult>;
}

/** Relative repo path for an item, partitioned by discovery/creation year. */
export function itemFilePath(item: ContentItem): string {
  const year = (item.discoveredAt ?? item.createdAt).slice(0, 4);
  return path.join("content", "items", /^\d{4}$/.test(year) ? year : "unsorted", `${item.slug}.json`);
}

async function isGitRepo(): Promise<boolean> {
  try {
    await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

export const localGitCommitter: Committer = {
  async write(item, message): Promise<CommitResult> {
    const rel = itemFilePath(item);
    const abs = path.join(REPO_ROOT, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    // Trailing newline keeps the file POSIX-clean and diffs tidy.
    await fs.writeFile(abs, JSON.stringify(item, null, 2) + "\n", "utf8");

    if (!(await isGitRepo())) {
      return { commit: `nogit-${item.updatedAt}`, committed: false };
    }

    await exec("git", ["add", "--", rel], { cwd: REPO_ROOT });
    // Nothing staged (identical content) → not an error; report the current HEAD.
    const { stdout: staged } = await exec("git", ["diff", "--cached", "--name-only"], { cwd: REPO_ROOT });
    if (staged.trim() === "") {
      const { stdout: head } = await exec("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT });
      return { commit: head.trim(), committed: false };
    }

    await exec("git", ["commit", "-m", message, "--", rel], { cwd: REPO_ROOT });
    const { stdout: sha } = await exec("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT });
    return { commit: sha.trim(), committed: true };
  },
};

/** Conventional, readable commit subjects (spec §8.1). */
export function commitMessage(item: ContentItem, mode: "create" | "update"): string {
  const who = item.creator ? ` by ${item.creator}` : "";
  if (mode === "update") return `content: update ${item.title}`;
  if (item.type === "note") return `content: publish ${item.title}`;
  return `content: add ${item.title}${who}`;
}
