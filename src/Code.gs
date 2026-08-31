/** Public demonstration. Use a dedicated sandbox and synthetic documents only. */
const DEMO_HEADERS = ['Registro', 'Nome ficticio', 'Documentos', 'Pasta', 'Status', 'Processado em'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Admissoes Demo')
    .addItem('Processar linha selecionada', 'processSelectedRow').addToUi();
}

function processSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  processRow_(sheet, sheet.getActiveRange().getRow());
}

/** Install a spreadsheet "On form submit" trigger, not a Forms trigger. */
function onFormSubmit(e) {
  if (!e || !e.range) throw new Error('EVENTO_INVALIDO');
  processRow_(e.range.getSheet(), e.range.getRow());
}

function config_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return {
    sheet: p.SHEET_NAME || 'Respostas Demo',
    root: p.ROOT_FOLDER_ID || 'COLE_ID_DA_PASTA_DE_TESTE',
    // Only an explicit false enables Drive mutations.
    dryRun: p.DRY_RUN !== 'false'
  };
}

function columns_(headers) {
  const columns = {};
  DEMO_HEADERS.forEach(name => {
    if (headers.filter(h => h === name).length !== 1) throw new DemoValidationError('CABECALHOS_INVALIDOS');
    columns[name] = headers.indexOf(name);
  });
  return columns;
}

function parseRecord_(values, columns) {
  const record = String(values[columns.Registro] || '').trim();
  const name = String(values[columns['Nome ficticio']] || '').trim();
  if (!/^DEMO-[0-9]{3,8}$/.test(record)) throw new Error('REGISTRO_INVALIDO');
  if (!/^Pessoa Ficticia [0-9]{3,8}$/.test(name)) throw new Error('NOME_NAO_DEMONSTRATIVO');
  const input = String(values[columns.Documentos] || '').trim();
  const ids = input ? input.split(/[,;\n]+/).map(value => {
    const url = value.trim();
    const match = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/view)?(?:\?usp=sharing)?$/)
      || url.match(/^https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)$/);
    if (!match) throw new Error('LINK_INVALIDO');
    return match[1];
  }) : [];
  if (ids.length > 20) throw new Error('LIMITE_DOCUMENTOS');
  return { record, name, ids: [...new Set(ids)] };
}

function uniqueFolder_(root, record) {
  const matches = root.getFoldersByName(record);
  if (!matches.hasNext()) return root.createFolder(record);
  const folder = matches.next();
  if (matches.hasNext()) throw new Error('PASTAS_DUPLICADAS');
  return folder;
}

function organize_(root, record) {
  // Validate every target before creating folders or shortcuts. Never copy file contents.
  record.ids.forEach(id => {
    const file = DriveApp.getFileById(id);
    if (file.isTrashed()) throw new Error('DOCUMENTO_NA_LIXEIRA');
  });
  const folder = uniqueFolder_(root, record.record);
  const existing = new Set();
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const target = file.getTargetId();
    if (target) existing.add(target);
  }
  record.ids.forEach(id => {
    if (!existing.has(id)) {
      folder.createShortcut(id);
      existing.add(id);
    }
  });
  return folder.getUrl();
}

function processRow_(sheet, row) {
  // Only errors constructed here may cross the public processing boundary.
  try {
    processRowWithLock_(sheet, row);
  } catch (error) {
    if (error instanceof DemoValidationError) throw error;
    throw new Error('PROCESSAMENTO_FALHOU: revise configuracao, dados e permissoes no ambiente de teste.');
  }
}

class DemoValidationError extends Error {}

function processRowWithLock_(sheet, row) {
  const cfg = config_();
  if (sheet.getName() !== cfg.sheet) throw new DemoValidationError('ABA_INVALIDA');
  if (!Number.isInteger(row) || row < 2 || row > sheet.getLastRow()) throw new DemoValidationError('LINHA_INVALIDA');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new DemoValidationError('OCUPADO_TENTE_NOVAMENTE');
  try {
    const columns = columns_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    try {
      const range = sheet.getRange(row, 1, 1, sheet.getLastColumn());
      // getValues() returns calculated results, so inspect formulas separately.
      if (range.getFormulas()[0][columns.Documentos]) throw new Error('FORMULA_NAO_PERMITIDA');
      const values = range.getValues()[0];
      const record = parseRecord_(values, columns);
      // One row per immutable record; reject duplicates before touching Drive.
      const records = sheet.getRange(2, columns.Registro + 1, sheet.getLastRow() - 1, 1).getValues();
      if (records.filter(r => String(r[0]).trim() === record.record).length !== 1) throw new Error('REGISTRO_DUPLICADO');
      if (cfg.dryRun) {
        sheet.getRange(row, columns.Status + 1).setValue('SIMULADO');
        return; // No Drive access, folder link or completion timestamp in simulation.
      }
      if (cfg.root.startsWith('COLE_')) throw new Error('CONFIGURACAO_PENDENTE');
      const root = DriveApp.getFolderById(cfg.root);
      if (root.isTrashed()) throw new Error('PASTA_RAIZ_INVALIDA');
      const url = organize_(root, record);
      sheet.getRange(row, columns.Pasta + 1).setValue(url);
      sheet.getRange(row, columns['Processado em'] + 1).setValue(new Date());
      sheet.getRange(row, columns.Status + 1).setValue('CONCLUIDO');
    } catch (error) {
      // Never persist exception text, URLs, names, IDs, or raw records in logs.
      try {
        sheet.getRange(row, columns.Status + 1).setValue('ERRO_REVISAR');
      } catch (statusError) {
        // Best effort only: a write failure must not expose service details.
      }
      throw new Error('PROCESSAMENTO_FALHOU: revise configuracao, dados e permissoes no ambiente de teste.');
    }
  } finally {
    // Includes simulation and error writes. Release even if persistence fails.
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
}
