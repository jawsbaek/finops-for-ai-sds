#!/usr/bin/env bash
set -euo pipefail

# mkworktree.sh: create an independent branch from current HEAD, add a worktree, copy .env, and run bun install

if [ $# -ne 1 ]; then
  echo "Usage: $0 <branch-name>" >&2
  exit 1
fi

branch="$1"
worktree_dir=".worktrees/$branch"

# Ensure inside a Git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Error: not inside a Git repository." >&2
  exit 1
}

# Guard existing path
if [ -d "$worktree_dir" ]; then
  echo "Error: worktree path '$worktree_dir' already exists." >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch"; then
  # Reuse existing local branch in new worktree (will use its current config)
  git worktree add "$worktree_dir" "$branch"
else
  # Create an independent branch from current HEAD without upstream
  git worktree add --no-track -b "$branch" "$worktree_dir" HEAD
fi

# Copy .env if present (don't overwrite)
if [ -f ".env" ]; then
  cp -n ".env" "$worktree_dir/.env"
else
  echo "Warning: .env not found in repo root; skipping copy."
fi

cd "$worktree_dir"

# Run Bun install if available
if command -v bun >/dev/null 2>&1; then
  bun install
else
  echo "Error: bun is not installed or not in PATH." >&2
  exit 1
fi

echo "Ready in $worktree_dir"

