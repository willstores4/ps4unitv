#!/usr/bin/env python3
"""
make_gp4.py — Gera o arquivo pkg.gp4 (projeto do pkg PS4)
O .gp4 é o arquivo de projeto usado pelo PkgTool.Core para criar o .pkg
"""

import sys
import os
import glob

VERSION = sys.argv[1] if len(sys.argv) > 1 else "01.00"
TITLE_ID   = "UNITV0001"
CONTENT_ID = f"UP0001-{TITLE_ID}_00-UNITVPRO0000001"

# Listar todos os arquivos da web app
def list_files(base_dir, prefix=""):
    files = []
    for root, dirs, filenames in os.walk(base_dir):
        # Ignorar diretórios ocultos
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fn in filenames:
            fullpath = os.path.join(root, fn)
            relpath  = os.path.relpath(fullpath, base_dir).replace('\\', '/')
            files.append((fullpath, relpath))
    return files

web_files = list_files("pkg/USRDIR/web")
print(f"[GP4] Arquivos na web app: {len(web_files)}")

# ── Gerar XML do .gp4 ─────────────────────────────────────
gp4_xml = f'''<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<psproject fmt="gp4" version="1000">
  <volume>
    <volume_type>pkg_ps4_app</volume_type>
    <volume_ts>2026-01-01T00:00:00</volume_ts>
    <package content_id="{CONTENT_ID}"
             passcode="00000000000000000000000000000000"
             storage_type="digital50"
             app_type="full">
      <chunks>
        <chunk id="0" label="Chunk #0">
          <locus type="dir" path="pkg/USRDIR"/>
        </chunk>
      </chunks>
    </package>
  </volume>
  <files img_no="0">
    <file orig_path="pkg/sce_sys/param.sfo"  targ_path="sce_sys/param.sfo"/>
    <file orig_path="pkg/sce_sys/icon0.png"  targ_path="sce_sys/icon0.png"/>
    <file orig_path="pkg/sce_sys/pic1.png"   targ_path="sce_sys/pic1.png"/>
'''

for fullpath, relpath in web_files:
    targ = f"USRDIR/web/{relpath}"
    gp4_xml += f'    <file orig_path="{fullpath}" targ_path="{targ}"/>\n'

gp4_xml += '''  </files>
</psproject>
'''

os.makedirs("pkg", exist_ok=True)
with open("pkg/pkg.gp4", 'w', encoding='utf-8') as f:
    f.write(gp4_xml)

print(f"[OK] pkg.gp4 gerado com {len(web_files)} arquivos")
print(f"     Content ID: {CONTENT_ID}")
