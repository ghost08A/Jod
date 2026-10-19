#!/bin/sh
# Throwaway PoC PKI (run inside an alpine container with openssl). Output -> /pki
set -e
cd /pki; rm -rf ./*; mkdir good rogue
mk_ca(){ openssl req -x509 -newkey rsa:2048 -nodes -keyout $1/ca.key -out $1/ca.crt -days 30 -subj "/CN=$2" 2>/dev/null; }
leaf(){ # dir name CN extra-args...
  d=$1; n=$2; cn=$3; shift 3
  openssl req -newkey rsa:2048 -nodes -keyout $d/$n.key -out $d/$n.csr -subj "/CN=$cn" 2>/dev/null
  printf "subjectAltName=DNS:seaweedfs,DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth,clientAuth\n" > $d/ext.cnf
  openssl x509 -req -in $d/$n.csr -CA $d/ca.crt -CAkey $d/ca.key -CAcreateserial -out $d/$n.crt -extfile $d/ext.cnf "$@" 2>/dev/null
  rm -f $d/$n.csr
}
mk_ca good jod-poc-ca; mk_ca rogue rogue-ca
leaf good node seaweedfs -days 30
leaf good wrongcn attacker -days 30
leaf rogue rogue seaweedfs -days 30
leaf good short seaweedfs -days 1   # replaced below with a very short validity
# expired: needs explicit dates (OpenSSL >= 3.4)
openssl req -newkey rsa:2048 -nodes -keyout good/expired.key -out good/expired.csr -subj "/CN=seaweedfs" 2>/dev/null
openssl x509 -req -in good/expired.csr -CA good/ca.crt -CAkey good/ca.key -CAcreateserial -out good/expired.crt -extfile good/ext.cnf -not_before 20240101000000Z -not_after 20240102000000Z 2>&1 | tail -1
openssl version; for f in node wrongcn expired; do echo "$f: $(openssl x509 -in good/$f.crt -noout -subject -enddate | tr '\n' ' ')"; done
echo "rogue: $(openssl x509 -in rogue/rogue.crt -noout -issuer)"
chmod -R a+r /pki
