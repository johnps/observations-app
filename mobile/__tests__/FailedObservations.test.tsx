import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FailedObservations from '../screens/FailedObservations';

const mockClearFailed = jest.fn();
const mockRequeueFailed = jest.fn();
const mockGetFailedObservations = jest.fn();

jest.mock('../lib/db', () => ({
  getFailedObservations: () => mockGetFailedObservations(),
  clearFailed: (id: string) => mockClearFailed(id),
  requeueFailed: (id: string) => mockRequeueFailed(id),
}));

const FAILED_OBS = {
  id: 'fail-abc',
  payload: JSON.stringify({
    id: 'fail-abc',
    text: 'Observed kitchen garden setup at Rampur',
    field_worker_name: 'Ravi Kumar',
    village_name: 'Rampur',
    block_lead_email: 'lead@example.com',
    photo_uris: [],
    submitted_at: '2026-05-01T09:30:00.000Z',
  }),
  reason: 'max retries exceeded',
  failed_at: '2026-05-01T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFailedObservations.mockReturnValue([FAILED_OBS]);
});

test('shows failed observation text, worker, village, and reason', async () => {
  const { getByText, getAllByText } = render(<FailedObservations blockLeadEmail="lead@example.com" />);
  await waitFor(() => {
    expect(getByText('Observed kitchen garden setup at Rampur')).toBeTruthy();
    expect(getByText(/Ravi Kumar/)).toBeTruthy();
    expect(getAllByText(/Rampur/).length).toBeGreaterThan(0);
    expect(getByText('max retries exceeded')).toBeTruthy();
  });
});

test('shows empty state when there are no failed observations', async () => {
  mockGetFailedObservations.mockReturnValue([]);
  const { getByText } = render(<FailedObservations blockLeadEmail="lead@example.com" />);
  await waitFor(() => expect(getByText(/no failed observations/i)).toBeTruthy());
});

test('dismiss button calls clearFailed and removes item from list', async () => {
  const { getByText, queryByText } = render(<FailedObservations blockLeadEmail="lead@example.com" />);
  await waitFor(() => getByText('Dismiss'));
  fireEvent.press(getByText('Dismiss'));
  expect(mockClearFailed).toHaveBeenCalledWith('fail-abc');
  await waitFor(() =>
    expect(queryByText('Observed kitchen garden setup at Rampur')).toBeNull()
  );
});

test('re-queue button calls requeueFailed and removes item from list', async () => {
  const { getByText, queryByText } = render(<FailedObservations blockLeadEmail="lead@example.com" />);
  await waitFor(() => getByText('Re-queue'));
  fireEvent.press(getByText('Re-queue'));
  expect(mockRequeueFailed).toHaveBeenCalledWith('fail-abc');
  await waitFor(() =>
    expect(queryByText('Observed kitchen garden setup at Rampur')).toBeNull()
  );
});
