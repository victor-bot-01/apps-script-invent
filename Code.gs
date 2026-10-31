/**************************************************************************
 * Inventário de Produtos — Tela de Contagem (Google Apps Script)
 *
 * Planilha: "Inventário de Produtos"
 *   https://docs.google.com/spreadsheets/d/1u1K-acxIOnNP4G1s8sfAop1ERoRkpKR1LIdMSQE5mdE
 *
 * Uma tela por produto (pensada para celular):
 *   Título + menu ☰ (Pesquisa / Filtro) · Foto · − Quantidade + · Validade ·
 *   ⇦ ⇨ (ordem da planilha, dá a volta) · Sem Etiqueta − n +
 *
 * Cada toque grava direto na planilha (aba "Produtos").
 * A quantidade contada SUBSTITUI o valor da coluna "Estoque".
 *
 * Instalação: veja o README.md.
 **************************************************************************/

/************** CONFIG **************/
const CONFIG = {
  // ID da planilha. Se o script estiver vinculado à planilha (Extensões →
  // Apps Script), a planilha ativa é usada e este valor serve de reserva.
  SPREADSHEET_ID: "1u1K-acxIOnNP4G1s8sfAop1ERoRkpKR1LIdMSQE5mdE",

  SHEET_PRODUTOS: "Produtos",

  // ID da pasta do Google Drive com as fotos (o trecho depois de /folders/ na URL).
  // Nomeie cada imagem com o SKU do produto: PRD-001.jpg, PRD-002.png …
  // Deixe vazio ("") enquanto não tiver a pasta.
  PASTA_FOTOS_ID: "",

  // Por quanto tempo (segundos) guardar a lista de fotos da pasta em cache
  CACHE_FOTOS_SEG: 600,
};

const COLUNAS = [
  "SKU",
  "Produto",
  "Estoque",
  "Sem Etiqueta",
  "Validade",
  "Foto",
  "Atualizado em",
  "Atualizado por",
];

// Campos que a tela pode alterar → nome da coluna na planilha
const CAMPOS_EDITAVEIS = {
  estoque: "Estoque",
  semEtiqueta: "Sem Etiqueta",
  validade: "Validade",
};

/************** MENU / WEB APP **************/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📦 Inventário")
    .addItem("Abrir tela de contagem", "abrirContagem")
    .addSeparator()
    .addItem("Instalar / reparar estrutura", "instalarPlanilha")
    .addItem("Inserir dados de exemplo", "inserirDadosExemplo")
    .addItem("Recarregar lista de fotos", "limparCacheFotos")
    .addToUi();
}

/** Web App: Implantar → Nova implantação → App da Web */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("Dashboard")
    .setTitle("Contagem de Inventário")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Abre a tela de contagem numa janela dentro da própria planilha. */
function abrirContagem() {
  const html = HtmlService.createHtmlOutputFromFile("Dashboard").setWidth(460).setHeight(860);
  SpreadsheetApp.getUi().showModelessDialog(html, "Contagem de Inventário");
}

/************** INSTALAÇÃO **************/
/**
 * Cria (ou repara) a aba "Produtos" com cabeçalhos, formatos e validações.
 * Pode ser executada várias vezes: não apaga dados, só acrescenta colunas que faltarem.
 */
