# Validação real no Google — roteiro de teste

**Estado: PENDENTE / NÃO EXECUTADO.** Este documento descreve expectativas, não resultados. Os 16 testes locais usam serviços simulados; não comprovam permissões, persistência ou gatilhos reais. Nenhum cenário abaixo foi executado como parte da preparação deste roteiro.

## 1. Preparação e regras de segurança

1. Reserve uma conta Google dedicada a testes, sem documentos reais. Use Meu Drive, não Shared Drives. Não utilize conta, pasta ou planilha de produção.
2. Registre privadamente a data, o fuso horário e o commit completo que será testado (`git rev-parse HEAD`). Copie o código dessa versão; não misture versões durante a avaliação.
3. Crie uma planilha nova e privada. Importe [respostas-demo.csv](../examples/respostas-demo.csv), com seis colunas, e nomeie a aba `Respostas Demo`. Confira a linha 1: `Registro`, `Nome ficticio`, `Documentos`, `Pasta`, `Status`, `Processado em`, cada cabeçalho uma única vez.
4. Em **Extensões → Apps Script**, copie integralmente [src/Code.gs](../src/Code.gs) para `Code.gs` e salve. Não implante aplicativo web. Não instale gatilho ainda.
5. Nas configurações do projeto, cadastre as propriedades abaixo. Os valores reais devem permanecer apenas no ambiente privado, nunca no Git ou em evidências públicas.

| Propriedade | Valor inicial |
| --- | --- |
| `SHEET_NAME` | `Respostas Demo` |
| `ROOT_FOLDER_ID` | `COLE_ID_DA_PASTA_DE_TESTE` |
| `DRY_RUN` | `true` |

6. Reabra a planilha. Selecione uma célula da linha a testar e use **Admissoes Demo → Processar linha selecionada**. Autorize somente na conta dedicada após conferir os escopos. O escopo Drive pode ser solicitado mesmo em simulação: autorização não significa que houve acesso ao Drive nesse caminho. Se houver bloqueio administrativo, registre o impedimento; não contorne a política.
7. Antes da execução real, crie uma raiz exclusiva e privada `RH Demo - Validacao`, inicialmente vazia. Fora dela, crie dois arquivos de texto sintéticos, A e B, contendo apenas `ARQUIVO FICTICIO PARA TESTE`. Mantenha os originais fora da raiz para distinguir arquivos e atalhos. Confira compartilhamento restrito, propriedade e acesso da conta executora.
8. Guarde os links de A/B apenas na planilha de teste. Use `https://drive.google.com/file/d/COLE_ID_DO_ARQUIVO_DE_TESTE/view` ou `https://drive.google.com/open?id=COLE_ID_DO_ARQUIVO_DE_TESTE`, substituindo o placeholder somente ali. Links de edição de Google Docs não são aceitos pelo parser. Não torne arquivos públicos para obter links.

Durante cada execução, não edite registros, ordene linhas, renomeie pastas ou execute outro projeto. Aguarde a tentativa terminar antes de conferir o resultado. Para repetir toda a bateria, use um ambiente novo; não reutilize registros com pastas de uma bateria anterior.

## 2. Como avaliar cada tentativa

Confira **Execuções** no Apps Script, a linha afetada na planilha e as quantidades de pastas/atalhos no Drive. Compare a identidade da pasta e dos destinos privadamente, sem copiar IDs para o relatório público. Confirme também que os originais permanecem no mesmo local, com conteúdo e compartilhamento inalterados.

Após cabeçalhos válidos, falhas de processamento tentam escrever `ERRO_REVISAR` e expõem a mensagem genérica `PROCESSAMENTO_FALHOU: revise configuracao, dados e permissoes no ambiente de teste.`. Não espere a causa interna, como `REGISTRO_DUPLICADO`, na interface. Erros preliminares podem expor códigos controlados como `CABECALHOS_INVALIDOS`, sem atualizar o status.

**Status antigo não comprova sucesso atual.** Erros não limpam pasta/data anteriores; simulação não limpa esses campos. Uma falha de escrita ou de `flush()` pode preservar até `CONCLUIDO`. Os resultados de status abaixo pressupõem que a escrita e a confirmação funcionem. Não provoque indisponibilidade ou esgotamento de quotas para testar flush/lock; esses caminhos têm cobertura local simulada, não validação real neste roteiro.

