#!/usr/bin/env bash
# Verify the configured public recipient is derived from the protected local key.
set -euo pipefail
identity=${1:?usage: verify-age-recipient.sh IDENTITY_FILE EXPECTED_RECIPIENT}
expected=${2:?usage: verify-age-recipient.sh IDENTITY_FILE EXPECTED_RECIPIENT}
fail() { echo "✗ AGE KEY CHECK: $*" >&2; exit 1; }

[ -f "$identity" ] && [ ! -L "$identity" ] && [ -s "$identity" ] || fail 'local age identity must be a non-empty regular file (not a symlink)'
[ "$(stat -c '%u' "$identity")" = "$(id -u)" ] || fail 'local age identity must be owned by the current operator'
[ "$(stat -c '%a' "$identity")" = 600 ] || fail 'local age identity must have mode 600'
[ -r "$identity" ] || fail 'local age identity is not readable by the current operator'
command -v age-keygen >/dev/null 2>&1 || fail 'trusted host age-keygen is required; install the age package on this host'
case "$expected" in age1*) ;; *) fail 'configured age recipient has invalid format' ;; esac
case "$expected" in *[!a-z0-9]*) fail 'configured age recipient has invalid characters' ;; esac

derived=$(age-keygen -y "$identity" 2>/dev/null) || fail 'could not derive recipient from local age identity'
[[ "$derived" =~ ^age1[a-z0-9]+$ ]] || fail 'local age identity did not derive exactly one valid recipient'
[ "$derived" = "$expected" ] || fail 'configured age recipient does not match the local recovery identity'
echo '✓ Configured age recipient matches the protected local recovery identity.'
