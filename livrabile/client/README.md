# PaletScore pentru fabrică

Versiune operațională cu roluri de muncitor și administrator, copiată din sursele furnizate de autor.

- Muncitor: acces cu nume și PIN, cronometru în trei pași, raportarea problemelor, asistent.
- Administrator: echipă, măsurători și mediane, export CSV, folosirea medianei în simulator, starea problemelor.
- Asistent: răspunsuri locale; integrare Claude opțională, cu revenire locală la eroare.

## Demonstrație

1. Folosește butoanele demo de pe ecranul de intrare. Conturile demo se creează local, fără configurare. Poți crea separat un cont propriu.
2. Pentru intrare manuală: Director Demo / DemoPalet2026 sau Operator Demo / PIN 2468, după prima folosire a accesului demo.
3. Schimbă utilizatorul și cronometrează un schimb sau raportează o problemă.
4. Revino ca administrator în același browser: consultă înregistrările, exportă CSV și transferă mediana în simulare.

## Limitele prototipului

Datele sunt locale în browser (`localStorage`), iar sesiunea este locală (`sessionStorage`). Dispozitivele diferite nu partajează înregistrările. Nu există backend sau comandă către robot. Rolurile locale nu reprezintă autorizare de producție. Integrarea AI externă nu este verificată prin testele numerice; cheia din browser este o soluție de prototip. Un pilot real cere backend, date comune și apeluri AI pe server.

Testele numerice: `node test.js`. Construire: `sh build.sh`.

## Verificare în browser pe 20 noiembrie 2026

Au fost verificate configurarea administratorului, adăugarea unui muncitor, ieșirea din cont, accesul cu PIN și deschiderea paginilor Cronometru și Probleme. Conturile Director Demo și Operator Demo sunt fictive. [Capturi reale](../capturi/). Nu au fost înregistrate măsurători industriale și nu a fost testat API-ul extern.

Pentru a reproduce scenariul financiar al planului, introdu explicit 50.000 EUR alte costuri, 16% impozit și patru celule/lună capacitate. Calendarul de comenzi februarie–august este 2, 2, 4, 4, 4, 4, 4. Valorile implicite ale aplicației pot fi diferite; fișierele Excel și planul definesc scenariul prezentat.
