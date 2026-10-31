# 📦 Essência do Brasil — Contagem de Inventário (Google Apps Script)

Tela para contar o estoque **produto por produto**, pensada para o celular e ligada à planilha
**Inventário de Produtos** no Google Sheets. Cada toque grava direto na planilha.

```
┌──────────────────────────┐
│ Título              [☰]  │  nome · código · categoria (aba)
│ ┌──────────────────────┐ │
│ │        Foto          │ │  vem da pasta do Google Drive
│ └──────────────────────┘ │
│     [−]   320   [+]      │  quantidade contada (substitui o Estoque)
│ [       Validade       ] │  abre o calendário; vermelho se vencido
│  [⇦]     1 de 55    [⇨]  │  dentro da categoria do filtro; dá a volta
│ Sem Etiqueta [−] [0] [+] │
└──────────────────────────┘
```

## Categorias = abas da planilha

- Cada **aba** é uma categoria (ex.: *P/ Pele 30ml*, *P/ Pele 100ml*).
- Toda aba que tem as colunas **SKU**, **Produto** e **Estoque** entra na tela automaticamente,
  na ordem das abas. Abas sem produtos não aparecem.
- A aba **Produtos** é ignorada. Para ignorar outras, inclua o nome em `ABAS_IGNORADAS` no `Code.gs`.
- Para criar uma categoria nova com o cabeçalho certo: menu **📦 Inventário → Criar nova categoria (aba)**.

Colunas de cada aba:

| SKU | Produto | Estoque | Sem Etiqueta | Validade | Foto | Atualizado em | Atualizado por |
|---|---|---|---|---|---|---|---|

A ordem das colunas pode mudar, porque elas são encontradas pelo nome do cabeçalho.
Use **📦 Inventário → Formatar / reparar abas** para acrescentar colunas que faltarem e aplicar os formatos.

## Menu ☰

- **Filtro (categoria)**: *Todas* ou uma aba específica. As setas andam só dentro da categoria escolhida.
  Em *Todas*, seguem a ordem das abas.
- **Relatório**: envia por e-mail o relatório **da categoria do filtro**:
  - **Produtos**: quantidades, sem etiqueta e validades, com faixas de vencimento
    (vencido, até 6 meses, 6 a 12, 12 a 24, 24 a 36, mais de 36 meses).
  - **Sem etiqueta**: só os produtos com unidades sem etiqueta, do maior para o menor.
- **Pesquisa**: procura por nome ou código em todas as categorias. Ao escolher um produto,
  o filtro muda para a categoria dele.

A tela lembra a categoria e o produto onde você parou, naquele aparelho.

## Relatórios por e-mail

- **Destinatário**: `victor@gigaimports.com`. Para mudar, edite `CONFIG.RELATORIO.DESTINATARIOS` no `Code.gs`.
- **Remetente**: aparece como *Essência do Brasil*. O envio sai da conta que implantou o script.
- **PDF**: é salvo na pasta **"Relatórios de Inventário"** do seu Drive. O script cria a pasta no primeiro envio.
  O e-mail traz o botão **"Abrir relatório em PDF"**, que abre esse arquivo.
  Para usar outra pasta, cole o ID dela em `CONFIG.RELATORIO.PASTA_ID`.
- Antes de gerar, a tela grava a contagem que ainda estiver pendente, para o relatório sair atualizado.
- Com muitos produtos (mais de 150), o e-mail mostra só os vencidos e os que vencem em até 6 meses,
  para o Gmail não cortar a mensagem. O PDF sempre traz a lista completa.

## Fotos

1. Crie uma pasta no Drive e nomeie cada imagem com o **SKU**: `2511202501.jpg`, `2711202501.png`…
2. Compartilhe a pasta como **"Qualquer pessoa com o link: Leitor"**.
3. Cole o ID da pasta (o trecho da URL depois de `/folders/`) em `PASTA_FOTOS_ID`, no começo do `Code.gs`.

Também dá para colar o link de uma imagem na coluna **Foto** de um produto. Produto sem foto mostra 📦.
Para ver fotos novas na hora: **📦 Inventário → Recarregar lista de fotos**.

## Atualizar o projeto no Apps Script

1. Na planilha, abra **Extensões → Apps Script**.
2. Substitua o conteúdo de `Código.gs` pelo de [`Code.gs`](Code.gs) e o de `Dashboard` pelo de [`Dashboard.html`](Dashboard.html).
3. Substitua o `appsscript.json` pelo de [`appsscript.json`](appsscript.json).
   Se ele não aparecer: **Configurações do projeto → Mostrar arquivo de manifesto**.
4. Salve. Escolha a função **`repararAbas`** e clique em **Executar**.
   Como agora há permissões novas (enviar e-mail e salvar o PDF no Drive), o Google vai pedir autorização de novo.
5. **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar.** O link da tela continua o mesmo.

## Arquivos

| Arquivo | Função |
|---|---|
| `Code.gs` | Servidor: categorias (abas), leitura e gravação, fotos, relatórios (e-mail + PDF no Drive), menu da planilha |
| `Dashboard.html` | A tela de contagem (HTML + CSS + JS, sem bibliotecas externas), tema claro e escuro |
| `appsscript.json` | Manifesto: fuso `America/Sao_Paulo`, runtime V8 e permissões |
