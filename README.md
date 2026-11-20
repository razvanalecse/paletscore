# PaletScore

Prototip web pentru AI-Powered Business Challenge 2026 (secțiunea Studenți, tema Tech-Con / paletizare UR20).
Simulează secundă cu secundă o celulă UR20 cu două poziții și arată ce merită schimbat în fabrică.

**Aplicația:** https://razvanalecse.github.io/paletscore/

**Pitch-ul:** https://razvanalecse.github.io/paletscore/pitch/ (săgețile schimbă slide-ul, F pentru ecran complet; generat din `pitch/src` cu `python3 build_pitch.py`)

**Codul și documentele într-un singur folder:** [livrabile](livrabile/) — codul aplicației Claude, planul de afaceri Word/PDF, pitch-ul PDF, Excel-ul și simulările.

**Cine e cine:** utilizatorul este directorul de producție dintr-o fabrică alimentară, care își testează linia gratuit; clientul este Tech-Con, care plătește aplicația din bugetul de promovare și primește cererile.

## Cum testezi (2 minute)
1. **Demo 45 s**: flux stabil → schimbare în 7 minute → primul blocaj → intervenția recomandată pe aceeași oră.
2. **Primul blocaj** (scenariul „Schimbare lentă”): minutul 12:02. Apasă pe palet sau pe robot pentru Inspector și pentru „Unde merită să intervii?”.
3. **Ținta**: „Vreau minimum 430 de găleți/oră” → schimbare de cel mult 6 min 09 s → „Rulează la limită” → „+30 s” (401 găleți).
4. **Cronometru**: „Încarcă 8 observații demonstrative” → aplicația separă așteptarea operatorului de operație și spune ce contează mai mult.
5. **Plan comercial**: modifică bugetul pe canale și ratele; calendarul arată câte celule ajung livrate până la 31 decembrie.
6. Caz cu date greșite: `-3` sau `abc` la debit → mesaj de corectare, simularea nu pornește.

## Fișiere
- `model.js` — modelul de calcul unic (simulare, buffer, operatori, variație cu sămânță fixă, prag, țintă, intervenții, pâlnie, livrări)
- `paletscore.html` — interfața
- `test.js` — teste numerice (`node test.js`)
- `build.sh` — generează `dist/` pentru GitHub Pages / Netlify / Vercel
- `Model_financiar_PaletScore.xlsx` — modelul financiar editabil, cu formule (generat de `build_xlsx.py`)

Reperele PURATOS (7,4 și 8,6 găleți/min; 44 și 100 găleți/palet) sunt rezultate de test, nu garanții. Toate datele sunt fictive.
