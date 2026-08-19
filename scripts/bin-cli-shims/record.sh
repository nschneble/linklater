# shellcheck shell=bash

# one tab separated line per invocation, so a multi-line argument such as an
# inline node script stays on the line it belongs to
record_invocation() {
  local argument line=''
  for argument in "$@"; do
    argument=${argument//$'\n'/\\n}
    line+="$argument"$'\t'
  done
  printf '%s\n' "${line%$'\t'}" >> "$BIN_TEST_CAPTURE"
}
