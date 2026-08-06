# Carteira Orbis — regras de evolução

1. Preserve a separação entre interface, cálculos de carteira, fontes de mercado e provedores de IA.
2. Nenhuma alteração visual deve modificar `lib/portfolio.ts` ou os contratos de API sem testes de regressão.
3. Nunca grave chaves de API no repositório, logs ou banco de dados.
4. Novos provedores devem implementar a mesma saída `AiReport`.
5. Toda análise financeira deve distinguir fato, cálculo, interpretação e ponto de atenção.
6. Não implemente execução de ordens ou recomendação personalizada sem revisão regulatória.
7. Mantenha dados manuais como fonte primária da carteira; integrações externas são opcionais.
