# PaletScore / Line Lab

Prototip web pentru AI-Powered Business Challenge 2026 (secțiunea Studenți, tema Tech-Con / paletizare UR20).
Directorul de producție schimbă un parametru al liniei și vede, pe aceeași oră simulată, unde începe așteptarea robotului.

## Cum testezi
1. Deschide linkul și apasă **Demo de 45 de secunde**.
2. Sau: alege **Schimbare lentă**, apoi **Arată-mi primul blocaj** (minutul 12:02).
3. **Ce schimbăm?** → Salvează ca Varianta A → B = 90 s → Compară aceleași 60 de minute.
4. Caz cu date greșite: scrie `-3` sau `abc` la debit; simularea nu pornește și apare mesajul de corectare.

## Fișiere
- `model.js` — modelul de calcul unic (simulare, reguli, ergonomie, scenariu comercial)
- `paletscore.html` — interfața
- `test.js` — teste numerice (`node test.js`)
- `build.sh` — generează `dist/` pentru GitHub Pages / Netlify / Vercel

Reperele PURATOS (7,4 și 8,6 găleți/min; 44 și 100 găleți/palet) sunt rezultate de test, nu garanții. Toate datele de solicitare sunt fictive.
