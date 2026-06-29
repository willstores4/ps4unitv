#!/usr/bin/env python3
"""
make_pkg_assets.py — Gera param.sfo e ícones para o pkg PS4
Executado pelo GitHub Actions antes do build.
"""

import sys
import os
import struct

VERSION = sys.argv[1] if len(sys.argv) > 1 else "01.00"

# ── Criar diretórios ─────────────────────────────────────
os.makedirs("pkg/sce_sys", exist_ok=True)
os.makedirs("pkg/USRDIR/web", exist_ok=True)

# ── Copiar arquivos da web app ────────────────────────────
import shutil

web_files = [
    "index.html",
    "css",
    "js",
    "lib",
    "assets",
]

for f in web_files:
    src = f
    dst = os.path.join("pkg/USRDIR/web", f)
    if os.path.isdir(src):
        if os.path.exists(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print(f"[OK] Copiado diretório: {f}")
    elif os.path.isfile(src):
        shutil.copy2(src, dst)
        print(f"[OK] Copiado arquivo: {f}")
    else:
        print(f"[SKIP] Não encontrado: {f}")

# ── Gerar param.sfo ──────────────────────────────────────
# Formato SFO (System File Object) do PS4
# Referência: https://www.psdevwiki.com/ps4/System_File_Object_(SFO)

TITLE_ID  = "UNITV0001"
TITLE     = "UnitV Pro"
APP_VER   = VERSION.replace(".", "")[:4].zfill(4)  # ex: "0100"
APP_VER_S = VERSION  # ex: "01.00"
CATEGORY  = "gd"
SYSTEM_VER= 0x05050000  # Firmware mínimo 5.05

def make_sfo(entries):
    """Cria um arquivo param.sfo binário."""
    MAGIC    = b'\x00PSF'
    VERSION_ = struct.pack('<I', 0x00000101)
    
    # Ordenar por key name (obrigatório no SFO)
    entries = sorted(entries, key=lambda e: e[0])
    
    num_entries = len(entries)
    key_table_start = 0x14 + num_entries * 0x10
    
    # Calcular offsets das keys
    key_offsets = []
    key_table = b''
    for key, fmt, val in entries:
        key_offsets.append(len(key_table))
        key_table += key.encode('utf-8') + b'\x00'
    
    # Padding da key table para 4 bytes
    while len(key_table) % 4:
        key_table += b'\x00'
    
    data_table_start = key_table_start + len(key_table)
    
    # Calcular offsets dos dados
    data_offsets = []
    data_table = b''
    for i, (key, fmt, val) in enumerate(entries):
        data_offsets.append(len(data_table))
        if fmt == 'utf8s':
            encoded = val.encode('utf-8') + b'\x00'
            max_len = max(len(encoded), 64)
            encoded = encoded.ljust(max_len, b'\x00')
            data_table += encoded
        elif fmt == 'int32':
            data_table += struct.pack('<I', val)
    
    # Montar header
    header = MAGIC + VERSION_
    header += struct.pack('<I', key_table_start)
    header += struct.pack('<I', data_table_start)
    header += struct.pack('<I', num_entries)
    
    # Montar index table
    index = b''
    for i, (key, fmt, val) in enumerate(entries):
        key_off  = key_offsets[i]
        data_off = data_offsets[i]
        if fmt == 'utf8s':
            encoded = val.encode('utf-8') + b'\x00'
            data_len = len(encoded)
            max_len  = max(data_len, 64)
            param_fmt= 0x0204  # UTF-8 special
        else:
            data_len = 4
            max_len  = 4
            param_fmt= 0x0404  # Integer
        
        index += struct.pack('<H', key_off)
        index += struct.pack('<H', param_fmt)
        index += struct.pack('<I', data_len)
        index += struct.pack('<I', max_len)
        index += struct.pack('<I', data_off)
    
    return header + index + key_table + data_table

sfo_entries = [
    ("APP_VER",         'utf8s', APP_VER_S),
    ("ATTRIBUTE",       'int32', 0),
    ("CATEGORY",        'utf8s', CATEGORY),
    ("CONTENT_ID",      'utf8s', f"UP0001-{TITLE_ID}_00-UNITVPRO0000001"),
    ("DOWNLOAD_DATA_SIZE",'int32', 0),
    ("FORMAT",          'utf8s', "obs"),
    ("PUBTOOLINFO",     'utf8s', "create_ver=0350090"),
    ("SYSTEM_VER",      'int32', SYSTEM_VER),
    ("TITLE",           'utf8s', TITLE),
    ("TITLE_ID",        'utf8s', TITLE_ID),
    ("VERSION",         'utf8s', APP_VER_S),
]

sfo_data = make_sfo(sfo_entries)
with open("pkg/sce_sys/param.sfo", 'wb') as f:
    f.write(sfo_data)
print(f"[OK] param.sfo gerado ({len(sfo_data)} bytes)")

# ── Gerar ícones ──────────────────────────────────────────
try:
    from PIL import Image, ImageDraw, ImageFont
    
    def make_icon(width, height, filename, label="UnitV Pro"):
        img = Image.new('RGB', (width, height), color=(10, 10, 20))
        draw = ImageDraw.Draw(img)
        
        # Gradient background
        for y in range(height):
            ratio = y / height
            r = int(10  + ratio * 20)
            g = int(10  + ratio * 10)
            b = int(20  + ratio * 40)
            draw.line([(0, y), (width, y)], fill=(r, g, b))
        
        # Accent glow
        for i in range(30):
            alpha = int(60 - i * 2)
            if alpha < 0: alpha = 0
            draw.ellipse(
                [width//2 - 60 + i, height//2 - 60 + i,
                 width//2 + 60 - i, height//2 + 60 - i],
                outline=(124, 77, 255, alpha)
            )
        
        # Play triangle
        cx, cy = width // 2, height // 2
        size = min(width, height) // 5
        pts = [
            (cx - size//2, cy - size),
            (cx - size//2, cy + size),
            (cx + size, cy),
        ]
        draw.polygon(pts, fill=(124, 77, 255))
        
        # Text
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(14, height//8))
        except:
            font = ImageFont.load_default()
        
        bbox = draw.textbbox((0,0), label, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text(((width - tw)//2, cy + size + 10), label, fill=(240, 240, 255), font=font)
        
        img.save(filename, 'PNG')
        print(f"[OK] Ícone gerado: {filename} ({width}x{height})")
    
    # icon0.png: 320x176 (ícone no menu do PS4)
    make_icon(320, 176, "pkg/sce_sys/icon0.png", "UnitV Pro")
    
    # pic1.png: 1920x1080 (background ao selecionar)
    make_icon(1920, 1080, "pkg/sce_sys/pic1.png", "UnitV Pro")
    
    # icon0.png na raiz também (alguns builders precisam)
    make_icon(320, 176, "pkg/icon0.png", "UnitV Pro")

except ImportError:
    print("[WARN] Pillow não disponível, criando ícones placeholder...")
    # Criar PNG mínimo válido (1x1 pixel roxo)
    minimal_png = (
        b'\x89PNG\r\n\x1a\n'                  # PNG signature
        b'\x00\x00\x00\rIHDR'                 # IHDR chunk
        b'\x00\x00\x00\x01'                   # width: 1
        b'\x00\x00\x00\x01'                   # height: 1
        b'\x08\x02\x00\x00\x00'              # bit depth, color type
        b'\x90wS\xde'                          # CRC
        b'\x00\x00\x00\x0cIDATx\x9cc\xf8'    # IDAT
        b'\x8f\x80\x1f\x00\x00\x00\x02\x00'
        b'\x01\xe2!\xbc3'                      # CRC
        b'\x00\x00\x00\x00IEND\xaeB`\x82'    # IEND
    )
    for fn in ["pkg/sce_sys/icon0.png", "pkg/sce_sys/pic1.png", "pkg/icon0.png"]:
        with open(fn, 'wb') as f:
            f.write(minimal_png)
    print("[OK] Ícones placeholder criados")

# ── Copiar param.sfo para sce_sys do projeto também ──────
shutil.copy2("pkg/sce_sys/param.sfo", "sce_sys/param.sfo")
print("[OK] param.sfo copiado para sce_sys/")

print("\n✅ Assets do pkg gerados com sucesso!")
print(f"   Título:   {TITLE}")
print(f"   Title ID: {TITLE_ID}")
print(f"   Versão:   {APP_VER_S}")
