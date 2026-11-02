/**
 * Essência do Brasil · Envio da proposta de melhoria (nova embalagem)
 *
 * COMO USAR
 * 1. Suba o PDF para uma pasta no Google Drive.
 * 2. Abra o PDF no Drive e copie o ID que aparece no link:
 *    https://drive.google.com/file/d/ESTE_É_O_ID/view
 * 3. Cole o ID em CONFIG.PDF_FILE_ID e preencha CONFIG.REMETENTE_NOME.
 * 4. Rode primeiro "enviarTeste" (o e-mail chega só para você).
 * 5. Se estiver tudo certo, rode "enviarProposta".
 */

const CONFIG = {
  PDF_FILE_ID: 'COLE_AQUI_O_ID_DO_PDF',
  DESTINATARIO: 'victor@gigaimports.com',
  DESTINATARIO_NOME: 'Victor',
  REMETENTE_NOME: 'Seu Nome',          // aparece na assinatura
  NOME_EXIBICAO: 'Essência do Brasil', // aparece como remetente na caixa de entrada
  ASSUNTO: 'Uma pequena ideia para a nossa expedição',
  // true: o Victor recebe acesso de leitor ao PDF (recomendado).
  // false: você mesmo cuida do compartilhamento do arquivo no Drive.
  COMPARTILHAR_PDF: true
};

/** Envia o e-mail definitivo para o destinatário. */
function enviarProposta() {
  enviar_(CONFIG.DESTINATARIO, CONFIG.COMPARTILHAR_PDF);
}

/** Envia uma cópia de teste só para você, sem compartilhar o PDF. */
function enviarTeste() {
  enviar_(Session.getActiveUser().getEmail(), false);
}

function enviar_(para, compartilhar) {
  const arquivo = DriveApp.getFileById(CONFIG.PDF_FILE_ID);

  if (compartilhar) {
    // Dá acesso de leitura só ao destinatário; o arquivo continua privado.
    arquivo.addViewer(para);
  }

  const link = arquivo.getUrl();
  const html = montarHtml_(link, CONFIG.DESTINATARIO_NOME, CONFIG.REMETENTE_NOME);
  const texto = montarTexto_(link, CONFIG.DESTINATARIO_NOME, CONFIG.REMETENTE_NOME);

  GmailApp.sendEmail(para, CONFIG.ASSUNTO, texto, {
    htmlBody: html,
    name: CONFIG.NOME_EXIBICAO
  });

  Logger.log('E-mail enviado para ' + para);
}

/** Versão em texto simples, para leitores de e-mail que não exibem HTML. */
function montarTexto_(link, nome, remetente) {
  return [
    'Olá, ' + nome + ',',
    '',
    'Preparei uma proposta curta para melhorar a embalagem dos nossos pedidos: ' +
      'caixa com trava + envelope de segurança, sem fita adesiva.',
    'O processo fica mais rápido e seguro, e o pacote chega com um visual mais profissional.',
    '',
    'Abrir a proposta (PDF): ' + link,
    '',
    'P.S.: Lembra quando você perguntou o que eu faria com R$ 10 mil na empresa? ' +
      'Eu disse que tinha muitas ideias, mas não ia entregar todas de uma vez. ' +
      'Esta é só uma pequena amostra, e as outras continuam guardadas a sete chaves (por enquanto).',
    '',
    'Com carinho,',
    remetente,
    'Essência do Brasil'
  ].join('\n');
}

