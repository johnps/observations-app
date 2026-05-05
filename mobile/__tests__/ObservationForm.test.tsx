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

jest.mock('../lib/db', () => ({
  queueObservation: jest.fn(),
}));

jest.mock('../lib/useHierarchy', () => ({
  useHierarchy: jest.fn(),
}));
jest.mock('../lib/sync', () => ({ syncPending: jest.fn().mockResolvedValue({ synced: 1, failed: 0, errors: [] }) }));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 26.9, longitude: 75.8 } }),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    copy: jest.fn(),
    delete: jest.fn(),
    uri: 'file:///documents/obs_photos/photo_test.jpg',
  })),
  Directory: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    uri: 'file:///documents/obs_photos/',
  })),
  Paths: { document: { uri: 'file:///documents/' } },
}));

const WORKERS = ['Worker One', 'Worker Two'];
const VILLAGES = ['Village A', 'Village B'];

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  (queueObservation as jest.Mock).mockClear();
  (syncPending as jest.Mock).mockResolvedValue({ synced: 1, failed: 0, errors: [] });

  const { useHierarchy } = require('../lib/useHierarchy');
  useHierarchy.mockReturnValue({ fieldWorkers: WORKERS, villages: VILLAGES });

  const { ImageManipulator } = require('expo-image-manipulator');
  ImageManipulator.manipulate.mockReturnValue({
    resize: jest.fn().mockReturnThis(),
    renderAsync: jest.fn().mockResolvedValue({
      saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///resized.jpg' }),
    }),
  });
  const Location = require('expo-location');
  Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 26.9, longitude: 75.8 } });
});

test('observation form renders text input, STT hint, and submit button', async () => {
  const { getByPlaceholderText, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByPlaceholderText(/observation/i)).toBeTruthy());
  expect(getByText(/tap the mic/i)).toBeTruthy();
  expect(getByText('Submit')).toBeTruthy();
});

test('field worker selector shows placeholder before selection', async () => {
  const { getByTestId } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByTestId('field-worker-picker')).toBeTruthy());
  expect(getByTestId('field-worker-picker')).toHaveTextContent(/Select field worker/);
});

test('tapping field worker selector opens modal with worker names', async () => {
  const { getByTestId, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByTestId('field-worker-picker'));
  fireEvent.press(getByTestId('field-worker-picker'));
  await waitFor(() => expect(getByText('Worker One')).toBeTruthy());
  expect(getByText('Worker Two')).toBeTruthy();
});

test('selecting a worker from the modal closes it and shows the name in the selector', async () => {
  const { getByTestId, getByText, queryByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByTestId('field-worker-picker'));
  fireEvent.press(getByTestId('field-worker-picker'));
  await waitFor(() => getByText('Worker One'));
  fireEvent.press(getByText('Worker One'));
  await waitFor(() => expect(getByTestId('field-worker-picker')).toHaveTextContent(/Worker One/));
  expect(queryByText('Worker Two')).toBeNull(); // modal closed, FlatList unmounted
});

test('form loads field workers on mount (shown in picker after load)', async () => {
  const { getByTestId } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  // After load the picker should be enabled (not show a loading spinner)
  await waitFor(() => {
    const picker = getByTestId('field-worker-picker');
    expect(picker.props.accessibilityState?.disabled).toBeFalsy();
  });
});

test('photo attach button is visible', async () => {
  const { getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByText(/attach photo/i)).toBeTruthy());
});

test('camera button is visible', async () => {
  const { getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => expect(getByText(/take photo/i)).toBeTruthy());
});

test('take photo button calls launchCameraAsync', async () => {
  const ImagePicker = require('expo-image-picker');
  ImagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///camera.jpg', width: 1920, height: 1080 }],
  });

  const { getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByText(/take photo/i));
  fireEvent.press(getByText(/take photo/i));
  await waitFor(() => expect(ImagePicker.launchCameraAsync).toHaveBeenCalled());
});

