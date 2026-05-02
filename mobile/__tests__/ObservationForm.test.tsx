import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ObservationForm from '../screens/ObservationForm';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

const WORKERS = [{ field_worker_name: 'Worker One' }, { field_worker_name: 'Worker Two' }];
const VILLAGES = [{ village_name: 'Village A' }, { village_name: 'Village B' }];

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
    if (url.includes('field-workers')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ field_workers: WORKERS }) });
    }
    if (url.includes('villages')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ villages: VILLAGES }) });
    }
    if (url.includes('/api/observations')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'test-uuid' }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

test('observation form renders text input and submit button', async () => {
  const { getByPlaceholderText, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByPlaceholderText(/observation/i)).toBeTruthy());
  expect(getByText('Submit')).toBeTruthy();
});

test('form loads field workers on mount', async () => {
  const { getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByText('Worker One')).toBeTruthy());
});

test('submitting with text and worker calls POST /api/observations', async () => {
  const { getByPlaceholderText, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByText('Worker One'));
  fireEvent.changeText(getByPlaceholderText(/observation/i), 'Test note');
  fireEvent.press(getByText('Submit'));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/observations'),
      expect.objectContaining({ method: 'POST' })
    )
  );
});
