#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMMON_GLOBS=(
  -g '!node_modules'
  -g '!.venv'
  -g '!.history'
  -g '!.git'
  -g '!.env'
  -g '!.tui_chat.providers.json'
  -g '!.tui_chat.filesystem.json'
)

status=0

run_check() {
  local label="$1"
  local pattern="$2"
  shift 2

  if rg -n --hidden "${COMMON_GLOBS[@]}" "$@" -e "$pattern" . >/tmp/tui-chat-public-check.out 2>/dev/null; then
    echo "FAIL  $label"
    cat /tmp/tui-chat-public-check.out
    echo
    status=1
    return
  fi

  echo "OK    $label"
}

echo "Scanning public repo surface in $ROOT_DIR"
echo

run_check "hardcoded secret patterns" \
  'sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{35}'

run_check "private home paths" \
  '/home/[A-Za-z0-9._-]+|/Users/[A-Za-z0-9._-]+'

echo "Checking required ignore rules"

required_ignored=(
  ".env"
  ".tui_chat.providers.json"
  ".tui_chat.filesystem.json"
  ".history/"
  "node_modules/"
  ".venv/"
)

for entry in "${required_ignored[@]}"; do
  if rg -n -x --fixed-strings "$entry" .gitignore >/dev/null 2>&1; then
    echo "OK    .gitignore contains $entry"
    continue
  fi

  echo "FAIL  .gitignore is missing $entry"
  status=1
done

echo
if [[ "$status" -ne 0 ]]; then
  echo "Public check failed."
  exit "$status"
fi

echo "Public check passed."
