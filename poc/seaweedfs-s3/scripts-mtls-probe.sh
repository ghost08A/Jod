#!/bin/sh
# usage: probe.sh host port   (certs mounted at /pki/good, /pki/rogue)
H=$1; P=$2
try(){ # label, extra openssl args
  l=$1; shift
  out=$(echo "GET /" | timeout 8 openssl s_client -connect $H:$P -tls1_2 -CAfile /pki/good/ca.crt "$@" 2>&1)
  if echo "$out" | grep -qE "alert|error:|Connection reset|no peer certificate|handshake failure"; then r="REFUSED ($(echo "$out" | grep -oE "alert [a-z ]+|tlsv1 alert [a-z ]+|ssl/tls alert [a-z ]+" | head -1))";
  elif echo "$out" | grep -q "Cipher is"; then r="CONNECTED"; else r="NO-TLS/other"; fi
  printf "  %-22s %s\n" "$l" "$r"
}
plain=$(printf 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n' | timeout 4 nc -w3 $H $P 2>/dev/null | head -c 9 | od -An -tx1 | tr -d ' \n')
printf "port %s plaintext h2c reply bytes: %s\n" $P "${plain:-<none, connection closed>}"
try "no client cert"
try "wrong CA cert"       -cert /pki/rogue/rogue.crt -key /pki/rogue/rogue.key
try "expired cert"        -cert /pki/good/expired.crt -key /pki/good/expired.key
try "wrong CN (valid CA)" -cert /pki/good/wrongcn.crt -key /pki/good/wrongcn.key
try "valid cert"          -cert /pki/good/node.crt -key /pki/good/node.key
