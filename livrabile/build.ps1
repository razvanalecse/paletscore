# Echivalentul lui build.sh, pentru Windows: powershell -ExecutionPolicy Bypass -File build.ps1
# Construiește dist/ (index.html + model.js + roles.js + roles.css) și copia din rădăcină pentru GitHub Pages.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force dist | Out-Null
$v = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$utf8 = New-Object System.Text.UTF8Encoding($false)
$body = [IO.File]::ReadAllText("$PSScriptRoot\paletscore.html", $utf8)
$body = $body.Replace('src="model.js"', "src=`"model.js?v=$v`"").Replace('src="roles.js"', "src=`"roles.js?v=$v`"").Replace('href="roles.css"', "href=`"roles.css?v=$v`"")
$head = "<!doctype html>`n<html lang=`"ro`">`n<head>`n<meta charset=`"utf-8`">`n<meta name=`"viewport`" content=`"width=device-width, initial-scale=1, viewport-fit=cover`">`n" +
  "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>`n</head>`n<body>`n"
[IO.File]::WriteAllText("$PSScriptRoot\dist\index.html", $head + $body + "`n</body>`n</html>`n", $utf8)
foreach ($f in 'model.js', 'roles.js', 'roles.css') { Copy-Item $f "dist\$f" -Force }
Copy-Item dist\index.html index.html -Force
Write-Host 'dist/ gata'