// Helper: select a worker and village via modal pickers
async function selectWorkerAndVillage(
  getByTestId: ReturnType<typeof render>['getByTestId'],
  getByText: ReturnType<typeof render>['getByText'],
  worker = 'Worker One',
  village = 'Village A',
) {
  await waitFor(() => getByTestId('field-worker-picker'));
  fireEvent.press(getByTestId('field-worker-picker'));
  await waitFor(() => getByText(worker));
  fireEvent.press(getByText(worker));
  await waitFor(() => getByTestId('village-picker'));
  fireEvent.press(getByTestId('village-picker'));
  await waitFor(() => getByText(village));
  fireEvent.press(getByText(village));
}

test('village picker is disabled until a worker is selected', async () => {
  const { getByTestId } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByTestId('field-worker-picker'));
  expect(getByTestId('village-picker').props.accessibilityState?.disabled).toBe(true);
});

test('village picker is enabled after selecting a worker', async () => {
  const { getByTestId, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByTestId('field-worker-picker'));
  fireEvent.press(getByTestId('field-worker-picker'));
  await waitFor(() => getByText('Worker One'));
  fireEvent.press(getByText('Worker One'));
  await waitFor(() =>
    expect(getByTestId('village-picker').props.accessibilityState?.disabled).toBeFalsy()
  );
});

test('tapping village picker after worker selection shows villages', async () => {
  const { getByTestId, getByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByTestId('field-worker-picker'));
  fireEvent.press(getByTestId('field-worker-picker'));
  await waitFor(() => getByText('Worker One'));
  fireEvent.press(getByText('Worker One'));
  await waitFor(() => getByTestId('village-picker'));
  fireEvent.press(getByTestId('village-picker'));
  await waitFor(() => expect(getByText('Village A')).toBeTruthy());
  expect(getByText('Village B')).toBeTruthy();
});

test('shows error below photos when camera processing fails', async () => {
  const ImagePicker = require('expo-image-picker');
  const { ImageManipulator } = require('expo-image-manipulator');
  ImagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///camera.jpg', width: 1920, height: 1080 }],
  });
  ImageManipulator.manipulate.mockReturnValue({
    resize: jest.fn().mockReturnThis(),
    renderAsync: jest.fn().mockRejectedValue(new Error('Processing failed')),
  });

  const { getByText, findByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByText(/take photo/i));
  fireEvent.press(getByText(/take photo/i));
  expect(await findByText(/could not process photo/i)).toBeTruthy();
});

test('handles width=0 from camera (Android may not provide dimensions)', async () => {
  // expo-image-picker docs: "Can be 0 if the system did not provide the width"
  // Android native bitmap creation throws on width=0; this test simulates that.
  const ImagePicker = require('expo-image-picker');
  const { ImageManipulator } = require('expo-image-manipulator');
  ImagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///camera.jpg', width: 0, height: 0 }],
  });
  ImageManipulator.manipulate.mockReturnValue({
    resize: jest.fn().mockImplementation(({ width }) => {
      if (width === 0) throw new Error('width must be > 0');
      return { resize: jest.fn().mockReturnThis(), renderAsync: jest.fn().mockResolvedValue({ saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///resized.jpg' }) }) };
    }),
    renderAsync: jest.fn().mockResolvedValue({
      saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///resized.jpg' }),
    }),
  });

  const { getByText, queryByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByText(/take photo/i));
  fireEvent.press(getByText(/take photo/i));
  await waitFor(() => {
    expect(queryByText(/could not process photo/i)).toBeNull();
    expect(getByText(/photos \(1/i)).toBeTruthy();
  });
});

test('shows error below photos when gallery processing fails', async () => {
  const ImagePicker = require('expo-image-picker');
  const { ImageManipulator } = require('expo-image-manipulator');
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///gallery.jpg', width: 2000, height: 1500 }],
  });
  ImageManipulator.manipulate.mockReturnValue({
    resize: jest.fn().mockReturnThis(),
    renderAsync: jest.fn().mockRejectedValue(new Error('Processing failed')),
  });

  const { getByText, findByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByText(/attach photo/i));
  fireEvent.press(getByText(/attach photo/i));
  expect(await findByText(/could not process photo/i)).toBeTruthy();
});

