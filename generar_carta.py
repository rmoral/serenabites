"""
Generador de carta PDF — Serena Bites v3
Estética: cocina mediterránea cuidada, paleta cítrica (limón + oliva + terracota).
Tono: Honest Greens / La Buena.
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, HexColor

# ---- Paleta Citrus Garden ----
CREAM      = HexColor("#fbf7ee")
CREAM_DEEP = HexColor("#f3ecd9")
PAPER      = HexColor("#fefcf7")
INK        = HexColor("#2a3a1f")
INK_SOFT   = HexColor("#5a6048")
LEMON      = HexColor("#f4c84a")
LEMON_DEEP = HexColor("#d9a82f")
LEMON_SOFT = HexColor("#f8dc7a")
OLIVE      = HexColor("#5b7f3a")
OLIVE_DEEP = HexColor("#3d5c22")
OLIVE_SOFT = HexColor("#7ba64c")
TERRA      = HexColor("#c25a2c")
TERRA_DEEP = HexColor("#9a4520")
LINE       = HexColor("#e0d6bd")

W, H = A4
PDF_PATH = "/home/claude/carta-serena-bites.pdf"

c = canvas.Canvas(PDF_PATH, pagesize=A4)
c.setTitle("Carta · Serena Bites")
c.setAuthor("Serena Bites")
c.setSubject("Real food, Mediterranean soul")


# ============================================================
# UTILIDADES
# ============================================================

def fill_bg(color):
    c.setFillColor(color)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def draw_logo(cx, cy, size=1.0):
    """Logo Citrus Garden: limón con dos hojas."""
    s = size

    # Hoja izquierda
    c.setFillColor(OLIVE)
    p = c.beginPath()
    p.moveTo(cx - 22*s, cy + 8*s)
    p.curveTo(cx - 17*s, cy + 18*s, cx - 5*s, cy + 14*s, cx - 1*s, cy + 6*s)
    p.curveTo(cx - 13*s, cy + 4*s, cx - 22*s, cy + 8*s, cx - 22*s, cy + 8*s)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    # Hoja derecha
    c.setFillColor(OLIVE_SOFT)
    p2 = c.beginPath()
    p2.moveTo(cx + 22*s, cy + 8*s)
    p2.curveTo(cx + 17*s, cy + 18*s, cx + 5*s, cy + 14*s, cx + 1*s, cy + 6*s)
    p2.curveTo(cx + 13*s, cy + 4*s, cx + 22*s, cy + 8*s, cx + 22*s, cy + 8*s)
    p2.close()
    c.drawPath(p2, fill=1, stroke=0)

    # Tallo
    c.setStrokeColor(OLIVE_DEEP)
    c.setLineWidth(1.2 * s)
    c.line(cx, cy + 6*s, cx, cy + 12*s)

    # Limón
    c.setFillColor(LEMON)
    c.ellipse(cx - 16*s, cy - 14*s, cx + 16*s, cy + 6*s, fill=1, stroke=0)

    # Reflejo
    c.setFillColor(LEMON_SOFT)
    c.ellipse(cx - 8*s, cy - 6*s, cx - 2*s, cy - 1*s, fill=1, stroke=0)

    # Puntas
    c.setFillColor(LEMON_DEEP)
    c.circle(cx - 16*s, cy - 4*s, 1.2*s, fill=1, stroke=0)
    c.circle(cx + 16*s, cy - 4*s, 1.2*s, fill=1, stroke=0)


def wrap_text(text, font, size, max_width):
    words = text.split()
    lines = []
    line = ""
    for w in words:
        test = (line + " " + w).strip()
        if c.stringWidth(test, font, size) < max_width:
            line = test
        else:
            if line: lines.append(line)
            line = w
    if line: lines.append(line)
    return lines


# ============================================================
# PÁGINA 1 — PORTADA
# ============================================================

fill_bg(CREAM)

c.setFillColor(LEMON_SOFT)
c.circle(W + 30, H - 60, 200, fill=1, stroke=0)

c.setFillColor(OLIVE_SOFT)
c.circle(-40, 80, 220, fill=1, stroke=0)

c.setFillColor(CREAM_DEEP)
c.circle(W/2, H/2 - 30, 270, fill=1, stroke=0)

c.setFillColor(OLIVE_DEEP)
c.rect(0, H - 50, W, 30, fill=1, stroke=0)
c.setFillColor(LEMON)
c.setFont("Helvetica-Bold", 8)
c.drawCentredString(W/2, H - 40, "R E A L   F O O D   ·   M E D I T E R R A N E A N   S O U L   ·   R E A L   F O O D")

draw_logo(W/2, H - 220, size=2.4)

c.setFillColor(INK)
c.setFont("Times-Roman", 60)
c.drawCentredString(W/2, H - 380, "Serena")

c.setFillColor(TERRA)
c.setFont("Times-Italic", 60)
c.drawCentredString(W/2, H - 438, "Bites")

c.setStrokeColor(LEMON)
c.setLineWidth(8)
c.setLineCap(1)
c.line(W/2 - 60, H - 446, W/2 + 60, H - 446)

c.setFillColor(INK_SOFT)
c.setFont("Helvetica", 10)
c.drawCentredString(W/2, H - 488, "C O C I N A   M E D I T E R R Á N E A   ·   D E   T E M P O R A D A")

c.setFillColor(INK)
c.setFont("Times-Italic", 22)
c.drawCentredString(W/2, H - 545, "Comida real,")
c.setFillColor(OLIVE_DEEP)
c.drawCentredString(W/2, H - 575, "cocinada con cuidado.")

# Pills inferiores
y_pills = 130
pills = [
    ("POKÉS & BOWLS", OLIVE_DEEP, CREAM),
    ("WRAPS & PITAS", TERRA, CREAM),
    ("BRUNCH", LEMON, OLIVE_DEEP),
    ("YOGUR & AÇAÍ", OLIVE_SOFT, CREAM),
]

c.setFont("Helvetica-Bold", 8)
total_w = 0
pw_list = []
for txt, _, _ in pills:
    pw = c.stringWidth(txt, "Helvetica-Bold", 8) + 22
    pw_list.append(pw)
    total_w += pw
total_w += 8 * (len(pills) - 1)

x_cursor = (W - total_w) / 2
for (txt, bg, fg), pw in zip(pills, pw_list):
    c.setFillColor(bg)
    c.roundRect(x_cursor, y_pills, pw, 18, 9, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x_cursor + 11, y_pills + 5, txt)
    x_cursor += pw + 8

c.setFillColor(INK_SOFT)
c.setFont("Helvetica", 8)
c.drawCentredString(W/2, 75, "C A R T A   ·   2 0 2 6")

c.setFillColor(LEMON_DEEP)
c.setFont("Helvetica-Bold", 12)
c.drawCentredString(W/2, 55, "✦ ✦ ✦")

c.showPage()


# ============================================================
# UTILIDADES PARA PÁGINAS INTERIORES
# ============================================================

def page_header(category_color, category_name, text_on_band=CREAM):
    fill_bg(CREAM)

    c.setFillColor(category_color)
    c.rect(0, H - 60, W, 60, fill=1, stroke=0)

    draw_logo(60, H - 32, size=0.55)

    c.setFillColor(text_on_band)
    c.setFont("Times-Roman", 14)
    c.drawString(95, H - 38, "Serena")
    c.setFont("Times-Italic", 14)
    c.drawString(140, H - 38, "Bites")

    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(W - 40, H - 38, category_name.upper())


def section_title(y, title, subtitle, accent_color, accent_text=CREAM):
    c.setFillColor(accent_color)
    c.setFont("Helvetica-Bold", 7)
    sub_w = c.stringWidth(subtitle.upper(), "Helvetica-Bold", 7) + 14
    c.roundRect(50, y + 25, sub_w, 14, 7, fill=1, stroke=0)
    c.setFillColor(accent_text)
    c.drawString(57, y + 29, subtitle.upper())

    c.setFillColor(INK)
    c.setFont("Times-Roman", 32)
    c.drawString(50, y - 8, title)


def draw_dish_card(x, y, w, h, name, desc, price, accent_color, tag=None, tag_bg=None, tag_fg=None):
    c.setFillColor(PAPER)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.roundRect(x, y, w, h, 12, fill=1, stroke=1)

    c.setFillColor(accent_color)
    c.roundRect(x + 8, y + 10, 4, h - 20, 2, fill=1, stroke=0)

    px = x + 22
    pw = w - 32

    c.setFillColor(INK)
    c.setFont("Times-Roman", 13)
    c.drawString(px, y + h - 22, name)

    c.setFillColor(OLIVE_DEEP)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(x + w - 12, y + h - 22, price)

    next_y = y + h - 38

    if tag:
        c.setFillColor(tag_bg or LEMON)
        c.setFont("Helvetica-Bold", 6)
        tw = c.stringWidth(tag.upper(), "Helvetica-Bold", 6) + 10
        c.roundRect(px, next_y, tw, 10, 5, fill=1, stroke=0)
        c.setFillColor(tag_fg or OLIVE_DEEP)
        c.drawString(px + 5, next_y + 2.5, tag.upper())
        next_y -= 12

    c.setFillColor(INK_SOFT)
    c.setFont("Helvetica", 8.5)
    lines = wrap_text(desc, "Helvetica", 8.5, pw - 4)
    desc_y = next_y - 4
    for line in lines:
        c.drawString(px, desc_y, line)
        desc_y -= 11


def page_footer(page_num, total, note=None):
    c.setFillColor(INK_SOFT)
    c.setFont("Helvetica", 7)
    if note:
        c.drawCentredString(W/2, 28, note)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(OLIVE_DEEP)
    c.drawString(W - 60, 28, f"{page_num:02d} / {total:02d}")


# ============================================================
# DATOS DE LA CARTA
# ============================================================

bowls = [
    ("Poké Sakura",
     "Salmón fresco marinado en soja-jengibre, arroz integral templado, edamame, pepino, aguacate, cebolla crujiente y mayonesa de wasabi suave.",
     "13,50 €", "Signature", LEMON, OLIVE_DEEP),
    ("Bowl Mediterráneo",
     "Quinoa, pollo al limón con hierbas, tomate cherry, hummus de cúrcuma, pepino, olivas Kalamata, feta y aceite de orégano.",
     "11,90 €", "Signature", LEMON, OLIVE_DEEP),
    ("Bowl Garden",
     "Falafel recién horneado, quinoa, hummus, kale masajeado con limón, granada, zanahoria asada, semillas y tahini cítrico.",
     "10,90 €", "100% planta", OLIVE_SOFT, CREAM),
    ("Poké Tropical",
     "Atún rojo, arroz, mango maduro, edamame, pepino, aguacate, cebolla morada, sésamo tostado y salsa ponzu cítrica.",
     "12,90 €", "Signature", LEMON, OLIVE_DEEP),
]

wraps = [
    ("Wrap Caesar",
     "Tortilla integral, pollo asado a la sal, romana fresca, parmesano de pasto, picatostes de pan de masa madre y César cremosa de la casa.",
     "9,50 €", None, None, None),
    ("Pita Halloumi",
     "Halloumi a la plancha, hummus de cúrcuma, hojas verdes, tomate maduro, pepino y tzatziki fresco con menta dentro de pita esponjosa.",
     "10,50 €", "Vegetariano", OLIVE_SOFT, CREAM),
    ("Wrap Mediterráneo",
     "Pollo al limón con hierbas, hummus, tomate cherry, pepino, feta, olivas Kalamata, espinaca baby y aceite de orégano.",
     "9,90 €", None, None, None),
    ("Wrap Salmón",
     "Salmón ahumado, queso fresco con cebollino, aguacate machacado en el plato, rúcula con pimienta, alcaparras y eneldo fresco.",
     "11,50 €", None, None, None),
]

brunch = [
    ("Avocado Toast",
     "Pan de masa madre, aguacate machacado en el plato, huevo poché, ralladura de lima, escamas de chile suave y AOVE arbequino.",
     "8,90 €", None, None, None),
    ("Ricotta & Frutos rojos",
     "Ricotta fresca batida con un toque de miel cruda, frutos rojos de temporada, pistacho del Mediterráneo y ralladura de limón.",
     "8,50 €", "Vegetariano", OLIVE_SOFT, CREAM),
    ("Quesadilla Verde",
     "Tortilla de espinacas, pollo desmenuzado, queso curado de cabra, espinaca baby, salsa verde con cilantro fresco y lima exprimida.",
     "9,90 €", None, None, None),
    ("Smoked Salmon Toast",
     "Pan integral de centeno, salmón ahumado en finas capas, queso fresco con cebollino, aguacate, alcaparras y un toque de eneldo.",
     "11,50 €", None, None, None),
]

dulces = [
    ("Berry Bowl",
     "Yogur griego artesano, granola de la casa con miel, fresas, arándanos y plátano. Un toque de miel cruda al final.",
     "8,50 €", "De temporada", TERRA, CREAM),
    ("Açaí Classic",
     "Açaí amazónico cremoso, plátano, fresas frescas, granola, coco rallado, semillas de chía y un toque de miel cruda.",
     "9,50 €", "Antioxidante", TERRA, CREAM),
    ("Frozen Yogurt & Nutella",
     "Helado artesano de yogur griego, plátano, fresas, un drizzle de Nutella, almendras laminadas y galletas caseras de avena.",
     "8,90 €", "Cremoso", TERRA, CREAM),
    ("Açaí Tropical",
     "Açaí, mango maduro, kiwi, piña, granola de coco, mantequilla de cacahuete artesana y mix de semillas de la casa.",
     "9,90 €", "Tropical", TERRA, CREAM),
]


# ============================================================
# PÁGINA 2 — POKÉS & BOWLS + BUILDER
# ============================================================

page_header(OLIVE_DEEP, "Pokés & Bowls", text_on_band=CREAM)
section_title(H - 130, "Pokés & Bowls", "carta", OLIVE_DEEP, accent_text=CREAM)

# Intro
intro = "Cuatro recetas firma con su carácter, y la libertad de crear el tuyo a medida. Todos sobre arroz integral o quinoa, con aceite de oliva como base."
c.setFillColor(INK_SOFT)
c.setFont("Helvetica-Oblique", 10)
intro_lines = wrap_text(intro, "Helvetica-Oblique", 10, W - 100)
iy = H - 165
for line in intro_lines:
    c.drawString(50, iy, line)
    iy -= 13

c.setStrokeColor(LEMON)
c.setLineWidth(2)
c.line(50, iy - 5, 90, iy - 5)

# Grid 2x2 firmas (más compacto para dejar sitio al builder)
grid_top = iy - 28
card_w = (W - 100 - 20) / 2
card_h = 110
gap_y = 14

for i, (name, desc, price, tag, tag_bg, tag_fg) in enumerate(bowls):
    col = i % 2
    row = i // 2
    x = 50 + col * (card_w + 20)
    y = grid_top - card_h - row * (card_h + gap_y)
    draw_dish_card(x, y, card_w, card_h, name, desc, price, OLIVE_DEEP,
                   tag=tag, tag_bg=tag_bg, tag_fg=tag_fg)

# ---- BUILDER ----
builder_y_top = grid_top - 2 * card_h - gap_y - 18
builder_x = 50
builder_w = W - 100
builder_h = 195
builder_y_pos = builder_y_top - builder_h

c.setFillColor(OLIVE_DEEP)
c.roundRect(builder_x, builder_y_pos, builder_w, builder_h, 14, fill=1, stroke=0)

# Cabecera builder
c.setFillColor(CREAM)
c.setFont("Times-Roman", 18)
c.drawString(builder_x + 20, builder_y_pos + builder_h - 28, "Build Your Own Bowl")

c.setFillColor(LEMON_SOFT)
c.setFont("Times-Italic", 11)
c.drawString(builder_x + 20, builder_y_pos + builder_h - 45,
             "Cuatro pasos. Tu combinación favorita.")

# Pill precio
c.setFillColor(LEMON)
c.roundRect(builder_x + builder_w - 100, builder_y_pos + builder_h - 35, 80, 22, 11,
            fill=1, stroke=0)
c.setFillColor(OLIVE_DEEP)
c.setFont("Helvetica-Bold", 11)
c.drawCentredString(builder_x + builder_w - 60, builder_y_pos + builder_h - 27, "11,90 €")

# Línea separadora
c.setStrokeColor(Color(0.95, 0.91, 0.78, alpha=0.3))
c.setLineWidth(0.5)
c.line(builder_x + 20, builder_y_pos + builder_h - 60,
       builder_x + builder_w - 20, builder_y_pos + builder_h - 60)

# 4 columnas
col_w = (builder_w - 40 - 30) / 4
col_gap = 10
col_y_top = builder_y_pos + builder_h - 75

steps = [
    ("01 · Base", ["Arroz integral", "Quinoa", "Mix verde"]),
    ("02 · Proteína", ["Salmón marinado", "Atún rojo", "Pollo al limón", "Falafel · veggie", "Tofu · veggie"]),
    ("03 · 3 toppings", ["Aguacate · edamame", "Mango · granada", "Hummus · feta", "Tomate · pepino", "Olivas · cebolla"]),
    ("04 · Salsa", ["Ponzu cítrico", "Tahini de limón", "Wasabi suave", "Aceite orégano", "Soja-jengibre"]),
]

for i, (title, options) in enumerate(steps):
    col_x = builder_x + 20 + i * (col_w + col_gap)

    c.setFillColor(LEMON)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(col_x, col_y_top, title.upper())

    c.setFillColor(CREAM)
    c.setFont("Helvetica", 7.5)
    opt_y = col_y_top - 14
    for opt in options:
        c.drawString(col_x, opt_y, "— " + opt)
        opt_y -= 10

page_footer(2, 6, "I V A   I N C L U I D O   ·   P R O D U C T O   D E   T E M P O R A D A")
c.showPage()


# ============================================================
# PÁGINA 3 — WRAPS & PITAS
# ============================================================

def render_simple_category(category_name, intro, dishes, color, page_num, total,
                           text_on_band=CREAM, accent_text=CREAM):
    page_header(color, category_name, text_on_band=text_on_band)
    section_title(H - 130, category_name, "carta", color, accent_text=accent_text)

    c.setFillColor(INK_SOFT)
    c.setFont("Helvetica-Oblique", 10)
    intro_lines = wrap_text(intro, "Helvetica-Oblique", 10, W - 100)
    iy = H - 165
    for line in intro_lines:
        c.drawString(50, iy, line)
        iy -= 13

    c.setStrokeColor(LEMON)
    c.setLineWidth(2)
    c.line(50, iy - 5, 90, iy - 5)

    grid_top = iy - 30
    card_w = (W - 100 - 20) / 2
    card_h = 130

    for i, (name, desc, price, tag, tag_bg, tag_fg) in enumerate(dishes):
        col = i % 2
        row = i // 2
        x = 50 + col * (card_w + 20)
        y = grid_top - card_h - row * (card_h + 20)
        draw_dish_card(x, y, card_w, card_h, name, desc, price, color,
                       tag=tag, tag_bg=tag_bg, tag_fg=tag_fg)

    page_footer(page_num, total, "I V A   I N C L U I D O   ·   P R O D U C T O   D E   T E M P O R A D A")


render_simple_category(
    "Wraps & Pitas",
    "El mismo cuidado en formato de mano. Pan integral, masa madre, pita esponjosa — relleno generoso de proteína, vegetales y salsa hecha en casa.",
    wraps, TERRA, 3, 6
)
c.showPage()


# ============================================================
# PÁGINA 4 — BRUNCH (banda amarilla, texto oscuro)
# ============================================================

render_simple_category(
    "Brunch & Tostadas",
    "Pan de masa madre tostado al punto, ricotta batida del día, huevos camperos y aguacates en su mejor punto. Desayuno o merienda — la hora la pones tú.",
    brunch, LEMON, 4, 6,
    text_on_band=OLIVE_DEEP, accent_text=OLIVE_DEEP
)
c.showPage()


# ============================================================
# PÁGINA 5 — YOGUR & AÇAÍ
# ============================================================

render_simple_category(
    "Yogur & Açaí",
    "Yogures griegos artesanos, açaí cremoso, granola tostada en el horno cada mañana y la mejor fruta de temporada. Dulce honesto, sin azúcares añadidos.",
    dulces, OLIVE_SOFT, 5, 6
)
c.showPage()


# ============================================================
# PÁGINA 6 — CIERRE
# ============================================================

fill_bg(CREAM)

c.setFillColor(LEMON_SOFT)
c.circle(50, H - 80, 110, fill=1, stroke=0)
c.setFillColor(OLIVE_SOFT)
c.circle(W - 30, 80, 130, fill=1, stroke=0)

draw_logo(W/2, H - 200, size=2)

c.setFillColor(INK)
c.setFont("Times-Italic", 32)
c.drawCentredString(W/2, H - 340, "Real food.")
c.setFillColor(TERRA)
c.drawCentredString(W/2, H - 380, "Mediterranean")
c.setFillColor(OLIVE_DEEP)
c.drawCentredString(W/2, H - 420, "soul.")

c.setStrokeColor(LEMON)
c.setLineWidth(3)
c.setLineCap(1)
c.line(W/2 - 35, H - 450, W/2 + 35, H - 450)

c.setFillColor(INK_SOFT)
c.setFont("Helvetica-Bold", 9)
c.drawCentredString(W/2, H - 490, "VISÍTANOS")

c.setFillColor(INK)
c.setFont("Times-Roman", 12)
c.drawCentredString(W/2, H - 515, "Lun — Vie  ·  09:00 — 22:00")
c.drawCentredString(W/2, H - 532, "Sáb — Dom  ·  10:00 — 23:00")

c.setFillColor(INK_SOFT)
c.setFont("Helvetica", 9)
c.drawCentredString(W/2, H - 565, "+34 000 000 000   ·   hola@serenabites.com")

# Pills servicios
y_pills = 200
servicios = [
    ("EN MESA", OLIVE_DEEP, CREAM),
    ("EN BARRA", TERRA, CREAM),
    ("DELIVERY", LEMON, OLIVE_DEEP),
    ("VEGGIE & GLUTEN-FREE", OLIVE_SOFT, CREAM),
]

c.setFont("Helvetica-Bold", 8)
total_w = 0
pw_list = []
for txt, _, _ in servicios:
    pw = c.stringWidth(txt, "Helvetica-Bold", 8) + 22
    pw_list.append(pw)
    total_w += pw
total_w += 8 * (len(servicios) - 1)

x_cursor = (W - total_w) / 2
for (txt, bg, fg), pw in zip(servicios, pw_list):
    c.setFillColor(bg)
    c.roundRect(x_cursor, y_pills, pw, 18, 9, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x_cursor + 11, y_pills + 5, txt)
    x_cursor += pw + 8

c.setFillColor(INK_SOFT)
c.setFont("Helvetica", 7)
c.drawCentredString(W/2, 90, "© 2026  ·  S E R E N A   B I T E S  ·  C O C I N A   M E D I T E R R Á N E A")
c.setFillColor(LEMON_DEEP)
c.setFont("Helvetica-Bold", 12)
c.drawCentredString(W/2, 65, "✦ ✦ ✦")

c.save()
print(f"PDF creado: {PDF_PATH}")
