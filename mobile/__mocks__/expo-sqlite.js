let _store = {};
let _hierarchyCache = [];
let _failedStore = {};

const _db = {
  execSync: jest.fn(),
  withTransactionSync: jest.fn((cb) => cb()),
  runSync: jest.fn((sql, params) => {
    const s = sql.toUpperCase();
    if (s.includes('INSERT OR REPLACE INTO FAILED_OBSERVATIONS')) {
      _failedStore[params[0]] = { id: params[0], payload: params[1], reason: params[2], failed_at: params[3] };
    } else if (s.includes('DELETE FROM FAILED_OBSERVATIONS')) {
      delete _failedStore[params[0]];
    } else if (s.includes('INSERT OR REPLACE')) {
      _store[params[0]] = { id: params[0], payload: params[1], synced: 0, retry_count: 0 };
    } else if (s.includes('UPDATE') && s.includes('SYNCED = 1')) {
      if (_store[params[0]]) _store[params[0]].synced = 1;
    } else if (s.includes('UPDATE') && s.includes('RETRY_COUNT')) {
      if (_store[params[0]]) _store[params[0]].retry_count = (_store[params[0]].retry_count ?? 0) + 1;
    } else if (s.includes('DELETE FROM HIERARCHY_CACHE')) {
      _hierarchyCache = _hierarchyCache.filter(r => r.block_lead_email !== params[0]);
    } else if (s.includes('INSERT INTO HIERARCHY_CACHE')) {
      _hierarchyCache.push({ block_lead_email: params[0], field_worker_name: params[1], village_name: params[2] });
    }
  }),
  getAllSync: jest.fn((sql, params) => {
    const s = sql.toUpperCase();
    if (s.includes('FROM HIERARCHY_CACHE') && s.includes('DISTINCT FIELD_WORKER')) {
      const names = [...new Set(
        _hierarchyCache.filter(r => r.block_lead_email === params[0]).map(r => r.field_worker_name)
      )].sort();
      return names.map(n => ({ field_worker_name: n }));
    }
    if (s.includes('FROM HIERARCHY_CACHE') && s.includes('VILLAGE_NAME')) {
      return _hierarchyCache
        .filter(r => r.block_lead_email === params[0] && r.field_worker_name === params[1])
        .map(r => ({ village_name: r.village_name }));
    }
    if (s.includes('SELECT RETRY_COUNT')) {
      const row = _store[params[0]];
      return row ? [{ retry_count: row.retry_count ?? 0 }] : [];
    }
    if (s.includes('FROM FAILED_OBSERVATIONS')) {
      return Object.values(_failedStore);
    }
    return Object.values(_store).filter(r => r.synced === 0 && (r.retry_count ?? 0) < 5);
  }),
};

const openDatabaseSync = jest.fn(() => _db);

module.exports = {
  openDatabaseSync,
  _db,
  _reset() {
    _store = {};
    _hierarchyCache = [];
    _failedStore = {};
    openDatabaseSync.mockClear();
    _db.execSync.mockClear();
    _db.withTransactionSync.mockClear();
    _db.runSync.mockClear();
    _db.getAllSync.mockClear();
    // Restore withTransactionSync default implementation after mockClear
    _db.withTransactionSync.mockImplementation((cb) => cb());
  },
};
