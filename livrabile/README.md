# PaletScore — cod și documente

Toate materialele proiectului sunt grupate în acest folder.

| Material | Link |
| --- | --- |
| Plan de afaceri editabil | [Word](Plan_de_afaceri_PaletScore.docx) |
| Plan de afaceri pentru citire | [PDF](Plan_de_afaceri_PaletScore.pdf) |
| Pitch PDF furnizat | [PITCH FRUMOS](PITCH_FRUMOS.pdf) |
| Aplicația | [Deschide aplicația](https://razvanalecse.github.io/paletscore/livrabile/) |
| Versiunea pentru clientul fabrică | [Deschide](https://razvanalecse.github.io/paletscore/livrabile/client/) · [Cod și instrucțiuni](client/) |
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

## Actualizare pentru fabrică

Folderul `client/` adaugă rolurile, cronometrul muncitorului, raportările și administrarea. Planul de afaceri include funcțiile noi, limitele stocării locale și condițiile pentru un pilot. Proiecțiile financiare nu presupun venituri noi din software.

## Documente separate pentru evaluare

| Criteriu | Livrabil | Format |
| --- | --- | --- |
| Strategie | [Strategie de o pagină](Strategie_PaletScore.pdf) | [Word editabil](Strategie_PaletScore.docx) |
| Utilizare critică AI | [Jurnal AI de o pagină](Jurnal_AI_PaletScore.pdf) | [Word editabil](Jurnal_AI_PaletScore.docx) |
| Promovare | [Afiș de o pagină](Promovare_PaletScore.pdf) | [Word](Promovare_PaletScore.docx) · [PNG](Promovare_PaletScore.png) |
| Model financiar | [Excel cu formule](Model_financiar_PaletScore.xlsx) | Editabil |
| Pitch | [Pitch furnizat de 5 pagini](PITCH_FRUMOS.pdf) | PDF |
| Aplicație și demonstrație | [Aplicație](https://razvanalecse.github.io/paletscore/) · [Versiune fabrică](https://razvanalecse.github.io/paletscore/livrabile/client/) | Browser |
| Plan detaliat suplimentar | [30 pagini](Plan_de_afaceri_PaletScore.pdf) | [Word](Plan_de_afaceri_PaletScore.docx) |

Pentru jurnalul AI, calculele de numerar și VAN pot fi reproduse prin `python3 verificari_suplimentare.py`. Reperele și scenariile rămân condiționate de ipotezele declarate. Testele numerice nu certifică autentificarea sau integrarea AI externă.
