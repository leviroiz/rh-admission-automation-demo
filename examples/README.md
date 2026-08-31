# Entradas e saídas sintéticas

O CSV contém somente entradas fictícias, sem documentos, pasta, status ou data.
Os resultados abaixo são expectativas, não registros de execução no Google.

## Simulação reproduzível

Importe `respostas-demo.csv` em uma planilha privada de teste. Com `DRY_RUN=true`,
processe a linha 2:

| Campo | Entrada | Saída esperada |
| --- | --- | --- |
| Registro | DEMO-001 | DEMO-001 |
| Nome ficticio | Pessoa Ficticia 001 | Pessoa Ficticia 001 |
| Documentos | vazio | vazio |
| Pasta | vazio | vazio |
| Status | vazio | SIMULADO |
| Processado em | vazio | vazio |

Não há acesso ao Drive. Repetir a simulação mantém o mesmo resultado.

## Organização e recuperação nos testes locais

Entrada: `DEMO-001`, `Pessoa Ficticia 001` e estes dois links sintéticos em
`Documentos`, separados por ponto e vírgula:

```text
https://drive.google.com/file/d/SYNTHETIC_A/view;https://drive.google.com/file/d/SYNTHETIC_B/view
```

Esses identificadores não representam arquivos acessíveis no Google. O teste
usa serviços simulados e uma pasta cuja URL é `https://example.invalid/demo-folder`.

| Tentativa | Saída esperada |
| --- | --- |
| Falha simulada no segundo atalho | Uma pasta DEMO-001, atalho SYNTHETIC_A, status ERRO_REVISAR se a gravação funcionar |
| Reexecução após a falha | Mesma pasta, atalhos SYNTHETIC_A e SYNTHETIC_B, URL fictícia, data da execução e CONCLUIDO |
| Nova reexecução | Mesma pasta e dois atalhos; data pode mudar |

Uma fórmula em `Documentos` é rejeitada mesmo que seu resultado seja um desses
links ou texto vazio. Cole somente URLs como texto, sem fórmulas.

Falhas preliminares ou de persistência podem manter o status anterior. Nenhum
status antigo comprova sucesso da tentativa atual. Para validar no Google, siga
o README principal com conta dedicada e arquivos fictícios; nunca publique os
IDs, links privados ou resultados reais do ambiente de teste.
