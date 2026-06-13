import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment
from datetime import date, timedelta

wb = Workbook()
ws = wb.active
ws.title = "Viajes"

headers = [
    "Viaje",
    "Fecha",
    "Hora",
    "Categoria",
    "Pasajeros",
    "Telefonos",
    "Tipo",
    "Origen",
    "Destino",
    "Vuelo",
    "Observaciones",
]
ws.append(headers)

tomorrow = (date.today() + timedelta(days=1)).isoformat()

# Convencion:
#   - "Viaje" agrupa filas que pertenecen al mismo viaje (V1, V2, ...).
#   - La PRIMERA fila de cada Viaje lleva: Fecha, Hora, Categoria, Pasajeros.
#   - Las filas siguientes con el mismo Viaje agregan tramos adicionales.
#   - Pasajeros: varios separados con " | "  (ej: "R. Mendez | M. Rios").
#   - Telefonos: OBLIGATORIO, uno por pasajero, mismo orden, separados con " | ".
#   - Tipo: in (llegada con vuelo) / out (salida con vuelo) / otro / disposicion.

rows = [
    # V1 - simple, 1 tramo, 1 pasajero
    ["V1", tomorrow, "07:00", "Ejecutivo", "R. Mendez", "+54 11 5512 3344",
     "out", "Recoleta", "Aeropuerto Ezeiza (EZE)", "AA995", ""],

    # V2 - 1 tramo, 2 pasajeros (pipe-separados)
    ["V2", tomorrow, "09:30", "Ejecutivo", "K. Nunez | M. Rios", "+54 11 4490 7781 | +54 11 6033 2210",
     "out", "Palermo", "Aeroparque Jorge Newbery (AEP)", "", ""],

    # V3 - 2 tramos, 3 pasajeros. La 2da fila solo lleva Viaje + datos del tramo.
    ["V3", tomorrow, "11:15", "MiniVan", "S. Vega | A. Soto | J. Pereyra", "+54 11 5120 9087 | +54 11 3398 4456 | +54 11 6677 1230",
     "otro", "Tigre", "Microcentro", "", "Reservar 3 valijas"],
    ["V3", "", "", "", "", "",
     "otro", "Microcentro", "Puerto Madero", "", ""],

    # V4 - 3 tramos (in -> otro -> out), 1 pasajero, ejemplo realista de un dia completo
    ["V4", tomorrow, "14:00", "Auto STD", "L. Bravo", "+54 11 2245 8890",
     "in", "Aeroparque Jorge Newbery (AEP)", "Hotel Faena", "LA4302", ""],
    ["V4", "", "", "", "", "",
     "otro", "Hotel Faena", "San Isidro", "", ""],
    ["V4", "", "", "", "", "",
     "out", "San Isidro", "Aeropuerto Ezeiza (EZE)", "AA996", ""],

    # V5 - disposicion (sin vuelo, sin destino fijo realmente)
    ["V5", tomorrow, "10:00", "Ejecutivo", "F. Acosta", "+54 11 5588 1020",
     "disposicion", "Hotel Alvear", "Hotel Alvear", "", "4 hs disposicion"],
]
for r in rows:
    ws.append(r)

# --- estilos ---
HEADER_BG = "1F2937"
GROUP_ALT_BG = "F3F4F6"

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
mono_font = Font(name="Consolas", size=10, color="6B7280")

# Color alterno por grupo de Viaje + estilos por celda
prev_viaje = None
alt = False
for row_idx in range(2, ws.max_row + 1):
    viaje = ws.cell(row=row_idx, column=1).value
    if viaje and viaje != prev_viaje:
        alt = not alt
        prev_viaje = viaje
    fill = PatternFill("solid", start_color=GROUP_ALT_BG) if alt else PatternFill(fill_type=None)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=row_idx, column=col_idx)
        cell.border = border
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        if alt:
            cell.fill = fill
        cell.font = mono_font if col_idx == 1 else body_font

# Comentario aclaratorio en el header "Viaje"
ws.cell(row=1, column=1).comment = Comment(
    "Agrupa filas del mismo viaje (V1, V2...). "
    "La primera fila de cada Viaje completa Fecha/Hora/Categoria/Pasajeros. "
    "Las siguientes filas con el mismo Viaje se interpretan como tramos adicionales.",
    "Plantilla",
)
ws.cell(row=1, column=5).comment = Comment(
    "Multiples pasajeros separados por  |  (ej: R. Mendez | M. Rios). Maximo 4.",
    "Plantilla",
)
ws.cell(row=1, column=6).comment = Comment(
    "OBLIGATORIO. Un telefono por pasajero, en el MISMO orden, separados por  |  .",
    "Plantilla",
)
ws.cell(row=1, column=7).comment = Comment(
    "in = llegada (con vuelo)\nout = salida (con vuelo)\notro = traslado\ndisposicion = horas a disposicion",
    "Plantilla",
)

# Anchos
widths = {
    "A": 7,    # Viaje
    "B": 12,   # Fecha
    "C": 8,    # Hora
    "D": 12,   # Categoria
    "E": 34,   # Pasajeros
    "F": 34,   # Telefonos
    "G": 12,   # Tipo
    "H": 32,   # Origen
    "I": 32,   # Destino
    "J": 10,   # Vuelo
    "K": 30,   # Observaciones
}
for col, w in widths.items():
    ws.column_dimensions[col].width = w

ws.row_dimensions[1].height = 26
ws.freeze_panes = "A2"

# --- Hoja de instrucciones ---
ws2 = wb.create_sheet("Instrucciones")
ws2.column_dimensions["A"].width = 22
ws2.column_dimensions["B"].width = 90

bold = Font(name="Arial", size=11, bold=True)
norm = Font(name="Arial", size=11)
title = Font(name="Arial", size=14, bold=True, color="1F2937")

ws2["A1"] = "Plantilla de carga de viajes"
ws2["A1"].font = title
ws2.merge_cells("A1:B1")

instrucciones = [
    ("Hoja Viajes", "Una fila por TRAMO. Para varios tramos del mismo viaje, repeti el ID de Viaje."),
    ("Viaje", "Identificador interno del viaje (V1, V2, ...). Agrupa tramos."),
    ("Fecha / Hora", "Solo en la PRIMERA fila de cada Viaje. Formato Fecha YYYY-MM-DD, Hora HH:MM (24h)."),
    ("Categoria", "Auto STD / Ejecutivo / MiniVan. Solo en la primera fila del Viaje."),
    ("Pasajeros", "Solo en la primera fila. Separa varios pasajeros con  |  (pipe). Maximo 4."),
    ("Telefonos", "OBLIGATORIO. Un telefono por pasajero, en el mismo orden, separados con  |  (pipe)."),
    ("Tipo", "in = llegada con vuelo · out = salida con vuelo · otro = traslado · disposicion = horas a disposicion."),
    ("Origen / Destino", "Direccion o lugar. En tramos siguientes, Origen suele coincidir con el Destino anterior."),
    ("Vuelo", "Solo para tipo in / out (ej: AA995). Dejar vacio en otros casos."),
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

out = os.path.join(os.path.dirname(__file__), "..", "public", "plantilla-viajes.xlsx")
wb.save(out)
print("OK", out)
