# Genera public/plantilla-viajes.xlsx (la plantilla descargable del modal de
# carga por Excel). El formato sigue el ejemplo provisto por el cliente:
#   - Fecha partida en Dia / Mes / Año (3 columnas numericas).
#   - Una fila por VIAJE. Tramos adicionales del mismo viaje se cargan en las
#     columnas "Destino 2" y "Destino 3" (no se repiten filas).
#   - Columna "Telefono": uno por pasajero, mismo orden, separados con " | ".
#   - Tipo y Categoria con desplegable (validacion de datos) desde la hoja LOV.
#
# NOTA: el parseo real del Excel ocurre en el backend (/trips/excel/parse).
# Si se cambian columnas o los valores de Tipo/Categoria, el parser del backend
# debe actualizarse en consecuencia.
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from datetime import date, timedelta

wb = Workbook()
ws = wb.active
ws.title = "Viajes"

headers = [
    "Dia",            # A
    "Mes",            # B
    "Año",            # C
    "Hora",           # D
    "Categoria",      # E
    "Pasajeros",      # F
    "Telefono",       # G
    "Tipo",           # H
    "Origen",         # I
    "Destino",        # J
    "Vuelo",          # K
    "Observaciones",  # L
    "Destino 2",      # M
    "Destino 3",      # N
]
ws.append(headers)

# Listas de valores (deben coincidir con la hoja LOV de abajo).
TIPOS = ["Llegada (in)", "Salida (out)", "Hs Disposición", "Otro"]
CATEGORIAS = ["Auto Std", "Ejecutivo", "MB", "Vito"]

t = date.today() + timedelta(days=1)
D, M, Y = t.day, t.month, t.year

# Filas de ejemplo. Una fila = un viaje. Columnas:
# Dia, Mes, Año, Hora, Categoria, Pasajeros, Tel, Tipo, Origen, Destino,
# Vuelo, Observaciones, Destino 2, Destino 3
rows = [
    # Llegada con vuelo, 1 pasajero
    [D, M, Y, "07:30", "Ejecutivo", "JUAN PABLO VOJVODA", "+54 9 11 5555-1234",
     "Llegada (in)", "Aeropuerto Ezeiza (EZE)", "725 Continental", "AR1234", "", "", ""],

    # Salida con vuelo, 2 pasajeros (separados con  |  ) y 2 telefonos alineados
    [D, M, Y, "10:00", "Auto Std", "M. ROJO | N. FABBRI",
     "+54 9 11 4490-7781 | +54 9 11 6033-2210",
     "Salida (out)", "Santos Dumont 3429", "Aeropuerto Ezeiza (EZE)", "AR1256", "", "", ""],

    # Salida con vuelo (interior), categoria MB
    [D, M, Y, "11:15", "MB", "CHAQUEÑO PALAVECINO", "+54 9 387 555-1456",
     "Salida (out)", "Balcarce 230, Salta", "Aeropuerto de Salta", "AR1456", "", "", ""],

    # Traslado de varios tramos: Origen -> Destino -> Destino 2 (categoria Vito)
    [D, M, Y, "14:00", "Vito", "MARTÍN ROMAGNOLI", "+54 9 11 5555-4302",
     "Otro", "Hotel Faena", "Hotel Alvear", "", "Pasa a buscar valijas", "San Isidro", ""],

    # Horas a disposicion (sin vuelo)
    [D, M, Y, "10:00", "Ejecutivo", "F. ACOSTA", "+54 9 11 5555-7788",
     "Hs Disposición", "Hotel Alvear", "Hotel Alvear", "", "4 hs a disposicion", "", ""],
]
for r in rows:
    ws.append(r)

# --- estilos ---
HEADER_BG = "1F2937"
ALT_BG = "F3F4F6"

header_font = Font(name="Arial", bold=True, color="FFFFFF", size=11)
header_fill = PatternFill("solid", start_color=HEADER_BG)
header_align = Alignment(horizontal="left", vertical="center")
thin = Side(border_style="thin", color="D1D5DB")
border = Border(left=thin, right=thin, top=thin, bottom=thin)

for col_idx, _ in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col_idx)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = border

body_font = Font(name="Arial", size=11)
for row_idx in range(2, ws.max_row + 1):
    alt = (row_idx % 2) == 1
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=row_idx, column=col_idx)
        cell.border = border
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        cell.font = body_font
        if alt:
            cell.fill = PatternFill("solid", start_color=ALT_BG)

# Comentarios aclaratorios en headers clave
ws.cell(row=1, column=1).comment = Comment(
    "Dia / Mes / Año: completar solo con numeros (ej: 19 / 6 / 2026).", "Plantilla")
ws.cell(row=1, column=6).comment = Comment(
    "Varios pasajeros separados por  |  (ej: M. Rojo | N. Fabbri). Maximo 4.", "Plantilla")
