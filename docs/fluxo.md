# Fluxo e recuperação

1. O Forms registra uma resposta na planilha. O CSV permite demonstrar o mesmo fluxo sem formulário.
2. O gatilho fornece a linha; a execução manual usa a seleção atual.
3. O script verifica aba e limites, obtém um bloqueio e valida cabeçalhos únicos.
4. Rejeita fórmulas em `Documentos` usando `getFormulas()`, independentemente do resultado calculado. Lê o registro, exige nome fictício e chave `DEMO-` numérica, interpreta URLs em texto simples e rejeita registros duplicados.
5. Em simulação, registra `SIMULADO` e termina sem consultar Drive.
6. Na execução real, verifica acesso aos documentos e procura a pasta diretamente dentro da raiz de teste.
7. Cria a pasta somente se ausente. Se houver mais de uma correspondência, interrompe.
8. Examina IDs de destino dos atalhos existentes e cria somente os ausentes.
9. Escreve URL da pasta, data e `CONCLUIDO`. Após adquirir o bloqueio, tenta `flush()` antes de `releaseLock()` em todos os caminhos, inclusive simulação e erro; tenta liberar mesmo se o flush falhar.

```mermaid
flowchart TD
  L[Ler linha] --> V{Dados válidos?}
  V -- Não --> E[Tentar ERRO_REVISAR: cabeçalhos já validados]
  V -- Sim --> S{Simulação?}
  S -- Sim --> X[SIMULADO: sem acesso ao Drive]
  S -- Não --> P[Validar acesso aos documentos]
  P --> F[Localizar ou criar pasta pelo registro]
  F --> A[Reaproveitar ou criar atalhos]
  A --> C[Registrar pasta, data e CONCLUIDO]
  P -- Falha --> E
  F -- Falha --> E
  A -- Falha --> E
```

## Garantias e limites

Falhas preliminares (aba, linha, lock ou cabeçalhos) não escrevem status. Nunca se escolhe uma coluna por suposição. Após validar os cabeçalhos, erros de processamento tentam escrever `ERRO_REVISAR`; se essa escrita falhar, a exceção final permanece controlada, sem texto original nem causa sensível. Falhas de serviços na confirmação/liberação também são sanitizadas. Se `flush()` falhar, a persistência é incerta e não se promete status de erro.

Status, pasta e data anteriores podem permanecer: mesmo `CONCLUIDO` não prova sucesso da tentativa atual. Verifique o resultado da execução antes de interpretar a célula. Os testes locais simulam serviços; não validam persistência, permissões ou gatilhos reais do Google.

Idempotência é baseada em registro estável, pasta preservada e atalhos com IDs de destino. Reexecutar com os mesmos dados não deve criar novas pastas nem atalhos. O horário representa a última execução bem-sucedida, portanto pode mudar. Não se ignora uma linha apenas pelo status: isso permite recuperar falhas parciais.

Uma falha após criar um atalho não desfaz a criação. A próxima execução consulta os atalhos novamente. Não há rollback nem garantia de exatamente uma execução em presença de outros projetos ou mudanças manuais. O bloqueio só serializa execuções deste projeto.

## Roteiro de aceitação no Google

**Validação real pendente.** A tabela abaixo resume expectativas; siga o [roteiro detalhado de validação](validacao-google.md) para preparação, execução segura e registro de evidências.

| Cenário | Resultado esperado |
| --- | --- |
| CSV sem documentos, simulação | SIMULADO; sem pasta e sem data nova |
| Execução real com arquivo sintético | Pasta pelo registro e um atalho |
| Mesma linha executada duas vezes | Mesma URL, mesma quantidade de pastas/atalhos |
| Dois links para o mesmo arquivo | Um único atalho |
| Acrescentar outro arquivo | Apenas um novo atalho |
| Registro duplicado ou URL externa | ERRO_REVISAR, sem novos itens no Drive |
| Fórmula em Documentos, mesmo retornando URL válida | Tentativa de ERRO_REVISAR; nenhum acesso ao Drive |
| Aba/linha/lock/cabeçalhos inválidos | Erro controlado; status anterior inalterado |
| Falha ao gravar ERRO_REVISAR ou confirmar alterações | Erro sanitizado; status pode continuar anterior |
| Arquivo inacessível | ERRO_REVISAR; verifique permissões na conta de teste |
| Duas pastas com mesmo registro | ERRO_REVISAR; resolver ambiguidade manualmente |
| Gatilho Forms pela planilha | Processa a linha recebida, não a última linha arbitrária |

Não execute testes com documentos reais. Verifique manualmente o compartilhamento da raiz e da planilha antes de ativar a escrita no Drive. Use uma planilha separada, conta dedicada e arquivos cujo conteúdo seja explicitamente fictício.

Os status de erro na tabela pressupõem que a gravação e a confirmação funcionem.
