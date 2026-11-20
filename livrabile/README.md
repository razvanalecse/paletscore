# PaletScore — cod și documente

Toate materialele proiectului sunt grupate în acest folder.

| Material | Link |
| --- | --- |
| Plan de afaceri editabil | [Word](Plan_de_afaceri_PaletScore.docx) |
| Plan de afaceri pentru citire | [PDF](Plan_de_afaceri_PaletScore.pdf) |
| Pitch PDF furnizat | [PITCH FRUMOS](PITCH_FRUMOS.pdf) |
| Aplicația | [Deschide aplicația](https://razvanalecse.github.io/paletscore/livrabile/) |
| Pitch interactiv | [Deschide pitch-ul](https://razvanalecse.github.io/paletscore/livrabile/pitch/) |
| Model financiar aferent planului | [Excel](Model_financiar_PaletScore.xlsx) |
| Simulări și date | [Pachet Python](Simulari_Python_PaletScore.zip) |

## Codul aplicației Claude

- `paletscore.html` — interfața aplicației
- `model.js` — modelul de calcul
- `test.js` — teste numerice
- `index.html` — versiunea publicabilă
- `build.sh` — construirea aplicației
- `pitch/` și `build_pitch.py` — sursele pitch-ului interactiv

Sursele aplicației sunt copiate fără modificări din versiunea existentă a repository-ului.
PDF-ul de pitch este fișierul furnizat, păstrat fără modificări.

Pentru verificarea calculelor: `node test.js`. Pentru reconstruire: `sh build.sh`.
