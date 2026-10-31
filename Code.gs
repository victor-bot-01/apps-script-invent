/**************************************************************************
 * Essência do Brasil — Contagem de Inventário (Google Apps Script)
 *
 * Planilha: "Inventário de Produtos"
 *   https://docs.google.com/spreadsheets/d/1u1K-acxIOnNP4G1s8sfAop1ERoRkpKR1LIdMSQE5mdE
 *
 * Cada ABA da planilha é uma CATEGORIA (ex.: "P/ Pele 30ml", "P/ Pele 100ml").
 * Toda aba com as colunas SKU, Produto e Estoque entra na tela automaticamente.
 *
 * Tela (uma por produto, pensada para celular):
 *   Título + ☰ (Filtro por categoria · Relatório · Pesquisa) · Foto ·
 *   − Quantidade + · Validade · ⇦ ⇨ · Sem Etiqueta − n +
 *
 * Cada toque grava direto na aba do produto. A quantidade contada SUBSTITUI
 * o valor da coluna "Estoque".
 *
 * Relatórios (menu ☰ → Relatório), sempre da categoria do filtro:
 *   - Produtos: quantidades e validades
 *   - Sem etiqueta
 * O PDF é salvo numa pasta do Drive e o e-mail traz um botão que abre o PDF.
 *
 * Instalação: veja o README.md.
 **************************************************************************/

/************** CONFIG **************/
const CONFIG = {
  // ID da planilha. Se o script estiver vinculado à planilha (Extensões →
  // Apps Script), a planilha ativa é usada e este valor serve de reserva.
  SPREADSHEET_ID: "1u1K-acxIOnNP4G1s8sfAop1ERoRkpKR1LIdMSQE5mdE",

  // Abas que NUNCA são tratadas como categoria
  ABAS_IGNORADAS: ["Produtos"],

  // ID da pasta do Google Drive com as fotos (o trecho depois de /folders/ na URL).
  // Nomeie cada imagem com o SKU do produto: 2511202501.jpg, 2711202501.png …
  // Deixe vazio ("") enquanto não tiver a pasta.
  PASTA_FOTOS_ID: "",
  CACHE_FOTOS_SEG: 600,

  RELATORIO: {
    EMPRESA: "Essência do Brasil",
    REMETENTE_NOME: "Essência do Brasil",
    DESTINATARIOS: ["victor@gigaimports.com"],
    // Pasta do Drive onde os PDFs são guardados. Se PASTA_ID ficar vazio, o
    // script cria (uma única vez) uma pasta com o nome abaixo no seu Drive.
    PASTA_ID: "",
    PASTA_NOME: "Relatórios de Inventário",
    // Acima deste número de produtos, o e-mail mostra só os itens que pedem
    // atenção (para o Gmail não cortar a mensagem). O PDF sempre traz tudo.
    MAX_LINHAS_EMAIL: 150,
  },
};

const COLUNAS = ["SKU", "Produto", "Estoque", "Sem Etiqueta", "Validade", "Foto", "Atualizado em", "Atualizado por"];
const COLUNAS_MINIMAS = ["SKU", "Produto", "Estoque"]; // o que faz uma aba ser categoria

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
    .addItem("Criar nova categoria (aba)", "criarCategoria")
    .addItem("Formatar / reparar abas", "repararAbas")
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

/************** CATEGORIAS (ABAS) **************/
/** Abas que são categorias, na ordem em que aparecem na planilha. */
function abasCategoria_(ss) {
  const ignoradas = CONFIG.ABAS_IGNORADAS.map((n) => n.trim().toLowerCase());
  return ss.getSheets().filter((aba) => {
    if (ignoradas.indexOf(aba.getName().trim().toLowerCase()) > -1) return false;
    if (aba.getLastColumn() < 1) return false;
    const idx = indice_(aba);
    return COLUNAS_MINIMAS.every((c) => idx[c] !== undefined);
  });
}

/** Menu: cria uma aba nova já com o cabeçalho padrão. */
function criarCategoria() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("Nova categoria", "Nome da nova aba (ex.: P/ Pele 10ml):", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const nome = r.getResponseText().trim();
  if (!nome) return;
  const ss = getSpreadsheet_();
  if (ss.getSheetByName(nome)) {
    ui.alert(`Já existe uma aba chamada "${nome}".`);
    return;
  }
  const aba = ss.insertSheet(nome, ss.getSheets().length);
  aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
  formatarAba_(aba);
  ss.setActiveSheet(aba);
  avisar_(`Categoria "${nome}" criada. Preencha SKU e Produto.`);
}

