# Modos do Gemini na Carteira Orbis

A Carteira Orbis diferencia duas formas de uso do Gemini:

## Modo gratuito

- a opção **Pesquisar na internet com Google Search** permanece desativada;
- o Gemini recebe cotações, retornos anuais e pregões recentes obtidos pela brapi;
- o relatório deve declarar que não pesquisou notícias, fatos relevantes ou documentos atuais;
- nenhuma fonte web é apresentada como consultada.

## Modo com pesquisa web

- a opção **Pesquisar na internet com Google Search** é ativada na aba Conta;
- o projeto Gemini precisa possuir faturamento e cota compatíveis com Google Search grounding;
- o relatório pode pesquisar fontes atuais e apresentar as fontes recuperadas.

## Erro de cota

O erro `429 RESOURCE_EXHAUSTED` não significa necessariamente que a chave seja inválida. As cotas são vinculadas ao projeto da chave. Quando o erro ocorrer na pesquisa web, o aplicativo apresenta uma mensagem em português orientando a desativar o grounding ou revisar o faturamento do projeto.
