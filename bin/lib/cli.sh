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

edit_distance() {
  local first=$1 second=$2
  local first_length=${#first} second_length=${#second}
  local first_index second_index cost lowest
  local previous_row=() current_row=()

  for ((second_index = 0; second_index <= second_length; second_index++)); do
    previous_row[second_index]=$second_index
  done

  for ((first_index = 1; first_index <= first_length; first_index++)); do
    current_row=("$first_index")
    for ((second_index = 1; second_index <= second_length; second_index++)); do
      cost=1
      if [[ "${first:first_index - 1:1}" == "${second:second_index - 1:1}" ]]; then
        cost=0
      fi

      lowest=$((previous_row[second_index] + 1))
      if ((current_row[second_index - 1] + 1 < lowest)); then
        lowest=$((current_row[second_index - 1] + 1))
      fi
      if ((previous_row[second_index - 1] + cost < lowest)); then
        lowest=$((previous_row[second_index - 1] + cost))
      fi

      current_row[second_index]=$lowest
    done
    previous_row=("${current_row[@]}")
  done

  printf '%s' "${previous_row[second_length]}"
}

suggest_flag() {
  local suggestion_ceiling=2
  local best_distance=$((suggestion_ceiling + 1))
  local typed candidate stripped distance best=''

  typed=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  shift
  while [[ "$typed" == -* ]]; do
    typed=${typed#-}
  done
  if [[ -z "$typed" ]]; then
    return 0
  fi

  for candidate in "$@"; do
    stripped=${candidate#-}
    stripped=${stripped#-}
    distance=$(edit_distance "$typed" "$stripped")
    if ((distance < best_distance)); then
      best_distance=$distance
      best=$candidate
    fi
  done

  if [[ -n "$best" ]]; then
    printf 'Did you mean %s?' "$best"
  fi
}

unknown_flag() {
  local flagged=$1 suggestion
  shift
  printf 'Unknown option: %s\n\n' "$flagged" >&2
  suggestion=$(suggest_flag "$flagged" "$@") || suggestion=''
  if [[ -n "$suggestion" ]]; then
    printf '%s\n\n' "$suggestion" >&2
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
