# Carteira Orbis

Aplicação web para acompanhamento manual de investimentos com inteligência de ativos, radar de mercado e copiloto de carteira.

## O que já está implementado

- carteira baseada em lançamentos manuais de compras, vendas e proventos;
- consolidação de quantidade, preço médio, custo, patrimônio e resultado;
- gráfico de evolução patrimonial e aportes;
- atualização opcional de cotações e histórico da B3 via brapi.dev;
- dossiê vivo de qualquer ativo com pesquisa na internet;
- comparação histórica configurável;
- lista de observação e alertas locais por preço ou variação;
- copiloto contextual da carteira;
- escolha entre GPT/OpenAI e Gemini/Google;
- chaves mantidas somente no navegador e enviadas apenas na requisição;
- exportação e importação de backup em JSON;
- layout responsivo e instalável como PWA.

## Arquitetura

- **Next.js 16 / React 19 / TypeScript**;
- dados pessoais e carteira em `localStorage`;
- chaves em `sessionStorage` por padrão, com persistência local opcional;
- Route Handlers para impedir exposição direta das chaves e do token de mercado;
- OpenAI Responses API com `web_search`;
- Gemini API com Google Search grounding;
- brapi.dev para cotações e séries históricas.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Testes de qualidade

```bash
npm run typecheck
npm run lint
npm run build
```

## Configuração

A forma recomendada é abrir a aba **Conta** e informar:

- chave da OpenAI ou Gemini;
- modelo desejado;
- token opcional da brapi.dev para cotações e histórico completos.

Também é possível definir as variáveis descritas em `.env.example` em uma implantação privada.

## Segurança e limites

- o aplicativo não integra corretoras nem executa ordens;
- as movimentações são registradas manualmente;
- as chaves não são persistidas no servidor;
- o produto organiza informações e pontos de atenção, sem emitir ordem de compra ou venda;
- para produção pública, adicione autenticação, criptografia de dados por usuário, rate limiting, observabilidade e revisão regulatória especializada.
