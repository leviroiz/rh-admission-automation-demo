const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/Code.gs'), 'utf8');
const iterator = values => { let i = 0; return { hasNext: () => i < values.length, next: () => values[i++] }; };

function sandbox({ dryRun = true, rows, failAt = 0, lockAvailable = true } = {}) {
  const headers = ['Registro', 'Nome ficticio', 'Documentos', 'Pasta', 'Status', 'Processado em'];
  const cells = [headers, ...(rows || [['DEMO-001', 'Pessoa Ficticia 001', '', '', '', '']])];
  const folders = [];
  let attempts = 0, driveCalls = 0, releases = 0;
  const root = {
    isTrashed: () => false,
    getFoldersByName: name => iterator(folders.filter(f => f.name === name)),
    createFolder(name) {
      const targets = [];
      const folder = { name, targets,
        getUrl: () => 'https://example.invalid/demo-folder',
        getFiles: () => iterator(targets.map(id => ({ getTargetId: () => id }))),
        createShortcut(id) {
          attempts++;
          if (attempts === failAt) throw new Error('synthetic failure');
          targets.push(id);
        }
      };
      folders.push(folder);
      return folder;
    }
  };
  const sheet = {
    getName: () => 'Respostas Demo', getLastRow: () => cells.length, getLastColumn: () => headers.length,
    getRange(r, c, n = 1, m = 1) {
      return { getValues: () => cells.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + m)),
        setValue: value => { cells[r - 1][c - 1] = value; } };
    }
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ DRY_RUN: String(dryRun), ROOT_FOLDER_ID: 'SYNTHETIC_ROOT' }) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock: () => releases++ }) },
    SpreadsheetApp: { flush() {} },
    DriveApp: {
      getFolderById: () => { driveCalls++; return root; },
      getFileById: id => { driveCalls++; if (id === 'INACCESSIBLE') throw new Error('private details'); return { isTrashed: () => false }; }
    }
  });
  vm.runInContext(source, context);
  return { context, sheet, cells, folders, root, run: () => context.processRow_(sheet, 2),
    stats: () => ({ driveCalls, releases }) };
}
const row = docs => ['DEMO-001', 'Pessoa Ficticia 001', docs, '', '', ''];
const link = id => `https://drive.google.com/file/d/${id}/view`;

test('simulation never accesses Drive or claims completion', () => {
  const s = sandbox(); s.run();
  assert.equal(s.cells[1][4], 'SIMULADO');
  assert.equal(s.cells[1][3], ''); assert.equal(s.cells[1][5], '');
  assert.equal(s.stats().driveCalls, 0); assert.equal(s.stats().releases, 1);
});
test('repeated processing deduplicates folders and target IDs', () => {
  const s = sandbox({ dryRun: false, rows: [row(`${link('SYNTHETIC_A')},${link('SYNTHETIC_A')}`)] });
  s.run(); const url = s.cells[1][3]; s.run();
  assert.equal(s.folders.length, 1); assert.deepEqual(s.folders[0].targets, ['SYNTHETIC_A']);
  assert.equal(s.cells[1][3], url); assert.equal(s.cells[1][4], 'CONCLUIDO');
});
test('partial failure resumes without recreating successful shortcut', () => {
  const s = sandbox({ dryRun: false, failAt: 2, rows: [row(`${link('SYNTHETIC_A')};${link('SYNTHETIC_B')}`)] });
  assert.throws(s.run, /PROCESSAMENTO_FALHOU/); assert.equal(s.cells[1][4], 'ERRO_REVISAR');
  s.run(); assert.equal(s.folders.length, 1);
  assert.deepEqual(s.folders[0].targets, ['SYNTHETIC_A', 'SYNTHETIC_B']);
  assert.equal(s.stats().releases, 2);
});
test('duplicate record fails before touching Drive', () => {
  const s = sandbox({ dryRun: false, rows: [row(''), row('')] });
  assert.throws(s.run); assert.equal(s.stats().driveCalls, 0);
});
test('external URLs and formulas are rejected before touching Drive', () => {
  for (const input of ['https://example.invalid/document', '=HYPERLINK("x")', 'https://drive.google.com.evil.invalid/file/d/X/view']) {
    const s = sandbox({ dryRun: false, rows: [row(input)] });
    assert.throws(s.run); assert.equal(s.stats().driveCalls, 0);
  }
});
test('inaccessible document produces sanitized error without a folder', () => {
  const s = sandbox({ dryRun: false, rows: [row(link('INACCESSIBLE'))] });
  assert.throws(s.run, /PROCESSAMENTO_FALHOU/); assert.equal(s.folders.length, 0);
  assert.equal(s.cells[1][4], 'ERRO_REVISAR');
});
test('ambiguous folders are not chosen arbitrarily', () => {
  const s = sandbox({ dryRun: false });
  s.root.createFolder('DEMO-001'); s.root.createFolder('DEMO-001');
  assert.throws(s.run); assert.equal(s.folders.length, 2);
});
test('missing headers and wrong row fail safely and release acquired lock', () => {
  const s = sandbox(); s.cells[0][0] = 'Wrong header';
  assert.throws(s.run, /CABECALHOS_INVALIDOS/); assert.equal(s.stats().releases, 1);
  assert.throws(() => s.context.processRow_(s.sheet, 1), /LINHA_INVALIDA/);
});
test('lock contention causes no mutation', () => {
  const s = sandbox({ dryRun: false, lockAvailable: false });
  assert.throws(s.run, /OCUPADO/); assert.equal(s.stats().driveCalls, 0); assert.equal(s.cells[1][4], '');
});
test('spreadsheet form event processes its supplied row', () => {
  const s = sandbox();
  s.context.onFormSubmit({ range: { getSheet: () => s.sheet, getRow: () => 2 } });
  assert.equal(s.cells[1][4], 'SIMULADO');
  assert.throws(() => s.context.onFormSubmit(), /EVENTO_INVALIDO/);
});
