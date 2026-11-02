/**
 * Essência do Brasil · Envio da proposta de melhoria (nova embalagem)
 *
 * COMO USAR
 * 1. Suba o PDF para uma pasta no Google Drive.
 * 2. Abra o PDF no Drive e copie o ID que aparece no link:
 *    https://drive.google.com/file/d/ESTE_É_O_ID/view
 * 3. Cole o ID em CONFIG.PDF_FILE_ID.
 * 4. Rode primeiro "enviarTeste" (o e-mail chega só para você).
 * 5. Se estiver tudo certo, rode "enviarProposta".
 */

const CONFIG = {
  PDF_FILE_ID: 'COLE_AQUI_O_ID_DO_PDF',
  // Coloque um e-mail por linha, entre aspas simples e com vírgula no final.
  DESTINATARIOS: [
    'victor@gigaimports.com',
    // 'outra.pessoa@empresa.com',
  ],
  NOME_EXIBICAO: 'Essência do Brasil', // aparece como remetente na caixa de entrada
  ASSUNTO: 'Proposta · Uma nova forma de embalar',
  // true: o destinatário recebe acesso de leitor ao PDF (recomendado).
  // false: você mesmo cuida do compartilhamento do arquivo no Drive.
  COMPARTILHAR_PDF: true
};

/** Envia o e-mail definitivo para o destinatário. */
function enviarProposta() {
  enviar_(CONFIG.DESTINATARIOS, CONFIG.COMPARTILHAR_PDF);
}

/** Envia uma cópia de teste só para você, sem compartilhar o PDF. */
function enviarTeste() {
  enviar_([Session.getActiveUser().getEmail()], false);
}

function enviar_(destinatarios, compartilhar) {
  const para = destinatarios.join(',');
  const arquivo = DriveApp.getFileById(CONFIG.PDF_FILE_ID);

  if (compartilhar) {
    // Dá acesso de leitura só aos destinatários; o arquivo continua privado.
    arquivo.addViewers(destinatarios);
  }

  const link = arquivo.getUrl();

  GmailApp.sendEmail(para, CONFIG.ASSUNTO, montarTexto_(link), {
    htmlBody: montarHtml_(link),
    name: CONFIG.NOME_EXIBICAO
  });

  Logger.log('E-mail enviado para ' + para);
}

/** Versão em texto simples, para leitores de e-mail que não exibem HTML. */
function montarTexto_(link) {
  return [
    'ESSÊNCIA DO BRASIL',
    '',
    'Uma nova forma de embalar.',
    '',
    'Uma proposta para melhorar a embalagem dos nossos produtos.',
    'Acesse o PDF para entender melhor:',
    link,
    '',
    '— Sobre aqueles R$ 10 mil —',
    'Este PDF é só o couvert: pão quentinho, manteiga e um gostinho do que vem por aí.',
    'O prato principal, a sobremesa e o cafezinho continuam trancados a sete chaves, num cofre',
    'mais bem guardado que a receita da Coca-Cola, cuja senha',
    'só é revelada diante de uma proposta irrecusável.',
    'E se o couvert não custa nem perto de 10 mil… imagine o banquete.',
    '',
    'Essência do Brasil'
  ].join('\n');
}

