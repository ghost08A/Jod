#!/usr/bin/env bash
# Generates random throwaway credentials into .secrets/ (gitignored). Never prints them.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .secrets
r() { openssl rand -hex "$1"; }
ADMIN_PASSWORD=$(r 12); PG_PASSWORD=$(r 12)
declare -A K S
for n in admin app_rwl app_rwlt app_admin app_ro; do K[$n]="AK$(r 8)"; S[$n]=$(r 20); done
cat > .secrets/compose.env <<EOT
ADMIN_PASSWORD=$ADMIN_PASSWORD
PG_PASSWORD=$PG_PASSWORD
EOT
cat > .secrets/s3.json <<EOT
{"identities":[
 {"name":"admin","credentials":[{"accessKey":"${K[admin]}","secretKey":"${S[admin]}"}],"actions":["Admin"]},
 {"name":"app_rwl","credentials":[{"accessKey":"${K[app_rwl]}","secretKey":"${S[app_rwl]}"}],"actions":["Read:jod-test","Write:jod-test","List:jod-test"]},
 {"name":"app_rwlt","credentials":[{"accessKey":"${K[app_rwlt]}","secretKey":"${S[app_rwlt]}"}],"actions":["Read:jod-test","Write:jod-test","List:jod-test","Tagging:jod-test"]},
 {"name":"app_admin","credentials":[{"accessKey":"${K[app_admin]}","secretKey":"${S[app_admin]}"}],"actions":["Admin:jod-test"]},
 {"name":"app_ro","credentials":[{"accessKey":"${K[app_ro]}","secretKey":"${S[app_ro]}"}],"actions":["Read:jod-test","List:jod-test"]}
]}
EOT
ids=""
for n in admin app_rwl app_rwlt app_admin app_ro; do ids="$ids\"$n\":{\"key\":\"${K[$n]}\",\"secret\":\"${S[$n]}\"},"; done
cat > .secrets/harness.json <<EOT
{"url":"http://127.0.0.1:8333","pg":"Host=127.0.0.1;Port=55432;Database=jod_poc;Username=postgres;Password=$PG_PASSWORD","ids":{${ids%,}}}
EOT
echo "secrets written to .secrets/ (not printed)"