/** Menu: acrescenta colunas que faltarem e aplica a formatação em todas as categorias. */
function repararAbas() {
  const abas = abasCategoria_(getSpreadsheet_());
  abas.forEach((aba) => {
    const atuais = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map((c) => String(c).trim());
    const faltando = COLUNAS.filter((c) => atuais.indexOf(c) === -1);
    if (faltando.length) aba.getRange(1, atuais.length + 1, 1, faltando.length).setValues([faltando]);
    formatarAba_(aba);
  });
  avisar_(abas.length ? `${abas.length} aba(s) de categoria verificadas ✅` : "Nenhuma aba de categoria encontrada.");
}

function formatarAba_(aba) {
  const idx = indice_(aba);
  const n = Math.max(1, aba.getMaxRows() - 1);
  const col = (nome) => (idx[nome] !== undefined ? aba.getRange(2, idx[nome] + 1, n) : null);
  if (col("Estoque")) col("Estoque").setNumberFormat("0");
  if (col("Sem Etiqueta")) col("Sem Etiqueta").setNumberFormat("0");
  if (col("Validade")) {
    col("Validade")
      .setNumberFormat("dd/MM/yyyy")
      .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
  }
  if (col("Atualizado em")) col("Atualizado em").setNumberFormat("dd/MM/yyyy HH:mm:ss");
  const largura = aba.getLastColumn();
  aba.getRange(1, 1, 1, largura)
    .setFontWeight("bold").setBackground("#1f2937").setFontColor("#ffffff").setVerticalAlignment("middle");
  aba.setFrozenRows(1);
  aba.setRowHeight(1, 32);
}

/************** API DA TELA (google.script.run) **************/
/** Lista as categorias e todos os produtos (ordem das abas e, dentro delas, das linhas). */
function listarProdutos() {
  const ss = getSpreadsheet_();
  const fotosPasta = mapaFotosPasta_();
  const tz = ss.getSpreadsheetTimeZone();
  const categorias = [];
  const produtos = [];

  abasCategoria_(ss).forEach((aba) => {
    const lidos = lerAba_(aba);
    if (!lidos.length) return; // aba sem produtos não aparece
    categorias.push({ nome: aba.getName(), qtd: lidos.length });
    lidos.forEach((p) => {
      produtos.push({
        aba: aba.getName(),
        linha: p.linha,
        sku: p.sku,
        nome: p.nome,
        estoque: p.estoque,
        semEtiqueta: p.semEtiqueta,
        validade: p.validade ? Utilities.formatDate(p.validade, tz, "yyyy-MM-dd") : "",
        foto: urlFoto_(p.foto, fotosPasta[p.sku.toUpperCase()]),
      });
    });
  });

  return {
    categorias,
    produtos,
    destinatarios: CONFIG.RELATORIO.DESTINATARIOS,
  };
}

/**
 * Grava um campo de um produto. Chamado a cada toque na tela.
 * O valor enviado é o valor FINAL (não um incremento): repetir a chamada
 * não causa contagem duplicada.
 *
 * @param {string} nomeAba  aba (categoria) do produto
 * @param {string} sku      SKU do produto
 * @param {number} linha    linha onde o produto estava quando a tela carregou
 * @param {string} campo    "estoque" | "semEtiqueta" | "validade"
 * @param {*}      valor    inteiro ≥ 0, ou data "aaaa-mm-dd" ("" limpa a validade)
 */
