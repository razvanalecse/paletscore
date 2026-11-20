# PaletScore pentru fabrică

Versiune operațională cu roluri de muncitor și administrator, copiată din sursele furnizate de autor.

- Muncitor: acces cu nume și PIN, cronometru în trei pași, raportarea problemelor, asistent.
- Administrator: echipă, măsurători și mediane, export CSV, folosirea medianei în simulator, starea problemelor.
- Asistent: răspunsuri locale; integrare Claude opțională, cu revenire locală la eroare.

## Demonstrație

1. Creează primul administrator cu date fictive.
2. Adaugă un muncitor cu PIN.
3. Schimbă utilizatorul și cronometrează un schimb sau raportează o problemă.
4. Revino ca administrator în același browser: consultă înregistrările, exportă CSV și transferă mediana în simulare.

## Limitele prototipului

Datele sunt locale în browser (`localStorage`), iar sesiunea este locală (`sessionStorage`). Dispozitivele diferite nu partajează înregistrările. Nu există backend sau comandă către robot. Rolurile locale nu reprezintă autorizare de producție. Integrarea AI externă nu este verificată prin testele numerice; cheia din browser este o soluție de prototip. Un pilot real cere backend, date comune și apeluri AI pe server.

Testele numerice: `node test.js`. Construire: `sh build.sh`.
