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
  if [[ "$1" == true && -t 1 && -z "${NO_COLOR:-}" && "${TERM:-}" != dumb ]]; then
    RED=$'\033[31m' GRN=$'\033[32m' YLW=$'\033[33m' CYN=$'\033[36m'
    BLD=$'\033[1m'  DIM=$'\033[2m'  RST=$'\033[0m'
  else
    RED='' GRN='' YLW='' CYN='' BLD='' DIM='' RST=''
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
