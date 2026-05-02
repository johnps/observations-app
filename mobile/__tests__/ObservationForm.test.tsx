import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ObservationForm from '../screens/ObservationForm';
import { queueObservation } from '../lib/db';
import { syncPending } from '../lib/sync';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

jest.mock('../lib/db', () => ({ queueObservation: jest.fn() }));
jest.mock('../lib/sync', () => ({ syncPending: jest.fn().mockResolvedValue(undefined) }));

const WORKERS = [{ field_worker_name: 'Worker One' }, { field_worker_name: 'Worker Two' }];
const VILLAGES = [{ village_name: 'Village A' }, { village_name: 'Village B' }];

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  (queueObservation as jest.Mock).mockClear();
  (syncPending as jest.Mock).mockResolvedValue(undefined);
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
    if (url.includes('field-workers')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ field_workers: WORKERS }) });
    }
    if (url.includes('villages')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ villages: VILLAGES }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

test('observation form renders text input, STT hint, and submit button', async () => {
  const { getByPlaceholderText, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByPlaceholderText(/observation/i)).toBeTruthy());
  expect(getByText(/tap the mic/i)).toBeTruthy();
  expect(getByText('Submit')).toBeTruthy();
});

test('form loads field workers on mount', async () => {
  const { getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByText('Worker One')).toBeTruthy());
});

test('submitting with text calls queueObservation and syncPending', async () => {
  const { getByPlaceholderText, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByText('Worker One'));
  fireEvent.changeText(getByPlaceholderText(/observation/i), 'Test note');
  fireEvent.press(getByText('Submit'));
  await waitFor(() => {
    expect(queueObservation).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Test note', block_lead_email: 'test-block-lead@placeholder.local' })
    );
    expect(syncPending).toHaveBeenCalled();
  });
});
