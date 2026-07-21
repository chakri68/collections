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

/**
 * Production committer: commits one item file through the GitHub Contents API
 * with a repository-scoped token (spec §8.1 step 7). This is what runs on a
 * deployed host, where there is no local working tree. The token stays server-
 * side — it is read from env and never sent to the browser.
 *
 * Env: GITHUB_TOKEN (contents:write on the repo), GITHUB_REPO ("owner/name"),
 * GITHUB_BRANCH (default "main").
 */
export function githubCommitter(config?: {
  token?: string;
  repo?: string;
  branch?: string;
}): Committer {
  const token = config?.token ?? process.env.GITHUB_TOKEN;
  const repo = config?.repo ?? process.env.GITHUB_REPO;
  const branch = config?.branch ?? process.env.GITHUB_BRANCH ?? "main";

  const api = "https://api.github.com";
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json",
    "user-agent": "collection-committer",
  };

  return {
    async write(item, message): Promise<CommitResult> {
      if (!token || !repo) throw new Error("github committer misconfigured: set GITHUB_TOKEN and GITHUB_REPO");
      const rel = itemFilePath(item).split(path.sep).join("/"); // repo paths are always POSIX
      const url = `${api}/repos/${repo}/contents/${rel.split("/").map(encodeURIComponent).join("/")}`;
      const content = Buffer.from(JSON.stringify(item, null, 2) + "\n", "utf8").toString("base64");

      // An update needs the current blob SHA; a create must omit it. 404 = new file.
      let sha: string | undefined;
      const head = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers, cache: "no-store" });
      if (head.ok) {
        sha = ((await head.json()) as { sha?: string }).sha;
      } else if (head.status !== 404) {
        throw new Error(`github read failed (${head.status}): ${await head.text()}`);
      }

      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ message, content, branch, sha }),
      });
      if (!res.ok) throw new Error(`github write failed (${res.status}): ${await res.text()}`);
      const body = (await res.json()) as { commit?: { sha?: string } };
      return { commit: body.commit?.sha ?? "unknown", committed: true };
    },
  };
}

/**
 * Pick the committer for the current environment: GitHub API when a token +
 * repo are configured (the deployed case), otherwise a local git commit (the
 * owner running it on their own machine).
 */
export function defaultCommitter(): Committer {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) return githubCommitter();
  return localGitCommitter;
}

/** Conventional, readable commit subjects (spec §8.1). */
export function commitMessage(item: ContentItem, mode: "create" | "update"): string {
  const who = item.creator ? ` by ${item.creator}` : "";
  if (mode === "update") return `content: update ${item.title}`;
  if (item.type === "note") return `content: publish ${item.title}`;
  return `content: add ${item.title}${who}`;
}