ws.cell(row=1, column=7).comment = Comment(
    "Un telefono por pasajero, en el MISMO orden y separados por  |  "
    "(ej: +54 9 11 4490-7781 | +54 9 11 6033-2210).", "Plantilla")
ws.cell(row=1, column=8).comment = Comment(
    "Llegada (in) = arribo con vuelo\nSalida (out) = salida con vuelo\n"
    "Hs Disposición = horas a disposicion\nOtro = traslado", "Plantilla")
ws.cell(row=1, column=13).comment = Comment(
    "Destino 2 / Destino 3: tramos adicionales del mismo viaje. "
    "Dejar vacio si el viaje tiene un solo tramo.", "Plantilla")

# Anchos
widths = {
    "A": 6, "B": 6, "C": 7, "D": 8, "E": 12, "F": 28, "G": 18, "H": 16,
    "I": 30, "J": 30, "K": 9, "L": 26, "M": 24, "N": 24,
}
for col, w in widths.items():
    ws.column_dimensions[col].width = w

ws.row_dimensions[1].height = 26
ws.freeze_panes = "A2"

# --- Hoja LOV (listas para los desplegables) ---
lov = wb.create_sheet("LOV")
lov["A1"] = "Tipo"
lov["B1"] = "Categoria"
lov["A1"].font = header_font
lov["B1"].font = header_font
lov["A1"].fill = header_fill
lov["B1"].fill = header_fill
for i, v in enumerate(TIPOS, start=2):
    lov.cell(row=i, column=1, value=v)
for i, v in enumerate(CATEGORIAS, start=2):
    lov.cell(row=i, column=2, value=v)
lov.column_dimensions["A"].width = 18
lov.column_dimensions["B"].width = 14

# Validacion de datos (desplegables) sobre toda la columna util
dv_tipo = DataValidation(
    type="list", formula1=f"=LOV!$A$2:$A${len(TIPOS) + 1}", allow_blank=True)
dv_tipo.error = "Elegi un Tipo de la lista."
dv_tipo.prompt = "Elegi: Llegada (in) / Salida (out) / Hs Disposición / Otro"
ws.add_data_validation(dv_tipo)
dv_tipo.add(f"H2:H200")

dv_cat = DataValidation(
    type="list", formula1=f"=LOV!$B$2:$B${len(CATEGORIAS) + 1}", allow_blank=True)
dv_cat.error = "Elegi una Categoria de la lista."
dv_cat.prompt = "Elegi: Auto Std / Ejecutivo / MB / Vito"
ws.add_data_validation(dv_cat)
dv_cat.add(f"E2:E200")

# --- Hoja de instrucciones ---
ws2 = wb.create_sheet("Instrucciones")
ws2.column_dimensions["A"].width = 22
ws2.column_dimensions["B"].width = 92

bold = Font(name="Arial", size=11, bold=True)
norm = Font(name="Arial", size=11)
title = Font(name="Arial", size=14, bold=True, color="1F2937")

ws2["A1"] = "Plantilla de carga de viajes"
ws2["A1"].font = title
ws2.merge_cells("A1:B1")

instrucciones = [
    ("Hoja Viajes", "Una fila por VIAJE. Para tramos adicionales usa las columnas Destino 2 y Destino 3."),
    ("Dia / Mes / Año", "Completar los tres campos solo con numeros (ej: 19 / 6 / 2026)."),
    ("Hora", "Formato HH:MM en 24 horas (ej: 07:30)."),
    ("Categoria", "Elegir del desplegable: Auto Std / Ejecutivo / MB / Vito."),
    ("Pasajeros", "Nombre del pasajero. Varios separados con  |  (pipe). Maximo 4."),
    ("Telefono", "OBLIGATORIO. Un telefono por pasajero, en el mismo orden que Pasajeros, "
                 "separados con  |  (ej: +54 9 11 4490-7781 | +54 9 11 6033-2210)."),
    ("Tipo", "Llegada (in) = arribo con vuelo · Salida (out) = salida con vuelo · "
             "Hs Disposición = horas a disposicion · Otro = traslado."),
    ("Origen / Destino", "Direccion o lugar (el sistema usa Google Maps para geolocalizar la direccion)."),
    ("Destino 2 / Destino 3", "Tramos adicionales del mismo viaje. Dejar vacio si hay un solo tramo."),
    ("Vuelo", "Solo para tipo Llegada (in) / Salida (out), ej: AR1234. Dejar vacio en otros casos."),
    ("Observaciones", "Texto libre opcional."),
]

row = 3
for label, text in instrucciones:
    ws2.cell(row=row, column=1, value=label).font = bold
    ws2.cell(row=row, column=1).alignment = Alignment(vertical="top")
    c = ws2.cell(row=row, column=2, value=text)
    c.font = norm
    c.alignment = Alignment(wrap_text=True, vertical="top")
    ws2.row_dimensions[row].height = 30
    row += 1

out = r"C:\caltamirano\logos2\public\plantilla-viajes.xlsx"
wb.save(out)
print("OK", out)
