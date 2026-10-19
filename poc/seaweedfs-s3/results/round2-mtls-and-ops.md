# Round 2 results (2026-10-19): mTLS, IAM, certificate lifecycle, ops under final config, file serving

Transcribed by hand from the terminal output of the runs (the shell snippets were not saved as scripts, except
`scripts-mtls-probe.sh`, `pki.sh`, `docker-compose.final.yml`, `docker-compose.testport.yml`, `docker-compose.extern.yml`).
Environment: Docker Desktop on Windows, SeaweedFS 4.48 (`weed mini`), AWSSDK.S3 4.0.104.4, .NET 8.0.32, OpenSSL 3.5 (alpine).
"Final config" = isolated Docker network `storage`, JWT (4 keys via env), gRPC mTLS with allowed_commonNames="seaweedfs",
filer directory metadata hidden, admin UI off, telemetry off, no published ports in production
(127.0.0.1:8333 published only by docker-compose.testport.yml for the host-side harness).

## 1. gRPC / IAM coverage (tested)
Listening TCP ports inside the container: 8333 (S3 HTTP), 8888 (filer HTTP), 9333 (master HTTP), 9340 (volume HTTP),
18333 (S3 gRPC), 18888 (filer gRPC), 19333 (master gRPC), 19340 (volume gRPC), 23646 (admin HTTP), 33646 (admin gRPC),
127.0.0.11:35021 (Docker's embedded DNS, not SeaweedFS). gRPC also listens on unix sockets in /tmp inside the container
(not reachable from other containers; not tested from a shared-volume container).

Per gRPC port (18333, 18888, 19333, 19340, 33646), from a container on the storage network, TLS 1.2 handshake with openssl:

| client certificate | result (all five ports identical) |
|---|---|
| none | REFUSED (alert handshake failure) |
| signed by a different CA | REFUSED (alert bad certificate) |
| expired (signed by the right CA) | REFUSED (alert bad certificate) |
| right CA, wrong CN ("attacker") | REFUSED (alert bad certificate); server log: `invalid subject client common name: attacker` (50 lines) |
| valid | CONNECTED |
Plain-text HTTP/2 preface to each gRPC port: connection closed, no reply.

Real client (`weed shell`, `fs.ls` on filer gRPC): valid cert lists the files; wrong CA / expired / wrong CN / no cert: empty output.
`volume.list` (master gRPC) with a valid cert works.

IAM:
- filer IAM gRPC service is registered ("admin Bearer token required" in the log when jwt.filer_signing.key is set) and sits behind mTLS.
  Not tested directly with a gRPC IAM client (only the log line and the port-level mTLS result).
- embedded IAM HTTP API on the S3 port (AWS CLI, `--endpoint-url http://seaweedfs:8333 iam ...`):
  app identity create-user / create-access-key / list-users: all AccessDenied;
  admin identity create-user: AccessDenied "IAM write operations are disabled on this server"; admin list-users: allowed (returns users);
  anonymous POST CreateUser: HTTP 400.

## 2. Certificate lifecycle (tested)
- Leaf rotation (same CA): replace node.crt/node.key, `docker restart` -> verify PASS.
- CA rotation with overlap: (1) CA bundle old+new, old leaf; (2) new leaf from new CA, bundle both; (3) bundle only new CA; each step with a restart, verify PASS each time.
  After step 3 a client holding the old-CA-signed cert gets nothing (refused).
- Hot reload: after replacing the leaf files WITHOUT restart, the served certificate serial was unchanged after 15 s -> restart required (longer waits not tested).
- Server cert expiring while the process runs (cert valid ~90 s): requests after expiry on the same running process still succeeded (established connections);
  after `docker restart` with the expired cert the container stays "running" but S3 fails (response ended prematurely) and the volume server logs
  `transport: authentication handshake failed` (23 lines). No healthcheck existed in that ad-hoc container; the compose healthcheck (master /cluster/status) was not run against this case.

## 3. Operations under the final config (tested)
- restart, recreate container (same volume), docker kill + start: verify PASS each.
- rotate all four JWT keys + recreate: existing data still readable (verify PASS).
- full harness (`checks`): 37 pass, 0 fail, 7 info.
- backup (stopped container, tar of /data, 239 MB) -> remove volume -> start empty with same config (control: verify FAIL as expected) -> restore into fresh volume -> verify PASS.
  Config files (security.toml, certs, s3.json, env keys) are NOT in the volume and were re-supplied from .secrets.
- upgrade 4.47 -> 4.48 on the same volume under the final config: verify PASS.

## 4. File serving (tested facts only)
- backend streaming endpoint (B2-proxy): Thai filename correct, bytes identical. SDK ranged GET: HTTP 206 with Content-Range (B7). A Range passthrough in a backend endpoint was NOT built.
- presigned URL signed for a browser-facing host files.jod.test:8333 (nothing contacted at signing time):
  Host preserved -> 200; proxy rewrites Host to seaweedfs:8333 -> 403; with S3_EXTERNAL_URL=http://files.jod.test:8333 set -> 200 for both;
  Range via presigned -> 206; key swapped in the path -> 403; cross-origin request got `Access-Control-Allow-Origin` echoing the Origin (default allowedOrigins "*").
- NOT tested: HTTPS/TLS reverse proxy in front of S3, real browser download, expiry/clock skew edge cases beyond B6, throughput/memory of a proxy for large files.
