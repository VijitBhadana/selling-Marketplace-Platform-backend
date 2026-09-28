#!/bin/bash
# The instance has 1 GB of RAM, and `npm ci` plus the `prisma generate`
# postinstall step both peak above that. Add a swapfile before the install runs
# so the deploy fails on real errors rather than on the OOM killer.
set -euo pipefail

if [ -f /swapfile ]; then
  exit 0
fi

fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
