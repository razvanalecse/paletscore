# Generează modelul financiar editabil (cu formule) pentru PaletScore.
# Rulare: python build_xlsx.py  → Model_financiar_PaletScore.xlsx
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment

BLUE = Font(name="Arial", color="0000FF")
GREEN = Font(name="Arial", color="008000")
BLACK = Font(name="Arial", color="000000")
BOLD = Font(name="Arial", bold=True)
TITLE = Font(name="Arial", bold=True, size=14)
NOTE = Font(name="Arial", italic=True, color="555555", size=9)
YELLOW = PatternFill("solid", fgColor="FFFF00")
HEAD = PatternFill("solid", fgColor="E4E6E7")
LINE = Border(top=Side(style="thin", color="999999"))
EUR = '#,##0 "EUR";(#,##0 "EUR");-'
NUM1 = '#,##0.0;(#,##0.0);-'
NUM0 = '#,##0;(#,##0);-'
PCT = '0.0%;(0.0%);-'

wb = Workbook()


def sheet(ws, title, widths):
    ws["A1"] = title
    ws["A1"].font = TITLE
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


def put(ws, ref, value, font=BLACK, fmt=None, fill=None, note=None):
    c = ws[ref]
    c.value = value
    c.font = font
    if fmt:
        c.number_format = fmt
    if fill:
        c.fill = fill
    if note:
        c.comment = Comment(note, "PaletScore")
    return c


# ---------- Ipoteze ----------
ws = wb.active
ws.title = "Ipoteze"
sheet(ws, "Ipoteze — modificați doar celulele albastre", {"A": 38, "B": 16, "C": 70})
put(ws, "A2", "Legendă: text albastru = valoare editabilă · fundal galben = de completat sau ipoteză-cheie · verde = legătură din altă foaie · negru = formulă.", NOTE)
rows = [
    ("Preț pe celulă (EUR, fără TVA)", 130000, EUR, None, "Tema concursului, scenariul cerut; nu este prețul real al proiectului PURATOS."),
    ("Cost direct pe celulă (EUR)", 110000, EUR, None, "Tema concursului: echipamente, realizare, instalare, instruire."),
    ("Alte costuri anuale (EUR)", 0, EUR, YELLOW, "De completat. Tema nu precizează aceste costuri; 0 este doar punctul de pornire."),
    ("Impozit pe profit", 0.16, PCT, YELLOW, "Ipoteză: cota standard de impozit pe profit din România. De confirmat cu regimul fiscal real."),
    ("Țintă profit net anual (EUR)", 300000, EUR, None, "Tema concursului: cerința acționarilor."),
    ("Rată cerere relevantă → întâlnire tehnică", 0.35, PCT, YELLOW, "Ipoteză de lucru a echipei, nu rată de piață."),
    ("Rată întâlnire tehnică → client", 0.28, PCT, YELLOW, "Ipoteză de lucru a echipei, nu rată de piață."),
    ("Celule pe client", 2, NUM1, YELLOW, "Ipoteză: PURATOS a cumpărat două celule."),
    ("Livrare după comandă (luni)", 4, NUM0, None, "Reperul cazului PURATOS: livrare în aproximativ patru luni."),
    ("Instalări posibile pe lună (celule)", 3, NUM0, YELLOW, "Ipoteză privind capacitatea echipei Tech-Con. De confirmat."),
    ("Buget total de promovare (EUR)", 30000, EUR, None, "Tema concursului: 30.000 EUR/an. Modificați pentru negocierea bugetului (de exemplu 20.000)."),
]
put(ws, "A3", "Parametru", BOLD, fill=HEAD)
put(ws, "B3", "Valoare", BOLD, fill=HEAD)
put(ws, "C3", "Sursă / observație", BOLD, fill=HEAD)
for i, (label, val, fmt, fill, note) in enumerate(rows, start=4):
    put(ws, f"A{i}", label)
    put(ws, f"B{i}", val, BLUE, fmt, fill)
    put(ws, f"C{i}", note, NOTE)
# referințe: B4 preț, B5 cost, B6 alte costuri, B7 impozit, B8 țintă, B9 întâlnire, B10 client, B11 celule/client, B12 livrare, B13 capacitate

# ---------- Promovare ----------
wp = wb.create_sheet("Promovare")
sheet(wp, "Bugetul anual de promovare (30.000 EUR)", {"A": 40, "B": 16, "C": 18, "D": 14, "E": 60})
for col, h in zip("ABCDE", ["Canal", "EUR / an", "EUR / cerere relevantă", "Cereri", "Observație"]):
    put(wp, f"{col}3", h, BOLD, fill=HEAD)
