# ============================================================
#  UnitV Pro PS4 — Makefile (OpenOrbis Toolchain v0.5.4)
#  Variável obrigatória: OO_PS4_TOOLCHAIN
#  Ex: export OO_PS4_TOOLCHAIN=/opt/openorbis
# ============================================================

TOOLCHAIN   ?= $(OO_PS4_TOOLCHAIN)
PROJNAME    := UnitVPro
SRCDIR      := src
OUTDIR      := build

# Binários do toolchain
CLANG       := $(shell find $(TOOLCHAIN)/bin -name "clang*" -executable 2>/dev/null | head -1)
ifeq ($(CLANG),)
  CLANG     := clang
endif

CREATE_EBOOT := $(shell find $(TOOLCHAIN)/bin -name "create-eboot" -executable 2>/dev/null | head -1)

# Flags de compilação (PS4: x86_64 FreeBSD ELF)
CFLAGS := \
    -cc1 \
    -triple x86_64-pc-freebsd-elf \
    -munwind-tables \
    -fuse-init-array \
    -builtin-headers-in-system-modules \
    -O2 \
    -target-feature +sse4.2 \
    -I$(TOOLCHAIN)/include \
    -I$(TOOLCHAIN)/include/c++/v1 \
    -x c

# Flags do linker
LDFLAGS := \
    -m elf_x86_64 \
    -pie \
    --eh-frame-hdr

ifneq ($(wildcard $(TOOLCHAIN)/link.x),)
  LDFLAGS += --script $(TOOLCHAIN)/link.x
endif

LDFLAGS += \
    -L$(TOOLCHAIN)/lib \
    $(TOOLCHAIN)/lib/crt1.o \
    -lSceLibcInternal \
    -lkernel \
    -lScePthread \
    -lSceSystemService \
    -lSceUserService

SRCS := $(wildcard $(SRCDIR)/*.c)
OBJS := $(patsubst $(SRCDIR)/%.c, $(OUTDIR)/%.o, $(SRCS))

# ── Targets ─────────────────────────────────────────────────

.PHONY: all eboot clean check-toolchain

all: check-toolchain eboot

check-toolchain:
	@if [ -z "$(TOOLCHAIN)" ]; then \
		echo "ERRO: OO_PS4_TOOLCHAIN não definido!"; \
		echo "  export OO_PS4_TOOLCHAIN=/caminho/para/openorbis"; \
		exit 1; \
	fi
	@echo "[OK] Toolchain: $(TOOLCHAIN)"
	@echo "[OK] Clang: $(CLANG)"

$(OUTDIR):
	mkdir -p $(OUTDIR)

# Compilar cada .c → .o
$(OUTDIR)/%.o: $(SRCDIR)/%.c | $(OUTDIR)
	$(CLANG) $(CFLAGS) $< -emit-obj -o $@
	@echo "[CC] $< → $@"

# Linkar → ELF
$(OUTDIR)/$(PROJNAME).elf: $(OBJS)
	ld.lld $(LDFLAGS) $(OBJS) -o $@
	@echo "[LD] $(PROJNAME).elf"

# ELF → eboot.bin
eboot: $(OUTDIR)/$(PROJNAME).elf
	@if [ -n "$(CREATE_EBOOT)" ]; then \
		$(CREATE_EBOOT) \
			-in="$(OUTDIR)/$(PROJNAME).elf" \
			-out="$(OUTDIR)/eboot.bin" \
			-titleid="UNITV0001" \
			-paid=0x3800000000000011; \
		echo "[OK] eboot.bin gerado com create-eboot"; \
	else \
		echo "[WARN] create-eboot não encontrado, copiando ELF..."; \
		cp $(OUTDIR)/$(PROJNAME).elf $(OUTDIR)/eboot.bin; \
	fi
	@ls -lh $(OUTDIR)/eboot.bin

clean:
	rm -rf $(OUTDIR)
	@echo "[OK] Build limpo"