function salvarCampo(nomeAba, sku, linha, campo, valor) {
  const coluna = CAMPOS_EDITAVEIS[campo];
  if (!coluna) throw new Error("Campo inválido: " + campo);
  sku = String(sku || "").trim();
  if (!sku) throw new Error("Produto sem SKU.");

  let gravar;
  if (campo === "validade") {
    gravar = isoParaData_(valor);
  } else {
    gravar = Number(valor);
    if (!isFinite(gravar) || gravar < 0 || Math.floor(gravar) !== gravar) throw new Error("Quantidade inválida.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = getSpreadsheet_().getSheetByName(String(nomeAba || ""));
    if (!aba) throw new Error(`Aba "${nomeAba}" não encontrada na planilha.`);
    const idx = indice_(aba);
    if (idx[coluna] === undefined) {
      throw new Error(`A aba "${nomeAba}" não tem a coluna "${coluna}". Use 📦 Inventário → Formatar / reparar abas.`);
    }
    const l = localizarLinha_(aba, idx, sku, Number(linha));
    if (!l) throw new Error(`Produto ${sku} não encontrado na aba "${nomeAba}".`);

    aba.getRange(l, idx[coluna] + 1).setValue(gravar);
    if (idx["Atualizado em"] !== undefined) aba.getRange(l, idx["Atualizado em"] + 1).setValue(new Date());
    if (idx["Atualizado por"] !== undefined) aba.getRange(l, idx["Atualizado por"] + 1).setValue(usuario_() || "Tela de contagem");
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

/************** RELATÓRIOS **************/
const PALETA = {
  creme: "#F7F3EC", papel: "#FFFFFF", linha: "#E7E0D3", zebra: "#FBF9F5",
  salvia: "#6E8466", salviaEsc: "#4F6249", texto: "#2E3A2C", suave: "#7A776F",
  dourado: "#B39463", laranja: "#B0643A", laranjaFundo: "#F8E7DA",
};
const FAIXAS_VALIDADE = [
  { id: "vencido", rotulo: "Vencido",              curto: "Vencido",       cor: "#A94A43", fundo: "#F6E1DE", meses: 0 },
  { id: "m6",      rotulo: "Vence em até 6 meses", curto: "Até 6 meses",   cor: "#B0643A", fundo: "#F8E7DA", meses: 6 },
  { id: "m12",     rotulo: "6 a 12 meses",         curto: "6 a 12 meses",  cor: "#93762E", fundo: "#F4ECD5", meses: 12 },
  { id: "m24",     rotulo: "12 a 24 meses",        curto: "12 a 24 meses", cor: "#5C7754", fundo: "#E6EDE1", meses: 24 },
  { id: "m36",     rotulo: "24 a 36 meses",        curto: "24 a 36 meses", cor: "#56708A", fundo: "#E3EAF0", meses: 36 },
  { id: "mais",    rotulo: "Mais de 36 meses",     curto: "+ 36 meses",    cor: "#6F6A60", fundo: "#EFECE6" },
  { id: "sem",     rotulo: "Não informada",        curto: "",              cor: "#9A958B", fundo: "#F3F1EC" },
];
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * Gera o PDF (salvo no Drive) e envia o e-mail do relatório.
 * @param {string} tipo       "produtos" | "semEtiqueta"
 * @param {string} categoria  nome da aba, ou "" para todas
 */
function enviarRelatorio(tipo, categoria) {
  if (tipo !== "produtos" && tipo !== "semEtiqueta") throw new Error("Tipo de relatório inválido.");
  const dados = montarRelatorio_(tipo, categoria || "");

  const arquivo = pastaRelatorios_().createFile(gerarPdf_(dados));
  const url = arquivo.getUrl();

  const R = CONFIG.RELATORIO;
  MailApp.sendEmail({
    to: R.DESTINATARIOS.join(","),
    subject: dados.assunto,
    name: R.REMETENTE_NOME,
    htmlBody: htmlEmail_(dados, url),
    body: `${R.EMPRESA}\n${dados.titulo}\nCategoria: ${dados.categoria}\n\nAbrir relatório em PDF: ${url}`,
  });

  return { ok: true, url, destinatarios: R.DESTINATARIOS, produtos: dados.lista.length };
}

/** Lê a planilha e organiza tudo o que o e-mail e o PDF precisam. */
function montarRelatorio_(tipo, categoria) {
  const ss = getSpreadsheet_();
  const tz = ss.getSpreadsheetTimeZone();
  const agora = new Date();
  const hoje = inicioDoDia_(agora, tz);

  const abas = abasCategoria_(ss).filter((a) => !categoria || a.getName() === categoria);
  if (categoria && !abas.length) throw new Error(`Categoria "${categoria}" não encontrada.`);

  const secoes = [];
  abas.forEach((aba) => {
    let itens = lerAba_(aba).map((p) => Object.assign(p, { faixa: classificarValidade_(p.validade, hoje) }));
    if (tipo === "semEtiqueta") {
      itens = itens.filter((p) => p.semEtiqueta > 0).sort((a, b) => b.semEtiqueta - a.semEtiqueta);
    }
    if (itens.length || tipo === "semEtiqueta") secoes.push({ categoria: aba.getName(), itens });
  });
  if (tipo === "semEtiqueta") {
    // na visão "Todas", não mostra categorias sem pendência
    const comItens = secoes.filter((s) => s.itens.length);
    secoes.length = 0;
    comItens.forEach((s) => secoes.push(s));
  }

  const lista = [].concat.apply([], secoes.map((s) => s.itens));
  const soma = (campo) => lista.reduce((t, p) => t + p[campo], 0);
  const conta = (id) => lista.filter((p) => p.faixa === id).length;
  const rotuloCat = categoria || "Todas as categorias";
  const titulo = tipo === "produtos" ? "Produtos, quantidades e validades" : "Produtos sem etiqueta";
  const curtoTipo = tipo === "produtos" ? "Produtos" : "Sem etiqueta";

  const resumo = tipo === "produtos"
    ? [
        { valor: fmtNum_(lista.length), rotulo: "Produtos" },
        { valor: fmtNum_(soma("estoque")), rotulo: "Unidades" },
        { valor: fmtNum_(soma("semEtiqueta")), rotulo: "Sem etiqueta" },
        { valor: fmtNum_(conta("vencido")), rotulo: "Vencidos", cor: faixa_("vencido").cor, fundo: faixa_("vencido").fundo },
      ]
    : [
        { valor: fmtNum_(lista.length), rotulo: "Produtos afetados" },
        { valor: fmtNum_(soma("semEtiqueta")), rotulo: "Unidades sem etiqueta", cor: PALETA.laranja, fundo: PALETA.laranjaFundo },
      ];

  return {
    tipo, titulo, secoes, lista, resumo, tz,
    categoria: rotuloCat,
    variasCategorias: !categoria,
    contagemFaixas: FAIXAS_VALIDADE.map((f) => ({ faixa: f, qtd: conta(f.id) })),
    geradoEm: Utilities.formatDate(agora, tz, "dd/MM/yyyy 'às' HH:mm"),
    por: usuario_(),
    assunto: `Relatório de inventário · ${curtoTipo} · ${rotuloCat} · ${Utilities.formatDate(agora, tz, "dd/MM/yyyy")}`,
    arquivo: `Inventário · ${curtoTipo} · ${rotuloCat.replace(/\s*[\/\\]\s*/g, "-")} · ${Utilities.formatDate(agora, tz, "yyyy-MM-dd HH'h'mm")}.pdf`,
  };
}

/* ---------- E-mail (HTML de e-mail: tabelas, estilos simples) ---------- */
function htmlEmail_(d, urlPdf) {
  const P = PALETA;
  const R = CONFIG.RELATORIO;

  // Gmail corta mensagens muito grandes: acima do limite, mostra só o que pede atenção
  let secoes = d.secoes;
  let aviso = "";
  if (d.lista.length > R.MAX_LINHAS_EMAIL) {
    if (d.tipo === "produtos") {
      secoes = d.secoes
        .map((s) => ({ categoria: s.categoria, itens: s.itens.filter((p) => p.faixa === "vencido" || p.faixa === "m6") }))
        .filter((s) => s.itens.length);
      aviso = "Para o e-mail não ficar longo demais, abaixo estão só os produtos vencidos ou que vencem em até 6 meses. A lista completa está no PDF.";
    }
    let restante = R.MAX_LINHAS_EMAIL;
    secoes = secoes.map((s) => {
      const itens = s.itens.slice(0, Math.max(0, restante));
      restante -= itens.length;
      return { categoria: s.categoria, itens };
    }).filter((s) => s.itens.length);
    if (!aviso) aviso = "Para o e-mail não ficar longo demais, a lista foi resumida. A lista completa está no PDF.";
  }

  const cards = d.resumo.map((r) => `
      <td class="cp" width="${Math.floor(100 / d.resumo.length)}%" style="padding:0 5px;" valign="top">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${r.fundo || P.creme};border-radius:12px;">
          <tr><td class="ci" style="padding:14px 12px;text-align:center;">
            <div class="cv" style="font-family:${SERIF};font-size:26px;line-height:1.1;color:${r.cor || P.salviaEsc};">${r.valor}</div>
            <div class="cr" style="font-family:${SANS};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${P.suave};margin-top:5px;">${r.rotulo}</div>
          </td></tr>
        </table>
      </td>`).join("");

  const painel = d.tipo !== "produtos" ? "" : `
    <tr><td class="px" style="padding:18px 40px 0;">
      <div style="font-family:${SANS};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${P.suave};text-align:center;margin-bottom:10px;">Validades</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${P.linha};border-radius:12px;">
        ${d.contagemFaixas.map((c, k) => `<tr>
          <td style="padding:9px 14px;${k ? `border-top:1px solid ${P.linha};` : ""}font-family:${SANS};font-size:13px;color:${P.texto};">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c.faixa.cor};margin-right:9px;"></span>${c.faixa.rotulo}</td>
          <td align="right" style="padding:9px 14px;${k ? `border-top:1px solid ${P.linha};` : ""}font-family:${SERIF};font-size:16px;color:${c.faixa.cor};">${c.qtd}</td>
        </tr>`).join("")}
      </table>
    </td></tr>`;

  const th = (txt, alinhar) =>
    `<th class="cc" align="${alinhar}" style="padding:0 8px 10px;font-family:${SANS};font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${P.suave};font-weight:600;border-bottom:1.5px solid ${P.salvia};">${txt}</th>`;

  const tabela = (s) => {
    const cab = d.tipo === "produtos"
      ? `<tr>${th("Produto", "left")}${th("Qtd.", "center")}${th("S/ etiq.", "center")}${th("Validade", "right")}</tr>`
      : `<tr>${th("Produto", "left")}${th("Sem etiqueta", "center")}${th("Total", "right")}</tr>`;
    const linhas = s.itens.map((p, k) => {
      const cls = p.faixa === "vencido" && d.tipo === "produtos" ? "x" : (k % 2 ? "z" : "");
      const nome = `<td class="n cc">${esc_(nomeCurto_(p.nome))}<div class="s">${esc_(p.sku)}</div></td>`;
      if (d.tipo === "produtos") {
        const f = faixa_(p.faixa);
        return `<tr class="${cls}">${nome}
          <td class="q cc" style="color:${p.estoque ? P.texto : P.suave};">${p.estoque}</td>
          <td class="q cc" style="color:${p.semEtiqueta ? P.laranja : P.suave};">${p.semEtiqueta || "—"}</td>
          <td class="v cc">${p.validade ? fmtData_(p.validade, d.tz) : "—"}${f.curto ? `<br><span class="p" style="background:${f.fundo};color:${f.cor};">${f.curto}</span>` : ""}</td></tr>`;
      }
      return `<tr class="${cls}">${nome}
        <td class="q cc" style="color:${P.laranja};font-size:20px;">${p.semEtiqueta}</td>
        <td class="v cc" style="color:${P.suave};">de ${p.estoque} em estoque</td></tr>`;
    }).join("");
    const titulo = d.variasCategorias
      ? `<div style="font-family:${SERIF};font-size:18px;color:${P.salviaEsc};margin:26px 0 10px;">${esc_(s.categoria)}
           <span style="font-family:${SANS};font-size:12px;color:${P.suave};">· ${s.itens.length} ${s.itens.length === 1 ? "produto" : "produtos"}</span></div>`
      : "";
    return `${titulo}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cab}${linhas}</table>`;
  };

  let corpo;
  if (!d.lista.length) {
    corpo = d.tipo === "semEtiqueta"
      ? `<div style="text-align:center;font-family:${SERIF};font-size:18px;color:${P.salviaEsc};padding:24px;">Tudo etiquetado. Nenhuma pendência nesta categoria. ✿</div>`
      : `<div style="text-align:center;font-family:${SERIF};font-size:18px;color:${P.salviaEsc};padding:24px;">Nenhum produto nesta categoria.</div>`;
  } else {
    const nota = d.tipo === "semEtiqueta"
      ? `<div style="font-family:${SANS};font-size:13px;color:${P.suave};text-align:center;margin:0 0 6px;">Ordenado do maior para o menor número de unidades sem etiqueta.</div>`
      : "";
    const avisoHtml = aviso
      ? `<div style="font-family:${SANS};font-size:13px;color:${P.suave};text-align:center;background:${P.creme};border-radius:10px;padding:10px 14px;margin:0 0 12px;">${aviso}</div>`
      : "";
    corpo = avisoHtml + nota + secoes.map(tabela).join("");
  }

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc_(d.titulo)} · ${esc_(R.EMPRESA)}</title>
<style>
  td.n{padding:11px 8px;border-bottom:1px solid ${P.linha};font-family:${SANS};font-size:13px;color:${P.texto};line-height:1.35}
  td.q{padding:11px 6px;border-bottom:1px solid ${P.linha};font-family:${SERIF};font-size:16px;text-align:center}
  td.v{padding:11px 8px;border-bottom:1px solid ${P.linha};font-family:${SANS};font-size:12px;color:${P.texto};text-align:right;white-space:nowrap}
  div.s{font-size:11px;color:${P.suave};margin-top:2px}
  span.p{display:inline-block;white-space:nowrap;font-family:${SANS};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-top:4px}
  tr.z td{background:${P.zebra}}
  tr.x td{background:#FBEFED}
  @media (max-width:620px){
    .px{padding-left:14px!important;padding-right:14px!important}
    .cp{padding:0 2px!important} .ci{padding:10px 4px!important}
    .cv{font-size:20px!important} .cr{font-size:9px!important;letter-spacing:.03em!important}
    td.n{font-size:12px!important} .cc{padding-left:4px!important;padding-right:4px!important}
  }
</style></head>
<body style="margin:0;padding:0;background:${P.creme};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${P.creme};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:${P.papel};border-radius:18px;overflow:hidden;border:1px solid ${P.linha};">
    <tr><td style="height:6px;background:${P.salvia};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td class="px" style="padding:34px 40px 10px;text-align:center;">
      <div style="font-family:${SERIF};font-size:13px;color:${P.dourado};">❦</div>
      <div style="font-family:${SERIF};font-size:28px;letter-spacing:.04em;color:${P.salviaEsc};margin-top:6px;">${esc_(R.EMPRESA)}</div>
      <div style="width:56px;height:1px;background:${P.dourado};margin:16px auto;"></div>
      <div style="font-family:${SANS};font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${P.suave};">Relatório de inventário</div>
      <div style="font-family:${SERIF};font-size:22px;color:${P.texto};margin-top:8px;">${esc_(d.titulo)}</div>
    </td></tr>
    <tr><td class="px" style="padding:6px 40px 22px;text-align:center;font-family:${SANS};font-size:13px;color:${P.suave};line-height:1.6;">
      Categoria <b style="color:${P.texto};font-weight:600;">${esc_(d.categoria)}</b><br>
      Gerado em ${d.geradoEm}${d.por ? " · por " + esc_(d.por) : ""}
    </td></tr>
    <tr><td class="px" style="padding:0 35px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table>
    </td></tr>
    ${painel}
    <tr><td align="center" style="padding:22px 40px 26px;">
      <a href="${urlPdf}" target="_blank" style="display:inline-block;background:${P.salvia};color:#ffffff;text-decoration:none;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:.04em;padding:13px 30px;border-radius:999px;">&#128196;&nbsp; Abrir relatório em PDF</a>
    </td></tr>
    <tr><td class="px" style="padding:0 40px 30px;">${corpo}</td></tr>
    <tr><td style="background:${P.creme};padding:22px 40px;text-align:center;font-family:${SANS};font-size:11px;line-height:1.7;color:${P.suave};border-top:1px solid ${P.linha};">
      <span style="font-family:${SERIF};font-size:13px;color:${P.salviaEsc};">${esc_(R.EMPRESA)}</span><br>
      Os números refletem a planilha no momento do envio.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/* ---------- PDF ----------
 * O conversor de HTML→PDF do Google aceita bem menos CSS que um navegador.
 * Por isso o PDF usa só tabelas, cores de fundo em CÉLULAS, fontes padrão e
 * nenhum símbolo especial. Se mesmo assim o arquivo sair inválido, uma versão
 * ainda mais simples é gerada (veja gerarPdf_).
 */
function gerarPdf_(d) {
  const tentativas = [
    { modo: "completo", html: htmlPdf_(d, false) },
    { modo: "simples", html: htmlPdf_(d, true) },
  ];
  for (let k = 0; k < tentativas.length; k++) {
    try {
      const blob = Utilities.newBlob(tentativas[k].html, "text/html", "relatorio.html").getAs("application/pdf");
      if (pdfValido_(blob)) return blob.setName(d.arquivo);
      console.warn(`PDF ${tentativas[k].modo} inválido (${blob.getBytes().length} bytes); tentando de novo.`);
    } catch (e) {
      console.warn(`Falha ao gerar PDF ${tentativas[k].modo}: ${e.message}`);
    }
  }
  throw new Error("Não foi possível gerar o PDF do relatório. Tente novamente em alguns minutos.");
}

/** Confere a "assinatura" do arquivo: começa com %PDF e termina com %%EOF. */
function pdfValido_(blob) {
  const bytes = blob.getBytes();
  if (!bytes || bytes.length < 800) return false;
  const txt = (arr) => arr.map((b) => String.fromCharCode(b & 0xff)).join("");
  const inicio = txt(bytes.slice(0, 5));
  const fim = txt(bytes.slice(Math.max(0, bytes.length - 1024)));
  return inicio === "%PDF-" && fim.indexOf("%%EOF") > -1;
}

function htmlPdf_(d, simples) {
  const P = PALETA;
  const R = CONFIG.RELATORIO;
  const serif = "Georgia, 'Times New Roman', serif";
  const fundo = (cor) => (simples ? "" : `background-color:${cor};`);
  const w = Math.floor(100 / d.resumo.length);

  const resumo = d.resumo.map((r) => `
      <td width="${w}%" style="${fundo(r.fundo || P.creme)}text-align:center;padding:8px 4px;border:4px solid #FFFFFF;">
        <font face="Georgia" size="5" color="${r.cor || P.salviaEsc}">${r.valor}</font><br>
        <font size="1" color="${P.suave}">${r.rotulo.toUpperCase()}</font>
      </td>`).join("");

  const legenda = d.tipo !== "produtos" ? "" : `
    <p align="center" style="margin:4px 0 10px 0;"><font size="1">
      ${d.contagemFaixas.map((c) => `<font color="${c.faixa.cor}">${c.faixa.rotulo}: <b>${c.qtd}</b></font>`).join(' &nbsp;&nbsp;|&nbsp;&nbsp; ')}
    </font></p>`;

  const th = (txt, alinhar) =>
    `<th align="${alinhar}" style="padding:5px 6px;border-bottom:2px solid ${P.salvia};"><font size="1" color="${P.suave}">${txt.toUpperCase()}</font></th>`;
  const vazio = "-";

  const tabela = (s) => {
    const cab = d.tipo === "produtos"
      ? `<tr>${th("Código", "left")}${th("Produto", "left")}${th("Qtd.", "center")}${th("S/ etiq.", "center")}${th("Validade", "right")}${th("Situação", "center")}</tr>`
      : `<tr>${th("Código", "left")}${th("Produto", "left")}${th("Sem etiqueta", "center")}${th("Em estoque", "center")}${th("Etiquetado", "center")}</tr>`;
    const linhas = s.itens.map((p, k) => {
      const corLinha = p.faixa === "vencido" && d.tipo === "produtos" ? "#FBEFED" : (k % 2 ? P.zebra : "#FFFFFF");
      const td = (conteudo, alinhar, extra) =>
        `<td align="${alinhar}" style="${fundo(corLinha)}padding:5px 6px;border-bottom:1px solid ${P.linha};${extra || ""}">${conteudo}</td>`;
      const ini = td(`<font size="1" color="${P.suave}">${esc_(p.sku)}</font>`, "left") +
                  td(`<font size="2">${esc_(nomeCurto_(p.nome))}</font>`, "left");
      if (d.tipo === "produtos") {
        const f = faixa_(p.faixa);
        const situacao = f.curto
          ? `<td align="center" style="${fundo(f.fundo)}padding:5px 6px;border-bottom:1px solid ${P.linha};"><font size="1" color="${f.cor}"><b>${f.curto}</b></font></td>`
          : td(`<font size="1" color="${P.suave}">${vazio}</font>`, "center");
        return `<tr>${ini}
          ${td(`<font face="Georgia" size="2" color="${p.estoque ? P.texto : P.suave}">${p.estoque}</font>`, "center")}
          ${td(`<font face="Georgia" size="2" color="${p.semEtiqueta ? P.laranja : P.suave}">${p.semEtiqueta || vazio}</font>`, "center")}
          ${td(`<font size="2">${p.validade ? fmtData_(p.validade, d.tz) : vazio}</font>`, "right")}
          ${situacao}</tr>`;
      }
      return `<tr>${ini}
        ${td(`<font face="Georgia" size="3" color="${P.laranja}">${p.semEtiqueta}</font>`, "center")}
        ${td(`<font face="Georgia" size="2">${p.estoque}</font>`, "center")}
        ${td(`<font size="2" color="${P.suave}">[&nbsp;&nbsp;&nbsp;]</font>`, "center")}</tr>`;
    }).join("");
    const titulo = d.variasCategorias
      ? `<p style="margin:14px 0 6px 0;"><font face="Georgia" size="4" color="${P.salviaEsc}">${esc_(s.categoria)}</font>
           <font size="1" color="${P.suave}">&nbsp;-&nbsp;${s.itens.length} ${s.itens.length === 1 ? "produto" : "produtos"}</font></p>`
      : "";
    return `${titulo}<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cab}${linhas}</table>`;
  };

  const corpo = d.lista.length
    ? d.secoes.map(tabela).join("")
    : `<p align="center" style="padding:30px;"><font face="Georgia" size="4" color="${P.salviaEsc}">${d.tipo === "semEtiqueta" ? "Tudo etiquetado. Nenhuma pendência nesta categoria." : "Nenhum produto nesta categoria."}</font></p>`;

  return `<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial, Helvetica, sans-serif;color:${P.texto};">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding-bottom:10px;border-bottom:1px solid ${P.linha};">
      <font face="Georgia" size="6" color="${P.salviaEsc}">${esc_(R.EMPRESA)}</font><br>
      <font size="1" color="${P.suave}">RELATÓRIO DE INVENTÁRIO</font><br>
      <font face="Georgia" size="4">${esc_(d.titulo)}</font>
    </td></tr>
    <tr><td align="center" style="padding:8px 0 10px 0;">
      <font size="2" color="${P.suave}">Categoria <b>${esc_(d.categoria)}</b> &nbsp;-&nbsp; Gerado em ${d.geradoEm}${d.por ? " &nbsp;-&nbsp; por " + esc_(d.por) : ""}</font>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>${resumo}</tr></table>
  ${legenda}
  ${corpo}
  <p align="center" style="margin-top:14px;"><font size="1" color="${P.suave}"><font face="Georgia" color="${P.salviaEsc}">${esc_(R.EMPRESA)}</font> - Os números refletem a planilha no momento do envio</font></p>
</body></html>`;
}

/**
 * Diagnóstico: rode no editor (Executar → testarPdf) para gerar os PDFs da
 * primeira categoria SEM enviar e-mail. O resultado aparece no "Registro de execução"
 * e os arquivos ficam na pasta de relatórios.
 */
function testarPdf() {
  const cat = abasCategoria_(getSpreadsheet_()).map((a) => a.getName())[0] || "";
  ["produtos", "semEtiqueta"].forEach((tipo) => {
    const d = montarRelatorio_(tipo, cat);
    [false, true].forEach((simples) => {
      const blob = Utilities.newBlob(htmlPdf_(d, simples), "text/html", "t.html").getAs("application/pdf");
      const nome = `TESTE · ${tipo} · ${simples ? "simples" : "completo"}.pdf`;
      const ok = pdfValido_(blob);
      pastaRelatorios_().createFile(blob.setName(nome));
      console.log(`${nome}: ${blob.getBytes().length} bytes · ${ok ? "válido" : "INVÁLIDO"}`);
    });
  });
}

/** Pasta do Drive para os PDFs: usa PASTA_ID, ou cria/acha a pasta pelo nome (uma vez). */
function pastaRelatorios_() {
  const R = CONFIG.RELATORIO;
  if (R.PASTA_ID) return DriveApp.getFolderById(R.PASTA_ID);
  const props = PropertiesService.getScriptProperties();
  const guardado = props.getProperty("PASTA_RELATORIOS_ID");
  if (guardado) {
    try {
      const p = DriveApp.getFolderById(guardado);
      if (!p.isTrashed()) return p;
    } catch (e) {
      // pasta apagada — cria outra abaixo
    }
  }
  const existentes = DriveApp.getRootFolder().getFoldersByName(R.PASTA_NOME);
  const pasta = existentes.hasNext() ? existentes.next() : DriveApp.createFolder(R.PASTA_NOME);
  props.setProperty("PASTA_RELATORIOS_ID", pasta.getId());
  return pasta;
}

/************** HELPERS **************/
function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** Mapa { "Nome da coluna": índice (0-based) } a partir do cabeçalho. */
function indice_(aba) {
  const ultima = aba.getLastColumn();
  if (ultima < 1) return {};
  const cab = aba.getRange(1, 1, 1, ultima).getValues()[0];
  const idx = {};
  cab.forEach((c, i) => {
    const nome = String(c).trim();
    if (nome && idx[nome] === undefined) idx[nome] = i;
  });
  return idx;
}

/** Lê os produtos de uma aba de categoria (linhas vazias são ignoradas). */
function lerAba_(aba) {
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];
  const idx = indice_(aba);
  const valores = aba.getRange(2, 1, ultimaLinha - 1, aba.getLastColumn()).getValues();
  const pega = (l, col) => (idx[col] !== undefined ? l[idx[col]] : "");
  const lidos = [];
  valores.forEach((l, k) => {
    const sku = String(pega(l, "SKU") || "").trim();
    const nome = String(pega(l, "Produto") || "").trim();
    if (!sku && !nome) return;
    lidos.push({
      linha: k + 2,
      categoria: aba.getName(),
      sku,
      nome: nome || sku,
      estoque: inteiro_(pega(l, "Estoque")),
      semEtiqueta: inteiro_(pega(l, "Sem Etiqueta")),
      validade: paraData_(pega(l, "Validade")),
      foto: String(pega(l, "Foto") || "").trim(),
    });
  });
  return lidos;
}

/** Confere se o produto ainda está na linha esperada; se não, procura pelo SKU na aba. */
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

/** Lê a pasta de fotos e devolve { SKU: idDoArquivo } (nome do arquivo sem extensão = SKU). */
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

/** URL da foto: 1º a coluna "Foto" (link do Drive ou URL), 2º o arquivo com o nome do SKU na pasta. */
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

function classificarValidade_(validade, hoje) {
  if (!validade) return "sem";
  if (validade < hoje) return "vencido";
  for (let i = 1; i < FAIXAS_VALIDADE.length; i++) {
    const f = FAIXAS_VALIDADE[i];
    if (f.meses && validade <= somarMeses_(hoje, f.meses)) return f.id;
  }
  return "mais";
}

function faixa_(id) {
  return FAIXAS_VALIDADE.filter((f) => f.id === id)[0];
}

function somarMeses_(d, meses) {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + meses);
  return r;
}

function inicioDoDia_(d, tz) {
  const s = Utilities.formatDate(d, tz, "yyyy-MM-dd").split("-");
  return new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
}

/** Nome sem o sufixo repetido "- Pronto para Pele / Massagem" (só nos relatórios). */
function nomeCurto_(nome) {
  return String(nome).replace(/\s*-?\s*Pronto (para )?Pele \/ Massagem\s*$/i, "");
}

function inteiro_(v) {
  if (typeof v === "number") return isFinite(v) ? Math.max(0, Math.round(v)) : 0;
  const n = parseInt(String(v || "").replace(/\D/g, ""), 10);
  return isFinite(n) ? n : 0;
}

/** Aceita data da planilha (Date) ou texto "dd/mm/aaaa". */
function paraData_(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const m = String(v || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

function isoParaData_(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("Data de validade inválida.");
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fmtData_(d, tz) {
  return Utilities.formatDate(d, tz, "dd/MM/yyyy");
}

function fmtNum_(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function esc_(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function usuario_() {
  try {
    return Session.getActiveUser().getEmail() || "";
  } catch (e) {
    return "";
  }
}

function avisar_(msg) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Inventário", 5);
  } catch (e) {
    console.log(msg);
  }
}