channels = [
    ("Google Search", 6000, 150, "Reclame pentru firme care caută soluții de paletizare."),
    ("LinkedIn plătit", 4500, 250, "Directori de producție și responsabili de investiții."),
    ("Conținut UR20 (studiu de caz, video)", 4500, 0, "Susține celelalte canale; nu aduce cereri directe în model."),
    ("Pagină web, SEO și AI", 3750, 300, "Pagină, formular, măsurare."),
    ("Aplicație web pentru telefon", 3000, 300, "Prototipul PaletScore, cu cerere de evaluare."),
    ("Marketing direct și CRM", 2250, 100, "Contacte abordabile legitim, mesaje personalizate."),
    ("Webinare și parteneriate", 2250, 150, "Demonstrații online, asociații industriale."),
    ("YouTube și teste sociale", 1500, 500, "Distribuție plătită a video-urilor deja bugetate."),
    ("Rezervă", 2250, 0, "Se alocă după evaluarea rezultatelor."),
]
first = 4
for i, (name, eur, cpr, note) in enumerate(channels, start=first):
    put(wp, f"A{i}", name)
    put(wp, f"B{i}", eur, BLUE, EUR)
    put(wp, f"C{i}", cpr, BLUE, EUR, YELLOW, "Ipoteză: cost estimat pe cerere relevantă. 0 = canalul nu aduce cereri directe.")
    put(wp, f"D{i}", f"=IF(C{i}>0,B{i}/C{i},0)", BLACK, NUM1)
    put(wp, f"E{i}", note, NOTE)
last = first + len(channels) - 1
tot = last + 1
put(wp, f"A{tot}", "Total", BOLD)
put(wp, f"B{tot}", f"=SUM(B{first}:B{last})", BOLD, EUR)
put(wp, f"D{tot}", f"=SUM(D{first}:D{last})", BOLD, NUM1)
for col in "ABCD":
    wp[f"{col}{tot}"].border = LINE
put(wp, f"A{tot + 1}", f'=IF(ROUND(B{tot},0)=ROUND(Ipoteze!B14,0),"Bugetul se închide la totalul din Ipoteze","Atenție: totalul canalelor diferă de bugetul din Ipoteze (B14)")', BOLD)
put(wp, f"A{tot + 2}", "Un client venit din mai multe canale se numără o singură dată. Un click nu este o cerere relevantă.", NOTE)

# ---------- Pâlnie ----------
wf = wb.create_sheet("Pâlnie")
sheet(wf, "Pâlnia comercială", {"A": 38, "B": 16, "C": 60})
put(wf, "A3", "Etapă", BOLD, fill=HEAD)
put(wf, "B3", "Valoare", BOLD, fill=HEAD)
put(wf, "C3", "Calcul", BOLD, fill=HEAD)
funnel = [
    ("Cereri relevante", f"=Promovare!D{tot}", GREEN, NUM1, "Suma cererilor pe canale"),
    ("Întâlniri tehnice", "=B4*Ipoteze!B9", BLACK, NUM1, "Cereri × rata cerere → întâlnire"),
    ("Clienți câștigați", "=B5*Ipoteze!B10", BLACK, NUM1, "Întâlniri × rata întâlnire → client"),
    ("Celule comandate", "=B6*Ipoteze!B11", BLACK, NUM1, "Clienți × celule pe client"),
    ("Cost pe cerere relevantă (EUR)", f"=IF(B4>0,Promovare!B{tot}/B4,0)", BLACK, EUR, "Tot bugetul / cereri"),
    ("Cost pe client câștigat (EUR)", f"=IF(B6>0,Promovare!B{tot}/B6,0)", BLACK, EUR, "Tot bugetul / clienți"),
]
for i, (label, f, font, fmt, note) in enumerate(funnel, start=4):
    put(wf, f"A{i}", label)
    put(wf, f"B{i}", f, font, fmt)
    put(wf, f"C{i}", note, NOTE)

# ---------- Calendar ----------
wc = wb.create_sheet("Calendar")
sheet(wc, "Calendarul comenzilor și livrărilor (anul analizat: 1 ianuarie – 31 decembrie)", {"A": 34})
months = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"]
orders = [1, 2, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0]
cols = [chr(ord("B") + i) for i in range(12)]
put(wc, "A3", "Luna", BOLD, fill=HEAD)
put(wc, "A4", "Număr lună", BOLD)
put(wc, "A5", "Comenzi (celule)", BOLD)
put(wc, "A6", "Livrări în lună", BOLD)
put(wc, "A7", "Verificare capacitate", BOLD)
for i, col in enumerate(cols):
    wc.column_dimensions[col].width = 11
    put(wc, f"{col}3", months[i], BOLD, fill=HEAD).alignment = Alignment(horizontal="center")
    put(wc, f"{col}4", i + 1, BLACK, NUM0)
    put(wc, f"{col}5", orders[i], BLUE, NUM0, YELLOW if i == 0 else None)
    put(wc, f"{col}6", f"=IF({col}4-Ipoteze!$B$12>=1,INDEX($B$5:$M$5,{col}4-Ipoteze!$B$12),0)", BLACK, NUM0)
    put(wc, f"{col}7", f'=IF({col}6>Ipoteze!$B$13,"peste capacitate","ok")', BLACK)
