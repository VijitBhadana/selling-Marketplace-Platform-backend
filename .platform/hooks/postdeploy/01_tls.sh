#!/bin/bash
# Elastic Beanstalk regenerates its nginx config on every deploy, and a replaced
# instance comes up with no certificate at all, so TLS is re-established here
# rather than trusting a one-off manual setup to survive.
#
# CloudFront would normally terminate TLS (as it does for every other service in
# this account), but new distributions are refused while the AWS account is
# unverified, so the certificate lives on the instance instead.
set -uo pipefail

DOMAIN=api.dukancloude.com
LIVE=/etc/letsencrypt/live/$DOMAIN

command -v certbot >/dev/null 2>&1 || dnf install -y certbot >/dev/null 2>&1 || true

if [ ! -f "$LIVE/fullchain.pem" ] && command -v certbot >/dev/null 2>&1; then
  # Standalone needs port 80, and never fail the deploy over a certificate:
  # plain HTTP working is better than a rolled-back release.
  systemctl stop nginx
  certbot certonly --standalone -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email || true
  systemctl start nginx
fi

# Writing the TLS server block while no certificate exists on disk would stop
# nginx from starting at all, taking plain HTTP down with it.
if [ -f "$LIVE/fullchain.pem" ]; then
  cat > /etc/nginx/conf.d/https.conf <<EOF
server {
    listen 443 ssl;
    server_name $DOMAIN;
    ssl_certificate     $LIVE/fullchain.pem;
    ssl_certificate_key $LIVE/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection        "";
    }
}
EOF
  nginx -t && systemctl reload nginx
fi