function instalarPlanilha() {
  const ss = getSpreadsheet_();
  let aba = ss.getSheetByName(CONFIG.SHEET_PRODUTOS);
  if (!aba) aba = ss.insertSheet(CONFIG.SHEET_PRODUTOS, 0);

  const atuais = aba.getLastColumn() > 0
    ? aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map((c) => String(c).trim())
    : [];
  if (atuais.filter(String).length === 0) {
    aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
  } else {
    const faltando = COLUNAS.filter((c) => atuais.indexOf(c) === -1);
    if (faltando.length) aba.getRange(1, atuais.length + 1, 1, faltando.length).setValues([faltando]);
  }

  const idx = indice_(aba);
  const n = aba.getMaxRows() - 1;
  aba.getRange(2, idx["SKU"] + 1, n).setNumberFormat("@");
  aba.getRange(2, idx["Estoque"] + 1, n).setNumberFormat("0");
  aba.getRange(2, idx["Sem Etiqueta"] + 1, n).setNumberFormat("0");
  aba.getRange(2, idx["Validade"] + 1, n)
    .setNumberFormat("dd/MM/yyyy")
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
  aba.getRange(2, idx["Atualizado em"] + 1, n).setNumberFormat("dd/MM/yyyy HH:mm:ss");

  const largura = aba.getLastColumn();
  aba.getRange(1, 1, 1, largura)
    .setFontWeight("bold").setBackground("#1f2937").setFontColor("#ffffff").setVerticalAlignment("middle");
  aba.setFrozenRows(1);
  aba.setRowHeight(1, 32);
  aba.autoResizeColumns(1, largura);

  // Remove a aba padrão vazia, se existir
  ["Página1", "Planilha1", "Sheet1"].forEach((nome) => {
    const a = ss.getSheetByName(nome);
    if (a && a.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(a);
  });

  ss.setActiveSheet(aba);
  avisar_("Estrutura pronta ✅");
}

/** Preenche alguns produtos de teste (só se a aba estiver vazia). */
function inserirDadosExemplo() {
  instalarPlanilha();
  const aba = getSpreadsheet_().getSheetByName(CONFIG.SHEET_PRODUTOS);
  if (aba.getLastRow() > 1) {
    avisar_("A aba Produtos já tem dados — exemplos não inseridos.");
    return;
  }
  const idx = indice_(aba);
  const exemplos = [
    ["PRD-001", "Caneta esferográfica azul", 320, 0, ""],
    ["PRD-002", "Caderno universitário", 45, 2, ""],
    ["PRD-003", "Café torrado 500g", 35, 1, new Date(2027, 2, 15)],
    ["PRD-004", "Detergente 500ml", 140, 0, new Date(2026, 9, 20)],
    ["PRD-005", "Mouse sem fio", 18, 3, ""],
    ["PRD-006", "Álcool 70% 1L", 22, 0, new Date(2027, 7, 1)],
  ];
  const linhas = exemplos.map((e) => {
    const l = new Array(aba.getLastColumn()).fill("");
    l[idx["SKU"]] = e[0];
    l[idx["Produto"]] = e[1];
    l[idx["Estoque"]] = e[2];
    l[idx["Sem Etiqueta"]] = e[3];
    l[idx["Validade"]] = e[4];
    return l;
  });
  aba.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
  avisar_("Dados de exemplo inseridos ✅");
}

/************** API DA TELA (google.script.run) **************/
/** Lista todos os produtos, na ordem da planilha. */
function listarProdutos() {
  const ss = getSpreadsheet_();
  const aba = ss.getSheetByName(CONFIG.SHEET_PRODUTOS);
  if (!aba) return { instalado: false, produtos: [] };

  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return { instalado: true, produtos: [] };

  const idx = indice_(aba);
  const valores = aba.getRange(2, 1, ultimaLinha - 1, aba.getLastColumn()).getValues();
  const fotosPasta = mapaFotosPasta_();
  const tz = ss.getSpreadsheetTimeZone();

  const produtos = [];
  valores.forEach((l, k) => {
    const sku = String(l[idx["SKU"]] || "").trim();
    const nome = String(l[idx["Produto"]] || "").trim();
    if (!sku && !nome) return; // linha vazia
    const fotoCol = idx["Foto"] !== undefined ? String(l[idx["Foto"]] || "").trim() : "";
    produtos.push({
      linha: k + 2,
      sku,
      nome: nome || sku,
      estoque: inteiro_(l[idx["Estoque"]]),
      semEtiqueta: inteiro_(l[idx["Sem Etiqueta"]]),
      validade: dataParaIso_(l[idx["Validade"]], tz),
      foto: urlFoto_(fotoCol, fotosPasta[sku.toUpperCase()]),
    });
  });
  return { instalado: true, produtos };
}

/**
 * Grava um campo de um produto. Chamado a cada toque na tela.
 * O valor enviado é o valor FINAL (não um incremento), então repetir a
 * chamada não causa contagem duplicada.
 *
 * @param {string} sku    SKU do produto
 * @param {number} linha  linha onde o produto estava quando a tela carregou
 * @param {string} campo  "estoque" | "semEtiqueta" | "validade"
 * @param {*}      valor  número inteiro ≥ 0, ou data "aaaa-mm-dd" ("" limpa a validade)
 */
function salvarCampo(sku, linha, campo, valor) {
  const coluna = CAMPOS_EDITAVEIS[campo];
  if (!coluna) throw new Error("Campo inválido: " + campo);
  sku = String(sku || "").trim();
  if (!sku) throw new Error("Produto sem SKU.");

  let gravar;
  if (campo === "validade") {
    gravar = isoParaData_(valor);
  } else {
    gravar = Number(valor);
    if (!isFinite(gravar) || gravar < 0 || Math.floor(gravar) !== gravar) {
      throw new Error("Quantidade inválida.");
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = getSpreadsheet_().getSheetByName(CONFIG.SHEET_PRODUTOS);
    const idx = indice_(aba);
    const l = localizarLinha_(aba, idx, sku, Number(linha));
    if (!l) throw new Error(`Produto ${sku} não encontrado na planilha.`);

    aba.getRange(l, idx[coluna] + 1).setValue(gravar);
    if (idx["Atualizado em"] !== undefined) aba.getRange(l, idx["Atualizado em"] + 1).setValue(new Date());
    if (idx["Atualizado por"] !== undefined) aba.getRange(l, idx["Atualizado por"] + 1).setValue(usuario_());
    SpreadsheetApp.flush();
    return { ok: true, linha: l };
  } finally {
    lock.releaseLock();
  }
}

/** Esquece a lista de fotos guardada, para enxergar imagens novas na pasta. */
function limparCacheFotos() {
  CacheService.getScriptCache().remove("mapaFotos");
  avisar_("Lista de fotos recarregada ✅");
}

/************** HELPERS **************/
function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** Mapa { "Nome da coluna": índice (0-based) } a partir do cabeçalho. */
function indice_(aba) {
  const cab = aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0];
  const idx = {};
  cab.forEach((c, i) => {
    const nome = String(c).trim();
    if (nome && idx[nome] === undefined) idx[nome] = i;
  });
  ["SKU", "Produto", "Estoque", "Sem Etiqueta", "Validade"].forEach((c) => {
    if (idx[c] === undefined) {
      throw new Error(`Coluna "${c}" não encontrada na aba ${aba.getName()}. Use o menu 📦 Inventário → Instalar / reparar estrutura.`);
    }
  });
  return idx;
}

/** Confere se o produto ainda está na linha esperada; se não, procura pelo SKU. */
function localizarLinha_(aba, idx, sku, linhaEsperada) {
  const alvo = sku.toUpperCase();
  const ultima = aba.getLastRow();
  if (linhaEsperada >= 2 && linhaEsperada <= ultima) {
    const v = String(aba.getRange(linhaEsperada, idx["SKU"] + 1).getValue()).trim().toUpperCase();
    if (v === alvo) return linhaEsperada;
  }
  if (ultima < 2) return null;
  const skus = aba.getRange(2, idx["SKU"] + 1, ultima - 1).getValues();
  for (let i = 0; i < skus.length; i++) {
    if (String(skus[i][0]).trim().toUpperCase() === alvo) return i + 2;
  }
  return null;
}

/**
 * Lê a pasta de fotos e devolve { SKU: idDoArquivo }.
 * O nome do arquivo sem extensão é o SKU (PRD-001.jpg → PRD-001).
 */
function mapaFotosPasta_() {
  if (!CONFIG.PASTA_FOTOS_ID) return {};
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("mapaFotos");
  if (guardado) return JSON.parse(guardado);

  const mapa = {};
  try {
    const arquivos = DriveApp.getFolderById(CONFIG.PASTA_FOTOS_ID).getFiles();
    while (arquivos.hasNext()) {
      const f = arquivos.next();
      if (!/^image\//.test(f.getMimeType())) continue;
      const sku = f.getName().replace(/\.[^.]+$/, "").trim().toUpperCase();
      if (sku && !mapa[sku]) mapa[sku] = f.getId();
    }
  } catch (e) {
    console.warn("Não foi possível ler a pasta de fotos: " + e.message);
    return {};
  }
  try {
    cache.put("mapaFotos", JSON.stringify(mapa), CONFIG.CACHE_FOTOS_SEG);
  } catch (e) {
    // lista grande demais para o cache — segue sem cache
  }
  return mapa;
}

/**
 * Monta a URL da foto. Prioridade:
 *   1. coluna "Foto" da planilha (link do Drive ou URL de imagem)
 *   2. arquivo com o nome do SKU na pasta de fotos
 */
function urlFoto_(valorColuna, idPasta) {
  if (valorColuna) {
    const m = valorColuna.match(/(?:\/d\/|[?&]id=)([\w-]{20,})/);
    if (m) return miniatura_(m[1]);
    if (/^https?:\/\//i.test(valorColuna)) return valorColuna;
    if (/^[\w-]{20,}$/.test(valorColuna)) return miniatura_(valorColuna);
  }
  return idPasta ? miniatura_(idPasta) : "";
}

function miniatura_(id) {
  return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w1000";
}

function inteiro_(v) {
  if (typeof v === "number") return isFinite(v) ? Math.max(0, Math.round(v)) : 0;
  const n = parseInt(String(v || "").replace(/\D/g, ""), 10);
  return isFinite(n) ? n : 0;
}

function dataParaIso_(v, tz) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  const m = String(v || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // texto "dd/mm/aaaa"
  if (m) return `${m[3]}-${("0" + m[2]).slice(-2)}-${("0" + m[1]).slice(-2)}`;
  return "";
}

function isoParaData_(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("Data de validade inválida.");
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function usuario_() {
  try {
    return Session.getActiveUser().getEmail() || "Tela de contagem";
  } catch (e) {
    return "Tela de contagem";
  }
}

function avisar_(msg) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Inventário", 5);
  } catch (e) {
    console.log(msg);
  }
}
