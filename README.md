# 📦 Inventário de Produtos — Tela de Contagem (Google Apps Script)

Tela para contar o estoque **produto por produto**, pensada para o celular e ligada à planilha
**Inventário de Produtos** no Google Sheets. Cada toque grava direto na planilha.

```
┌──────────────────────────┐
│ Título              [☰]  │  nome do produto · menu com Pesquisa e Filtro
│ ┌──────────────────────┐ │
│ │        Foto          │ │  vem da pasta do Google Drive
│ └──────────────────────┘ │
│     [−]   320   [+]      │  quantidade contada (substitui o Estoque)
│ [       Validade       ] │  abre o calendário; fica vermelho se vencido
│  [⇦]     1 de 6     [⇨]  │  ordem da planilha; dá a volta no fim
│ Sem Etiqueta [−] [0] [+] │  quantidade sem etiqueta
└──────────────────────────┘
```

## Como funciona

- **Quantidade (− / +)**: é a quantidade **contada fisicamente** e substitui o valor da coluna *Estoque*.
  Também dá para tocar no número e digitar.
- **Sem Etiqueta (− / +)**: quantidade de unidades sem etiqueta. Também aceita digitar.
- **Validade**: uma data por produto. Ao tocar, abre o calendário. Fica vermelha se já venceu.
- **⇦ ⇨**: andam pelos produtos na **ordem da planilha**. Do último volta ao primeiro.
  Deslizar o dedo sobre a foto faz o mesmo.
- **☰ Menu**: **Pesquisa** por nome ou código. **Filtro** ainda será definido.
- **Salvamento**: a cada toque aparece *"Salvando…"* e depois *"✓ Salvo na planilha"*.
  Toques seguidos são agrupados e a planilha recebe sempre o valor final, sem risco de contar duas vezes.
  Se a internet falhar, a tela tenta de novo sozinha. Se mesmo assim não der, aparece um aviso
  vermelho; toque nele para tentar outra vez.
- A tela lembra em qual produto você parou, naquele aparelho.

## Estrutura da planilha (aba **Produtos**)

| SKU | Produto | Estoque | Sem Etiqueta | Validade | Foto | Atualizado em | Atualizado por |
|---|---|---|---|---|---|---|---|

- **SKU** e **Produto**: você preenche.
- **Estoque**, **Sem Etiqueta** e **Validade**: a tela grava. Você também pode editar na planilha.
- **Foto**: opcional. Veja abaixo.
- **Atualizado em** e **Atualizado por**: a tela preenche sozinha a cada alteração.

As colunas são encontradas pelo **nome do cabeçalho**: a ordem pode mudar e colunas extras são ignoradas.

## Fotos

O jeito mais fácil:

1. Crie uma pasta no Google Drive e coloque as fotos com o **SKU como nome do arquivo**:
   `PRD-001.jpg`, `PRD-002.png`…
2. Compartilhe a pasta como **"Qualquer pessoa com o link: Leitor"**. Sem isso a foto não aparece no celular.
3. Copie o ID da pasta (o trecho da URL depois de `/folders/`) e cole em `PASTA_FOTOS_ID`, no começo do `Code.gs`.

Para um produto específico, você também pode colar o link de uma imagem do Drive na coluna **Foto**.
Ele tem prioridade sobre a pasta.

A lista da pasta fica guardada por 10 minutos. Para ver fotos novas na hora, use o menu
**📦 Inventário → Recarregar lista de fotos**. Produto sem foto mostra 📦.

## Instalação (passo a passo)

1. Abra a planilha **Inventário de Produtos** → **Extensões → Apps Script**.
2. No editor:
   - Cole o conteúdo de [`Code.gs`](Code.gs) no arquivo `Código.gs`, substituindo tudo.
   - Crie um arquivo **HTML** chamado **`Dashboard`** (sem `.html`) e cole o conteúdo de [`Dashboard.html`](Dashboard.html).
   - Em **Configurações do projeto**, marque *"Mostrar arquivo de manifesto appsscript.json"* e cole o conteúdo de [`appsscript.json`](appsscript.json).
3. Salve, escolha a função **`instalarPlanilha`** e clique em **Executar**. Autorize o acesso quando pedir.
4. (Opcional) Execute **`inserirDadosExemplo`** para testar com 6 produtos fictícios. Depois apague essas linhas.
5. Recarregue a planilha: aparece o menu **📦 Inventário → Abrir tela de contagem**.

### Usar no celular

1. No editor do Apps Script: **Implantar → Nova implantação → Tipo: App da Web**.
2. **Executar como**: *Eu*. Quem conta não precisa ter acesso direto à planilha.
3. **Quem pode acessar**: *Somente eu* para começar, ou *Qualquer pessoa com Conta do Google* para liberar à equipe.
   Atenção: quem tiver o link poderá alterar as quantidades.
4. Abra a URL `/exec` no celular. Dica: use *"Adicionar à tela inicial"* para abrir como um app.

Ao mudar o código depois, use **Implantar → Gerenciar implantações → Editar → Nova versão**.

## Arquivos

| Arquivo | Função |
|---|---|
| `Code.gs` | Servidor: menu, criação da aba, leitura dos produtos, gravação a cada toque, fotos do Drive |
| `Dashboard.html` | A tela de contagem (HTML + CSS + JS, sem bibliotecas externas), com tema claro e escuro |
| `appsscript.json` | Manifesto: fuso `America/Sao_Paulo`, runtime V8 e permissões |
