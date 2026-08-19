# shellcheck shell=bash

scan_help() {
  local argument
  for argument in "$@"; do
    if [[ "$argument" == "-h" || "$argument" == "--help" ]]; then
      usage
      exit 0
    fi
  done
}

print_version() {
  local version
  version=$(node -p "require(process.argv[1]).version" "$ROOT_DIR/package.json" 2>/dev/null) || version=""
  if [[ -z "$version" ]]; then
    printf 'Cannot read the version from %s/package.json.\n' "$ROOT_DIR" >&2
    exit 70
  fi
  printf '%s\n' "$version"
  exit 0
}

unknown_flag() {
  printf 'Unknown option: %s\n\n' "$1" >&2
  if [[ -n "${2:-}" ]]; then
    printf '%s\n\n' "$2" >&2
  fi
  usage >&2
  exit 64
}

# shellcheck disable=SC2034
resolve_color() {
  local permitted=false
  if [[ "$1" == true && -z "${NO_COLOR:-}" && "${TERM:-dumb}" != dumb ]]; then
    permitted=true
  fi

  TTY_YELLOW='' TTY_BOLD='' TTY_DIM='' TTY_RESET=''
  if [[ "$permitted" == true ]]; then
    TTY_YELLOW=$'\033[33m' TTY_BOLD=$'\033[1m' TTY_DIM=$'\033[2m' TTY_RESET=$'\033[0m'
  fi

  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' DIM='' RESET=''
  if [[ "$permitted" == true && -t 1 ]]; then
    RED=$'\033[31m' GREEN=$'\033[32m' YELLOW=$'\033[33m' CYAN=$'\033[36m'
    BOLD=$'\033[1m' DIM=$'\033[2m' RESET=$'\033[0m'
  fi

  ERR_RED='' ERR_BOLD='' ERR_DIM='' ERR_RESET=''
  if [[ "$permitted" == true && -t 2 ]]; then
    ERR_RED=$'\033[31m' ERR_BOLD=$'\033[1m' ERR_DIM=$'\033[2m' ERR_RESET=$'\033[0m'
  fi
}

# shellcheck disable=SC2034
probe_terminal() {
  TERMINAL_REACHABLE=false
  if : 2>/dev/null > /dev/tty; then
    TERMINAL_REACHABLE=true
  fi

  TTY_AVAILABLE=false
  if [[ -t 1 && "$TERMINAL_REACHABLE" == true ]]; then
    TTY_AVAILABLE=true
  fi
}
