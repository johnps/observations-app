import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../screens/LoginScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'cancel' }),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn().mockReturnValue('livelihood-monitor://auth-callback'),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: null }, error: null }),
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn() }),
}));

test('login screen shows app title and sign-in button', () => {
  const { getByText } = render(<LoginScreen />);
  expect(getByText('Livelihood Monitor')).toBeTruthy();
  expect(getByText('Sign in with Google')).toBeTruthy();
});

test('pressing sign-in button shows loading indicator', async () => {
  const { getByText, queryByText, getByTestId } = render(<LoginScreen />);
  fireEvent.press(getByText('Sign in with Google'));
  await waitFor(() => expect(queryByText('Sign in with Google')).toBeNull());
});