## 3. Execução manual, simulação e idempotência

Execute em ordem e registre uma evidência por tentativa.

| Caso | Ação | Resultado esperado |
| --- | --- | --- |
| V01 — simulação | Com raiz ainda placeholder e `DRY_RUN=true`, processe a linha `DEMO-001` sem documentos, duas vezes. | `SIMULADO`; `Pasta` e `Processado em` continuam vazios; nenhum acesso ao Drive pelo código. A inspeção visual de itens não prova ausência de chamadas de leitura. |
| V02 — criação | Configure o ID privado da raiz; coloque os links A e B em `Documentos` de `DEMO-001`, separados por `;`. Defina `DRY_RUN=false` e processe. | Uma pasta `DEMO-001` diretamente na raiz, dois atalhos para A/B, URL da pasta, data e `CONCLUIDO`. |
| V03 — reexecução | Processe a mesma linha sem alterar nada. | Mesma pasta e mesmos dois atalhos; nenhuma duplicação. A data pode mudar. |
| V04 — destinos repetidos e acréscimo | Em `DEMO-002`, use A duas vezes (separadas por `;`) e processe. Depois acrescente B e processe novamente. | Primeiro, uma pasta e um atalho A; depois, a mesma pasta com dois atalhos A/B. |
| V05 — simulação após sucesso | Retorne `DRY_RUN=true` e processe `DEMO-001`. | Apenas status muda para `SIMULADO`; link e data antigos permanecem. Nenhum item novo. |

Somente a string exata `false` habilita mutações no Drive. Ao iniciar os próximos casos, confira explicitamente a configuração indicada.

## 4. Rejeições e recuperação de dados

Use `DRY_RUN=false`, salvo indicação contrária. Para novas linhas, preencha `Nome ficticio` como `Pessoa Ficticia 010` para `DEMO-010`, e assim por diante. Deixe as saídas inicialmente vazias. Registre contagens antes/depois e restaure a alteração após cada caso.

| Caso | Preparação e ação | Resultado esperado e restauração |
| --- | --- | --- |
| V06 — fórmula com URL | Adicione `DEMO-010`. Em `Documentos`, digite uma fórmula `="URL_PRIVADA_DE_A"`, substituindo o texto entre aspas pela URL aceita de A somente na planilha. Confirme que a célula calcula a URL e processe. | `ERRO_REVISAR`, erro genérico e nenhuma pasta para esse registro. Substitua por URL em texto simples, processe e confirme sucesso. |
| V07 — fórmula vazia | Em `DEMO-011`, use `=""` em `Documentos` e processe. | Mesmo erro, ainda que a célula pareça vazia. Apague a fórmula, processe e confirme uma pasta sem atalhos. |
| V08 — registro duplicado | Crie duas linhas `DEMO-012` / `Pessoa Ficticia 012`, com A. Processe cada uma separadamente. | Ambas rejeitadas, sem pasta `DEMO-012`. Remova apenas a linha duplicada de teste; reexecute a restante e confirme sucesso. |
| V09 — cabeçalho ausente | Anote o status de uma linha já processada. Renomeie temporariamente `Status` para `Status teste`; processe essa linha. | `CABECALHOS_INVALIDOS`; nenhuma escrita de status nem novos itens. Restaure exatamente `Status`. |
| V10 — cabeçalho ambíguo | Acrescente temporariamente outra coluna com cabeçalho `Status` e processe a linha anterior. | `CABECALHOS_INVALIDOS`; valores anteriores preservados. Remova só o cabeçalho extra, depois reexecute para confirmar recuperação. |
| V11 — aba/linha | Selecione o cabeçalho e processe; depois crie/abra uma aba temporária de outro nome e tente processar. | Respectivamente `LINHA_INVALIDA` e `ABA_INVALIDA`; sem escrita. Volte à aba configurada e selecione uma linha de dados. |
| V12 — URL não suportada | Em `DEMO-013`, use `https://example.invalid/documento`, processe. | Erro genérico e `ERRO_REVISAR`, sem pasta. Troque pelo link A e reexecute com sucesso. |
| V13 — pastas ambíguas | Antes de processar `DEMO-014` com A, crie manualmente duas pastas vazias `DEMO-014` diretamente na raiz. | Erro e nenhuma escolha arbitrária ou atalho criado. Renomeie uma delas para `Reserva teste 014`, sem tocar na outra; reexecute e confirme reuso da única pasta correspondente. |