/** Corpo do e-mail em HTML (tabelas e estilos inline para funcionar no Gmail e no Outlook). */
function montarHtml_(link, nome, remetente) {
  const c = {
    fundo: '#F4EFE6',
    papel: '#FFFDF9',
    verde: '#1F3D2B',
    dourado: '#B08D57',
    douradoClaro: '#E9DCC4',
    texto: '#3B3A36',
    suave: '#7A766C'
  };
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${CONFIG.ASSUNTO}</title>
</head>
<body style="margin:0;padding:0;background:${c.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Uma proposta simples para embalar mais rápido e enviar com mais segurança.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.fundo};">
 <tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${c.papel};border:1px solid ${c.douradoClaro};border-radius:6px;">

   <!-- Cabeçalho -->
   <tr><td align="center" style="padding:44px 48px 8px;">
    <div style="font-family:${sans};font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${c.dourado};">Proposta de melhoria</div>
    <div style="font-family:${serif};font-size:30px;line-height:1.2;color:${c.verde};margin-top:10px;font-style:italic;">Essência do Brasil</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;">
     <tr>
      <td valign="middle" style="width:48px;"><div style="height:1px;line-height:1px;font-size:0;background:${c.dourado};">&nbsp;</div></td>
      <td style="padding:0 10px;font-family:${serif};font-size:12px;color:${c.dourado};">&#10022;</td>
      <td valign="middle" style="width:48px;"><div style="height:1px;line-height:1px;font-size:0;background:${c.dourado};">&nbsp;</div></td>
     </tr>
    </table>
   </td></tr>

   <!-- Corpo -->
   <tr><td style="padding:28px 40px 8px;font-family:${sans};font-size:15px;line-height:1.75;color:${c.texto};">
    <p style="margin:0 0 18px;font-family:${serif};font-size:19px;color:${c.verde};">Olá, ${nome},</p>
    <p style="margin:0 0 16px;">Preparei uma proposta curta, com mais imagens do que palavras, para melhorar uma etapa que repetimos dezenas de vezes por dia: <strong style="color:${c.verde};">a embalagem dos pedidos</strong>.</p>
    <p style="margin:0 0 16px;">A ideia é trocar a fita adesiva por uma <em>caixa com trava</em> e um <em>envelope de segurança</em>. É uma mudança pequena que deixa o processo mais rápido e seguro e o pacote com um visual mais profissional.</p>
    <p style="margin:0;">Leva poucos minutos para ler.</p>
   </td></tr>

   <!-- Botão -->
   <tr><td align="center" style="padding:32px 48px 36px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
     <tr><td align="center" bgcolor="${c.verde}" style="border-radius:40px;">
      <a href="${link}" target="_blank" style="display:inline-block;padding:16px 38px;font-family:${sans};font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;border-radius:40px;border:1px solid ${c.verde};">Abrir a proposta &nbsp;&rarr;</a>
     </td></tr>
    </table>
    <div style="font-family:${sans};font-size:11px;color:${c.suave};margin-top:12px;">PDF · 10 páginas</div>
   </td></tr>

   <!-- P.S. brincadeira -->
   <tr><td style="padding:0 32px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.fundo};border-left:3px solid ${c.dourado};border-radius:4px;">
     <tr><td style="padding:22px 26px;font-family:${sans};font-size:14px;line-height:1.7;color:${c.texto};">
      <div style="font-family:${serif};font-size:17px;font-style:italic;color:${c.verde};margin-bottom:8px;">P.S.: sobre aqueles R$ 10 mil…</div>
      Lembra quando você me perguntou o que eu faria se tivesse R$ 10 mil para melhorar a empresa? Eu disse que tinha muitas ideias, mas que não ia sair entregando todas assim, de graça.
      <br><br>
      Pois bem: considere este PDF um <strong style="color:${c.verde};">trailer</strong>. É uma ideia pequena, que nem chega perto dos 10 mil. As outras continuam guardadas a sete chaves, esperando a proposta certa. &#128521;
     </td></tr>
    </table>
   </td></tr>

   <!-- Assinatura -->
   <tr><td style="padding:0 40px 44px;font-family:${sans};font-size:14px;line-height:1.6;color:${c.texto};">
    <div style="color:${c.suave};">Com carinho,</div>
    <div style="font-family:${serif};font-size:20px;font-style:italic;color:${c.verde};margin-top:4px;">${remetente}</div>
    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${c.dourado};margin-top:4px;">Essência do Brasil</div>
   </td></tr>

  </table>

  <div style="font-family:${sans};font-size:11px;color:${c.suave};margin-top:18px;">Se o botão não funcionar, <a href="${link}" style="color:${c.verde};">clique aqui para abrir o PDF</a>.</div>

 </td></tr>
</table>
</body>
</html>`;
}
