import { renderHook } from '@testing-library/react-native';
import { useHierarchy } from '../lib/useHierarchy';

jest.mock('../lib/db', () => ({
  getCachedFieldWorkers: jest.fn(),
  getCachedVillages: jest.fn(),
}));

const { getCachedFieldWorkers, getCachedVillages } = require('../lib/db');

beforeEach(() => {
  jest.clearAllMocks();
  getCachedFieldWorkers.mockReturnValue([]);
  getCachedVillages.mockReturnValue([]);
});

test('returns field workers from cache for the given block lead', () => {
  getCachedFieldWorkers.mockReturnValue(['Ravi Kumar', 'Sunita Devi']);

  const { result } = renderHook(() => useHierarchy('lead@example.com', ''));

  expect(result.current.fieldWorkers).toEqual(['Ravi Kumar', 'Sunita Devi']);
  expect(getCachedFieldWorkers).toHaveBeenCalledWith('lead@example.com');
});

test('returns villages for the selected field worker', () => {
  getCachedVillages.mockReturnValue(['Rampur', 'Sitapur']);

  const { result } = renderHook(() => useHierarchy('lead@example.com', 'Ravi Kumar'));

  expect(result.current.villages).toEqual(['Rampur', 'Sitapur']);
  expect(getCachedVillages).toHaveBeenCalledWith('lead@example.com', 'Ravi Kumar');
});

test('returns empty villages when no worker is selected', () => {
  const { result } = renderHook(() => useHierarchy('lead@example.com', ''));

  expect(result.current.villages).toEqual([]);
  expect(getCachedVillages).not.toHaveBeenCalled();
});