## 5. Falha parcial e retomada controlada

**Este caso altera temporariamente apenas a cópia de `Code.gs` no projeto Google de teste. Não altere o código versionado.** Ainda sem gatilho instalado, use um registro novo `DEMO-020` / `Pessoa Ficticia 020`, links A e B nessa ordem e `DRY_RUN=false`. Confirme que não existe pasta para esse registro.

1. Guarde a versão original do código localmente. Na função `organize_`, localize o bloco que cria cada atalho. Acrescente uma única linha depois de `existing.add(id)`, dentro do `if`, como abaixo:

   ```javascript
   folder.createShortcut(id);
   existing.add(id);
   if (record.record === 'DEMO-020') throw new Error('FALHA_CONTROLADA_DE_TESTE');
   ```

2. Salve e processe somente `DEMO-020`. A interrupção deve ocorrer depois do primeiro atalho. Espere erro público genérico, tentativa de `ERRO_REVISAR`, uma pasta e apenas o atalho A. Os campos de pasta/data dessa linha nova devem continuar vazios, pois o retorno de `organize_` foi interrompido. Confira o Drive mesmo que não exista link na planilha.
3. Registre a tentativa como **falha injetada**, não falha espontânea do Google. Se não observar o estado parcial, registre divergência e investigue; não declare o cenário aprovado.
4. Restaure integralmente `Code.gs` a partir da versão do repositório, salve e confira que `FALHA_CONTROLADA_DE_TESTE` não existe mais. Faça essa restauração mesmo se o cenário falhar; não continue para gatilhos enquanto houver instrumentação.
5. Reexecute a mesma linha sem alterar registro, documentos ou pasta. Espere reuso da pasta e do atalho A, criação apenas de B, preenchimento de pasta/data e `CONCLUIDO`.
6. Reexecute uma terceira vez: mesma pasta, dois atalhos, sem duplicação.

Não use um link inacessível para simular essa falha parcial: o código valida **todos** os destinos antes de criar pasta/atalhos. Esse teste determinístico demonstra retomada de efeitos reais no Drive após uma interrupção injetada; não comprova todos os tipos de falha de serviço ou persistência.

## 6. Permissões sem alterar compartilhamentos existentes

Use uma segunda conta exclusivamente de teste para criar um arquivo C e uma pasta raiz C privados, nunca compartilhados com a conta executora. Transfira seus identificadores somente para a configuração privada de teste. Não publique links, não conceda acesso e não revogue permissões de arquivos existentes. Se não houver segunda conta de teste, marque V14/V15 como **não executados**; ID inventado testa inexistência, não falta de permissão.

- **V14 — destino inacessível:** na primeira conta, com sua raiz acessível, crie `DEMO-030` / `Pessoa Ficticia 030` contendo A e C. Processe com `DRY_RUN=false`. Espere erro genérico, `ERRO_REVISAR` e nenhuma pasta desse registro, pois todos os destinos são verificados antes das criações. Troque C por B e reexecute: uma pasta, dois atalhos e sucesso.
- **V15 — raiz inacessível:** anote privadamente a configuração da raiz acessível. Configure temporariamente a raiz C e processe `DEMO-031` / `Pessoa Ficticia 031` com A. Espere erro genérico, `ERRO_REVISAR` e nenhum item novo. Restaure imediatamente a raiz original e reexecute com sucesso.
- Confira que as mensagens devolvidas pelo script não incluem IDs, URLs, conteúdo ou detalhes brutos de serviços. Não exporte logs completos. Verifique que os atalhos criados nos casos positivos não alteraram o compartilhamento dos originais. Não conclua acesso por terceiros apenas pela presença do atalho.

## 7. Google Forms e gatilho da planilha

