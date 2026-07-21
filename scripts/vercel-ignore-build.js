#!/usr/bin/env node
/**
 * Vercel "Ignored Build Step" script.
 *
 * Exit codes (Vercel's contract): 1 = build, 0 = skip.
 *
 * The deployed app reads content from GitHub at runtime (CONTENT_SOURCE=github),
 * so a commit that only touches content/ needs no rebuild — those changes show
 * up on their own (revalidated on demand by the write endpoint / webhook, and by
 * a time window as a fallback). Any change outside content/ — code, config,
 * deps — does need a build.
 *
 * We default to building on ANY uncertainty (no parent commit, a git error, a
 * shallow clone), because a missed build is worse than a redundant one.
 */
const { execSync } = require("node:child_process");

function changedFiles() {
  // The pushed commit vs its parent. This assumes one commit per push, which is
  // the case for app-generated content commits and typical single edits.
  const out = execSync("git diff --name-only HEAD^ HEAD", { encoding: "utf8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

function main() {
  let files;
  try {
    files = changedFiles();
  } catch (err) {
    console.log(`↑ build: couldn't diff (${String(err).split("\n")[0]})`);
    return 1;
  }

  if (files.length === 0) {
    console.log("↑ build: no diff detected");
    return 1;
  }

  const onlyContent = files.every((f) => f.startsWith("content/"));
  if (onlyContent) {
    console.log(`⏭ skip: only content/ changed (${files.length} file(s)) — served from GitHub at runtime`);
    return 0;
  }

  const nonContent = files.filter((f) => !f.startsWith("content/"));
  console.log(`↑ build: ${nonContent.length} non-content file(s) changed, e.g. ${nonContent.slice(0, 3).join(", ")}`);
  return 1;
}

process.exit(main());