wc["B5"].comment = Comment("Comenzile pe lună. Punct de pornire: celulele din pâlnie, repartizate crescător. Editați liber.", "PaletScore")
put(wc, "A9", "Celule comandate în an", BOLD)
put(wc, "B9", "=SUM(B5:M5)", BLACK, NUM0)
put(wc, "A10", "Celule livrate în an", BOLD)
put(wc, "B10", "=SUM(B6:M6)", BOLD, NUM0)
put(wc, "A11", "Trec în anul următor", BOLD)
put(wc, "B11", "=B9-B10", BLACK, NUM0)
put(wc, "A12", "Ultima lună utilă pentru comandă", BOLD)
put(wc, "B12", "=INDEX($B$3:$M$3,12-Ipoteze!B12)", BLACK)
put(wc, "A13", "Comenzile pornesc din Pâlnie (B7); calendarul presupune livrare exact după termenul din Ipoteze. Rândul 7 semnalează lunile în care livrările depășesc capacitatea de instalare.", NOTE)

# ---------- Rezultat ----------
wr = wb.create_sheet("Rezultat")
sheet(wr, "Rezultatul anului", {"A": 46, "B": 18, "C": 60})
put(wr, "A3", "Indicator", BOLD, fill=HEAD)
put(wr, "B3", "Valoare", BOLD, fill=HEAD)
put(wr, "C3", "Formula", BOLD, fill=HEAD)
res = [
    ("Celule livrate în an", "=Calendar!B10", GREEN, NUM0, "Din calendar"),
    ("Contribuție pe celulă (EUR)", "=Ipoteze!B4-Ipoteze!B5", BLACK, EUR, "Preț − cost direct"),
    ("Contribuție anuală (EUR)", "=B4*B5", BLACK, EUR, "Celule × contribuție pe celulă"),
    ("Promovare (EUR)", f"=Promovare!B{tot}", GREEN, EUR, "Bugetul total"),
    ("Rezultat după promovare (EUR)", "=B6-B7", BLACK, EUR, "Înainte de alte costuri și impozit"),
    ("Rezultat înainte de impozit (EUR)", "=B8-Ipoteze!B6", BLACK, EUR, "După alte costuri"),
    ("Impozit pe profit (EUR)", "=IF(B9>0,B9*Ipoteze!B7,0)", BLACK, EUR, "Doar pe profit pozitiv"),
    ("Profit net (EUR)", "=B9-B10", BOLD, EUR, "Rezultat înainte de impozit − impozit"),
    ("Țintă profit net (EUR)", "=Ipoteze!B8", GREEN, EUR, "Cerința acționarilor"),
    ("Diferență față de țintă (EUR)", "=B11-B12", BLACK, EUR, "Pozitiv = peste țintă"),
    ("Celule necesare pentru țintă", "=IF(AND(B5>0,Ipoteze!B7<1),ROUNDUP((Ipoteze!B8/(1-Ipoteze!B7)+Ipoteze!B6+B7)/B5,0),0)", BOLD, NUM0, "(țintă / (1 − impozit) + alte costuri + promovare) / contribuție pe celulă"),
    ("Concluzie", '=IF(B11>=B12,"Ținta este atinsă cu aceste ipoteze","Ținta nu este atinsă: lipsesc "&TEXT(B14-B4,"0")&" celule livrate")', BOLD, None, "Valabil doar cu ipotezele din foaia Ipoteze"),
]
for i, (label, f, font, fmt, note) in enumerate(res, start=4):
    put(wr, f"A{i}", label)
    put(wr, f"B{i}", f, font, fmt)
    put(wr, f"C{i}", note, NOTE)
put(wr, "A17", "Valori de exercițiu din tema concursului, nu prețurile reale ale proiectului PURATOS. Profitul net depinde de alte costuri și de impozit, care trebuie confirmate.", NOTE)

for w in wb.worksheets:
    w.sheet_view.showGridLines = False
    w.freeze_panes = "A4"

wb.save("Model_financiar_PaletScore.xlsx")
print("Model_financiar_PaletScore.xlsx gata")