1. Confirme que o código original foi restaurado e defina `DRY_RUN=true`.
2. Crie um formulário de teste com `Registro` e `Nome ficticio` como respostas curtas obrigatórias, e `Documentos` como parágrafo opcional de URLs em texto. Não habilite coleta de e-mails nem use upload nesta bateria. Restrinja o acesso à conta de teste conforme os controles disponíveis; se isso exigir divulgação pública, registre bloqueio e pare este caso.
3. Vincule o formulário à mesma planilha. Ele cria sua própria aba de respostas: confira o nome e atualize `SHEET_NAME`. Não presuma que usará `Respostas Demo`. Adicione à direita `Pasta`, `Status`, `Processado em`; confira todos os seis cabeçalhos únicos. A coluna de horário do Forms pode permanecer.
4. No Apps Script vinculado à **planilha**, adicione um único gatilho instalável: função `onFormSubmit`, origem **Da planilha**, evento **Ao enviar formulário**. Use a conta dedicada que tem acesso à raiz e aos arquivos. O gatilho roda como seu criador, conforme a [documentação oficial](https://developers.google.com/apps-script/guides/triggers/installable).
5. **V16 — envio simulado:** envie pelo formulário `DEMO-040` / `Pessoa Ficticia 040`, com A. Aguarde a execução terminar; confirme `SIMULADO` na linha recebida, sem pasta nem data nova.
6. **V17 — envio real:** defina `DRY_RUN=false` e envie pelo formulário `DEMO-041` / `Pessoa Ficticia 041`, com A e B. Espere pasta, dois atalhos, data e `CONCLUIDO` somente na linha dessa resposta. Confira que a linha `DEMO-040` permaneceu simulada.
7. **V18 — reexecução manual da resposta:** selecione a linha `DEMO-041` na aba configurada e processe pelo menu. Espere mesma pasta e dois atalhos. Não envie o mesmo registro novamente para testar idempotência: isso criaria uma linha duplicada que deve ser rejeitada.

O evento da planilha fornece `e.range`, usado pelo código; veja os [objetos de evento oficiais](https://developers.google.com/apps-script/guides/triggers/events). Clicar em Executar no editor para `onFormSubmit` não fornece esse evento e deve resultar em `EVENTO_INVALIDO`. Digitar uma linha na planilha também não substitui o envio pelo formulário. Upload nativo do Forms permanece fora desta bateria e exige validação separada.

## 8. Evidências, conclusão e encerramento

Mantenha notas privadas separadas do repositório. Para cada caso e tentativa, registre data/fuso, commit, modo (`true`/`false`), resultado da execução, estado da linha, contagens antes/depois, identidade preservada (sim/não), resultado observado e divergência. Use aliases `RAIZ_TESTE`, `ARQUIVO_A`, `ARQUIVO_B`; nunca IDs, e-mails, links privados ou URLs de execução.

Modelo para preencher **somente depois de executar**, uma linha por tentativa:

| Caso / tentativa | Data e fuso | Commit | DRY_RUN | Esperado | Observado | Evidência sanitizada | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A preencher | — | — | — | — | Não executado | Nenhuma | Pendente |

Para imagens públicas, prefira um recorte da linha sem `Documentos`/`Pasta`, acompanhado de contagens e texto sanitizado. Remova de forma irreversível barra de endereço, avatar, e-mail, IDs e URLs; revise também nomes de arquivos e metadados. Não publique exportações de planilha, propriedades do script ou logs brutos. Não coloque links privados nem mesmo por trás de rótulos Markdown. Capturas são opcionais: um relato sanitizado preciso é melhor que uma imagem arriscada.

Critério de aprovação: todos os V01–V18 executados, resultados observados compatíveis, originais preservados, ausência de duplicação nas reexecuções e erros sanitizados. Se faltar conta, permissão ou evidência, registre **não executado**, **bloqueado** ou **reprovado**, sem transformar expectativa em resultado. Mesmo com aprovação, descreva apenas o ambiente e os cenários testados; não alegue prontidão para produção, desempenho, proteção de dados completa ou validação de falhas não exercitadas.

Ao encerrar, volte `DRY_RUN=true`, remova o gatilho de teste, encerre o recebimento de respostas e confirme a restauração do código original. Mantenha os artefatos privados; não exclua dados nem altere permissões de outros ambientes. A remoção posterior dos artefatos de teste é uma decisão manual do operador.

Somente após revisar as evidências, atualize este documento com resultados efetivamente observados e ajuste a indicação de pendência do README conforme a cobertura alcançada. Não substitua este roteiro por uma declaração genérica de sucesso. Publicação no GitHub exige uma etapa posterior e autorização para push.
