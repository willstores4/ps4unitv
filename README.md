# 🎮 UnitV Pro — PS4 App

Aplicativo IPTV completo para **PS4 com GoldHEN** (jailbreak).

![Build PKG](https://github.com/SEU_USUARIO/unitvpro-ps4/actions/workflows/build-pkg.yml/badge.svg)

---

## 📦 Como instalar

### Opção 1 — Download direto (mais fácil)
1. Vá em **[Releases](../../releases/latest)**
2. Baixe o arquivo `.pkg`
3. Coloque na raiz de um USB **exFAT**
4. No PS4: `GoldHEN → Debug Settings → Package Installer`
5. Selecione e instale

### Opção 2 — Build automático via GitHub Actions
1. Faça um fork deste repositório
2. Vá em **Actions → Build PS4 PKG → Run workflow**
3. Baixe o artefato gerado

### Opção 3 — Criar tag para gerar Release automático
```bash
git tag v1.0.0
git push origin v1.0.0
```
O GitHub Actions cria automaticamente um Release com o `.pkg`.

---

## 🕹️ Controles

| Botão | Ação |
|-------|------|
| **D-Pad** | Navegar |
| **X (Cruz)** | Confirmar / Selecionar |
| **O (Bola)** | Voltar |
| **□ (Quadrado)** | Favoritar |
| **△ (Triângulo)** | Buscar |
| **L1 / R1** | Trocar aba |
| **Start** | Controles do player |

---

## ✅ Funcionalidades

- 📺 **Ao Vivo** — canais com mini player e lista de categorias
- 🎬 **Filmes** — catálogo completo com detalhes e reprodução
- 📽️ **Séries** — temporadas e episódios
- ⚽ **Esportes** — canais esportivos em destaque
- 🧸 **Infantil** — conteúdo kids separado
- 🔍 **Busca** — busca unificada em todo o catálogo
- ⭐ **Favoritos** — salva canais e conteúdo favoritos
- 🕐 **Histórico** — histórico de reprodução
- 🔐 **Login** — suporte a usuário/senha e MAC address
- 💾 **Cache local** — carregamento rápido após o primeiro acesso

---

## ⚙️ Requisitos

- PS4 com **GoldHEN** instalado
- Firmware compatível (até 11.00 dependendo do exploit)
- Conexão com **internet**

---

## 🛠️ Desenvolvimento local

Para testar o app antes de criar o pkg:

1. Abra `index.html` em um navegador moderno
2. Ou use Live Server: `npx live-server --port=8080`

Para gerar o `.pkg` localmente:
1. Baixe [fPKG Maker GUI](https://github.com/PKGPS4/fPKGMaker)
2. Aponte para a pasta raiz do projeto
3. Configure: Title ID = `UNITV0001`
4. Build!

---

## 📁 Estrutura do projeto

```
├── index.html              # SPA principal
├── css/style.css           # Design 1920×1080 dark mode
├── js/
│   ├── app.js             # Orquestrador
│   ├── api.js             # Xtream API + TMDB
│   ├── auth.js            # Login e autenticação
│   ├── cache.js           # Cache local
│   ├── player.js          # Player HLS.js
│   ├── navigation.js      # D-Pad DualShock
│   └── ui.js              # Renderização
├── lib/hls.min.js          # HLS.js (bundled)
├── sce_sys/               # Metadados PS4
├── pkg-tools/             # Scripts de build
│   ├── make_pkg_assets.py # Gera param.sfo + ícones
│   ├── make_gp4.py        # Gera pkg.gp4
│   └── build_pkg.py       # Builder fallback Python
└── .github/workflows/
    └── build-pkg.yml      # GitHub Actions CI/CD
```

---

## ⚠️ Aviso

Este app é um **homebrew não oficial** para PS4 com jailbreak.
Funciona exclusivamente em consoles com GoldHEN instalado.
