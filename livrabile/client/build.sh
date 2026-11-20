#!/bin/sh
# Construiește site-ul static din dist/ (index.html + model.js), gata de publicat pe GitHub Pages, Netlify sau Vercel.
set -e
cd "$(dirname "$0")"
mkdir -p dist
{
  printf '<!doctype html>\n<html lang="ro">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  V=$(date +%s)
  sed -e "s|src=\"model.js\"|src=\"model.js?v=$V\"|" -e "s|src=\"roles.js\"|src=\"roles.js?v=$V\"|" -e "s|href=\"roles.css\"|href=\"roles.css?v=$V\"|" paletscore.html
  printf '\n</body>\n</html>\n'
} > dist/index.html
cp model.js roles.js roles.css dist/
# copie pentru GitHub Pages (servit din rădăcina depozitului)
cp dist/index.html index.html
echo "dist/ gata"
