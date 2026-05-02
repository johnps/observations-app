let _store = {};

const _db = {
  execSync: jest.fn(),
  runSync: jest.fn((sql, params) => {
    const s = sql.toUpperCase();
    if (s.includes('INSERT OR REPLACE')) {
      _store[params[0]] = { id: params[0], payload: params[1], synced: 0 };
    } else if (s.includes('UPDATE') && s.includes('SYNCED = 1')) {
      if (_store[params[0]]) _store[params[0]].synced = 1;
    }
  }),
  getAllSync: jest.fn(() => Object.values(_store).filter(r => r.synced === 0)),
};

const openDatabaseSync = jest.fn(() => _db);

module.exports = {
  openDatabaseSync,
  _reset() {
    _store = {};
    openDatabaseSync.mockClear();
    _db.execSync.mockClear();
    _db.runSync.mockClear();
    _db.getAllSync.mockClear();
  },
};
