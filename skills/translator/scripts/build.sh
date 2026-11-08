#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ $# -lt 1 ]]; then
  printf 'ئىشلىتىش: %s extract <PDF> <چىقىرىش-قىسقۇچى>\n' "$0" >&2
  printf '       %s markdown <چىقىرىش-قىسقۇچى> [--title نام] [--source-language تىل]\n' "$0" >&2
  printf '       %s validate <چىقىرىش-قىسقۇچى>\n' "$0" >&2
  exit 2
fi

COMMAND="$1"
shift
cd "$SKILL_DIR"

case "$COMMAND" in
  extract|markdown)
    exec node scripts/convert.js "$COMMAND" "$@"
    ;;
  validate)
    exec python scripts/validate.py "$@"
    ;;
  *)
    printf 'نامەلۇم بۇيرۇق: %s (extract, markdown ياكى validate ئىشلىتىڭ)\n' "$COMMAND" >&2
    exit 2
    ;;
esac
