# UnitV Pro PS4 — Guia de Empacotamento (.pkg)

## Pré-requisitos

1. **PS4 com GoldHEN** instalado (firmware compatível: até 11.00)
2. **PC com Windows** para gerar o pkg
3. **fPKG Maker GUI** (baixar em: https://github.com/PKGPS4/fPKGMaker)
4. **USB** formatado em **exFAT** para instalar no PS4

---

## Estrutura do pkg gerada automaticamente

O app está em: `ps4-app/`

```
ps4-app/
├── index.html          ← Tela principal
├── css/style.css       ← Visual
├── js/
│   ├── app.js          ← Orquestrador
│   ├── api.js          ← APIs Xtream + TMDB
│   ├── auth.js         ← Login e sessão
│   ├── cache.js        ← Armazenamento local
│   ├── player.js       ← Player HLS
│   ├── navigation.js   ← DualShock D-Pad
│   └── ui.js           ← Interface visual
├── lib/hls.min.js      ← Player HLS.js (offline)
└── assets/logo.png     ← Logo do app (opcional)
```

---

## Passo 1 — Adicionar logo (opcional)

Coloque um arquivo chamado `logo.png` na pasta `ps4-app/assets/`.
Tamanho recomendado: **320×160 px** com fundo transparente.

---

## Passo 2 — Baixar fPKG Maker GUI

1. Acesse: https://github.com/PKGPS4/fPKGMaker/releases
2. Baixe a versão mais recente
3. Extraia em qualquer pasta do PC

---

## Passo 3 — Criar o .pkg com fPKG Maker GUI

Abra o **fPKG Maker GUI** e configure:

| Campo          | Valor                        |
|----------------|------------------------------|
| **Title ID**   | `UNITV0001`                  |
| **Content ID** | `UP0001-UNITV0001_00-UNITVPRO0000001` |
| **Title**      | `UnitV Pro`                  |
| **Version**    | `01.00`                      |
| **Category**   | `gd` (Application)           |
| **Firmware**   | `05.05` (mínimo)             |

**Content folder:** Selecionar a pasta `ps4-app/` completa

Clique em **Build fPKG** → será gerado `UnitV_Pro.pkg`

---

## Passo 4 — Instalar no PS4

### Via USB:
1. Copie `UnitV_Pro.pkg` para a **raiz** do USB (exFAT)
2. No PS4: `Configurações → GoldHEN → Debug Settings → Package Installer`
3. Selecione o pkg e instale

### Via Remote PKG Installer (pela rede):
1. No PS4 com GoldHEN ativo, vá em `GoldHEN → Remote PKG Installer`
2. No PC: abra um browser e acesse o IP do PS4 mostrado na tela
3. Faça upload do arquivo `.pkg`

---

## Passo 5 — Controles no PS4

| Botão       | Função                      |
|-------------|------------------------------|
| **D-Pad**   | Navegar pelos itens          |
| **X (Cruz)**| Confirmar / Selecionar       |
| **O (Bola)**| Voltar / Fechar              |
| **□ (Quadrado)** | Favoritar               |
| **△ (Triângulo)** | Abrir busca            |
| **L1 / R1** | Trocar aba (AO VIVO/FILMES/etc) |
| **Start**   | Mostrar/ocultar controles do player |

---

## Observações importantes

- O app requer **conexão com internet** para autenticar e carregar conteúdo
- O cache local salva os dados após o primeiro login (próximos acessos são mais rápidos)
- **DRM (Widevine)** não é suportado pelo WebKit do PS4 — funciona apenas com streams HLS sem DRM
- Streams IPTV padrão (m3u8) funcionam normalmente
