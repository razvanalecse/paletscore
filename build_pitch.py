# Generează pitch/index.html: pitch-ul ca pagină de prezentare pentru GitHub Pages.
# Sursa: pitch/src (deck.json, deck.css, slides/*.html, copiate din pitch-ul de pe claude.ai).
# Rulare: python3 build_pitch.py
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'pitch', 'src')
deck = json.load(open(os.path.join(SRC, 'deck.json'), encoding='utf-8'))
css = open(os.path.join(SRC, 'deck.css'), encoding='utf-8').read()

# Imaginile încărcate în pitch-ul de pe claude.ai, înlocuite cu fișierele locale.
BLOBS = {
    '/_blob/71cc3997177bad1711ef0765ca1b83d3': 'img/blocked.png',
    '/_blob/f9afc19b63c6183fedf4eda52d5ffed7': 'img/running.png',
}
# Iconițele din Slides, desenate ca SVG simplu.
ICONS = {
    'Users': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.6-.4 4.7 1.2 5.5 4"/></svg>',
    'Trust': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M8.8 12.2l2.2 2.2 4.4-4.6"/></svg>',
}

slides = []
for sid in deck['order']:
    html = open(os.path.join(SRC, 'slides', sid + '.html'), encoding='utf-8').read().strip()
    for blob, local in BLOBS.items():
        html = html.replace(blob, local)
    html = re.sub(r'<x-icon name="(\w+)" class="icon"></x-icon>', lambda m: ICONS.get(m.group(1), ''), html)
    slides.append(html)

faces = '&'.join(f['href'].split('?', 1)[1].replace('&display=swap', '') for f in deck['faces'].values())
fonts = 'https://fonts.googleapis.com/css2?' + faces + '&display=swap'

page = f'''<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{deck['title']}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<style>
{css}
/* prezentare */
html, body {{ margin: 0; height: 100%; background: #0E1012; overflow: hidden; }}
.stage {{ position: fixed; left: 50%; top: 50%; width: 1920px; height: 1080px; transform-origin: 0 0; }}
.stage > section {{ position: absolute; inset: 0; width: 1920px; height: 1080px; box-sizing: border-box; overflow: hidden; display: none; }}
.stage > section.current {{ display: flex; }}
aside {{ display: none; }}
.bar {{ position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; align-items: center; gap: 16px; padding: 10px; font: 600 14px 'Barlow', Arial, sans-serif; color: #A9AFB5; opacity: 0; transition: opacity .2s; }}
body:hover .bar {{ opacity: 1; }}
.bar button {{ font: inherit; color: #EEF0F0; background: #23272B; border: 0; border-radius: 4px; padding: 8px 14px; cursor: pointer; }}
.bar a {{ color: #F2BE1A; }}
@media (prefers-reduced-motion: reduce) {{ * {{ animation: none !important; }} }}
</style>
</head>
<body>
<div class="stage" id="stage">
{chr(10).join(slides)}
</div>
<div class="bar"><button type="button" id="prev" aria-label="Slide-ul anterior">←</button><span id="count"></span><button type="button" id="next" aria-label="Slide-ul următor">→</button><button type="button" id="fs">Ecran complet (F)</button><a href="../">Deschide aplicația</a></div>
<script>
(function () {{
  var stage = document.getElementById('stage'), slides = [].slice.call(stage.children), i = 0;
  function fit() {{
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = 'scale(' + s + ') translate(-50%, -50%)';
  }}
  function show(n) {{
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, k) {{ s.classList.toggle('current', k === i); }});
    document.getElementById('count').textContent = (i + 1) + ' / ' + slides.length;
    if (location.hash !== '#' + (i + 1)) history.replaceState(null, '', '#' + (i + 1));
  }}
  window.addEventListener('resize', fit);
  document.addEventListener('keydown', function (e) {{
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {{ e.preventDefault(); show(i + 1); }}
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(i - 1);
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') toggleFs();
  }});
  function toggleFs() {{ if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }}
  document.getElementById('prev').addEventListener('click', function () {{ show(i - 1); }});
  document.getElementById('next').addEventListener('click', function () {{ show(i + 1); }});
  document.getElementById('fs').addEventListener('click', toggleFs);
  stage.addEventListener('click', function (e) {{ show(e.clientX > window.innerWidth / 2 ? i + 1 : i - 1); }});
  fit();
  show((parseInt(location.hash.slice(1), 10) || 1) - 1);
}})();
</script>
</body>
</html>
'''
open(os.path.join(ROOT, 'pitch', 'index.html'), 'w', encoding='utf-8').write(page)
print('pitch/index.html gata,', len(slides), 'slide-uri')