test('photo error clears on next successful attempt', async () => {
  const ImagePicker = require('expo-image-picker');
  const { ImageManipulator } = require('expo-image-manipulator');
  ImagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///camera.jpg', width: 1920, height: 1080 }],
  });
  ImageManipulator.manipulate
    .mockReturnValueOnce({
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockRejectedValue(new Error('Processing failed')),
    })
    .mockReturnValueOnce({
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockResolvedValue({
        saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///camera_resized.jpg' }),
      }),
    });

  const { getByText, findByText, queryByText } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await waitFor(() => getByText(/take photo/i));
  fireEvent.press(getByText(/take photo/i));
  await findByText(/could not process photo/i);

  fireEvent.press(getByText(/take photo/i));
  await waitFor(() => {
    expect(queryByText(/could not process photo/i)).toBeNull();
    expect(getByText(/photos \(1/i)).toBeTruthy();
  });
});

test('submitting includes photo_uris when photos are selected', async () => {
  const ImagePicker = require('expo-image-picker');
  const { ImageManipulator } = require('expo-image-manipulator');
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photo1.jpg', width: 2000, height: 1500 }],
  });

  const { getByPlaceholderText, getByText, getByTestId } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await selectWorkerAndVillage(getByTestId, getByText);

  fireEvent.press(getByText(/attach photo/i));
  await waitFor(() => expect(ImageManipulator.manipulate).toHaveBeenCalled());

  fireEvent.changeText(getByPlaceholderText(/observation/i), 'With photo');
  fireEvent.press(getByText('Submit'));
  await waitFor(() =>
    expect(queueObservation).toHaveBeenCalledWith(
      expect.objectContaining({ photo_uris: expect.arrayContaining([expect.stringContaining('obs_photos')]) })
    )
  );
});

test('submitted observation id is a valid UUID (non-UUID ids are rejected by Supabase)', async () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const { getByPlaceholderText, getByText, getByTestId } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await selectWorkerAndVillage(getByTestId, getByText);
  fireEvent.changeText(getByPlaceholderText(/observation/i), 'UUID test');
  fireEvent.press(getByText('Submit'));
  await waitFor(() => expect(queueObservation).toHaveBeenCalled());
  const { id } = (queueObservation as jest.Mock).mock.calls[0][0];
  expect(UUID_RE.test(id)).toBe(true);
});

test('submit proceeds without GPS fields when location hangs past 5s', async () => {
  const Location = require('expo-location');
  Location.getCurrentPositionAsync.mockReturnValue(new Promise(() => {})); // never resolves

  const { getByPlaceholderText, getByText, getByTestId } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await selectWorkerAndVillage(getByTestId, getByText);
  fireEvent.changeText(getByPlaceholderText(/observation/i), 'GPS hang test');

  jest.useFakeTimers();
  fireEvent.press(getByText('Submit'));
  await jest.advanceTimersByTimeAsync(5001);
  jest.useRealTimers();

  await waitFor(() => expect(queueObservation).toHaveBeenCalled());
  const call = (queueObservation as jest.Mock).mock.calls[0][0];
  expect(call.gps_lat).toBeUndefined();
  expect(call.gps_lng).toBeUndefined();
});

test('submitting with text calls queueObservation and syncPending', async () => {
  const { getByPlaceholderText, getByText, getByTestId } = render(
    <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />
  );
  await selectWorkerAndVillage(getByTestId, getByText);
  fireEvent.changeText(getByPlaceholderText(/observation/i), 'Test note');
  fireEvent.press(getByText('Submit'));
  await waitFor(() => {
    expect(queueObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Test note',
        block_lead_email: 'test-block-lead@placeholder.local',
        gps_lat: 26.9,
        gps_lng: 75.8,
      })
    );
    expect(syncPending).toHaveBeenCalled();
  });
});