/** Corpo do e-mail em HTML (tabelas e estilos inline para funcionar no Gmail e no Outlook). */
function montarHtml_(link) {
  const c = {
    fundo: '#EDE6DA',
    papel: '#FCF9F3',
    verde: '#173326',
    verdeMedio: '#24493A',
    dourado: '#B8955C',
    douradoClaro: '#D9C39C',
    linha: '#E4D8C3',
    texto: '#3E3B35',
    suave: '#8A8274'
  };
  const serif = "'Didot', 'Bodoni 72', 'Playfair Display', Georgia, 'Times New Roman', serif";
  const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  // Ornamento: linha fina · losango · linha fina
  const ornamento = (cor, largura) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
     <tr>
      <td valign="middle" style="width:${largura}px;"><div style="height:1px;line-height:1px;font-size:0;background:${cor};">&nbsp;</div></td>
      <td valign="middle" style="padding:0 12px;font-family:${serif};font-size:11px;line-height:11px;color:${cor};">&#9670;</td>
      <td valign="middle" style="width:${largura}px;"><div style="height:1px;line-height:1px;font-size:0;background:${cor};">&nbsp;</div></td>
     </tr>
    </table>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${CONFIG.ASSUNTO}</title>
</head>
<body style="margin:0;padding:0;background:${c.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Uma proposta para melhorar a embalagem dos nossos produtos.</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.fundo};">
 <tr><td align="center" style="padding:44px 14px;">

  <!-- Moldura dupla -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${c.papel};border:1px solid ${c.douradoClaro};">
   <tr><td style="padding:8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${c.linha};">

     <!-- Cabeçalho verde -->
     <tr><td align="center" bgcolor="${c.verde}" style="background:${c.verde};padding:52px 32px 46px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
       <tr><td align="center" valign="middle" style="width:68px;height:68px;border:1px solid ${c.dourado};border-radius:50%;font-family:${serif};font-size:26px;font-style:italic;color:${c.dourado};line-height:68px;">E<span style="font-size:18px;">&middot;</span>B</td></tr>
      </table>
      <div style="font-family:${sans};font-size:10px;letter-spacing:6px;text-transform:uppercase;color:${c.douradoClaro};margin-top:22px;">Essência do Brasil</div>
      <div style="margin-top:26px;">${ornamento(c.dourado, 54)}</div>
      <div style="font-family:${serif};font-size:38px;line-height:1.15;font-style:italic;font-weight:normal;color:#F6EFE2;margin-top:26px;">Uma nova forma<br>de embalar.</div>
      <div style="font-family:${sans};font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${c.dourado};margin-top:18px;">Proposta de melhoria</div>
     </td></tr>

     <!-- Texto -->
     <tr><td align="center" style="padding:50px 48px 10px;">
      <div style="font-family:${serif};font-size:21px;line-height:1.55;color:${c.verde};">Uma proposta para melhorar<br>a embalagem dos nossos produtos.</div>
      <div style="font-family:${sans};font-size:14px;line-height:1.8;color:${c.suave};margin-top:14px;">Acesse o PDF para entender melhor.</div>
     </td></tr>

     <!-- Botão -->
     <tr><td align="center" style="padding:30px 40px 54px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
       <tr><td align="center" bgcolor="${c.verde}" style="background:${c.verde};border:1px solid ${c.dourado};">
        <a href="${link}" target="_blank" style="display:inline-block;padding:17px 34px;font-family:${sans};font-size:12px;letter-spacing:3px;white-space:nowrap;text-transform:uppercase;color:#F6EFE2;text-decoration:none;">Acessar a proposta</a>
       </td></tr>
      </table>
     </td></tr>

     <!-- Divisor -->
     <tr><td style="padding:0 48px;">${ornamento(c.douradoClaro, 120)}</td></tr>

     <!-- A brincadeira dos R$ 10 mil -->
     <tr><td align="center" style="padding:44px 52px 50px;">
      <div style="font-family:${sans};font-size:10px;letter-spacing:5px;text-transform:uppercase;color:${c.dourado};">Nota de rodapé</div>
      <div style="font-family:${serif};font-size:26px;font-style:italic;line-height:1.3;color:${c.verde};margin-top:12px;">Sobre aqueles R$ 10 mil…</div>
      <div style="font-family:${serif};font-size:16px;line-height:1.85;color:${c.texto};margin-top:20px;">
       Considere este PDF apenas o <em style="color:${c.verde};">couvert</em>: pão quentinho, manteiga e um gostinho do que vem por aí.
       <br><br>
       O prato principal, a sobremesa e até o cafezinho continuam trancados a sete chaves, num cofre mais bem guardado que a receita da <span style="white-space:nowrap;">Coca-Cola</span>, cuja senha só é revelada diante de uma <em style="color:${c.verde};">proposta irrecusável</em>.
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:28px;">
       <tr><td style="border-top:1px solid ${c.douradoClaro};border-bottom:1px solid ${c.douradoClaro};padding:16px 6px;font-family:${serif};font-size:19px;font-style:italic;line-height:1.5;color:${c.verde};text-align:center;">
        E se o couvert não custa nem perto de 10 mil…<br><span style="color:${c.dourado};">imagine o banquete.</span>
       </td></tr>
      </table>
     </td></tr>

     <!-- Rodapé -->
     <tr><td align="center" bgcolor="${c.verde}" style="background:${c.verde};padding:26px 32px;">
      <div style="font-family:${serif};font-size:15px;font-style:italic;color:${c.douradoClaro};">Essência do Brasil</div>
     </td></tr>

    </table>
   </td></tr>
  </table>

  <div style="font-family:${sans};font-size:11px;color:${c.suave};margin-top:20px;">Se o botão não funcionar, <a href="${link}" style="color:${c.verde};">clique aqui para abrir o PDF</a>.</div>

 </td></tr>
</table>
</body>
</html>`;
}
