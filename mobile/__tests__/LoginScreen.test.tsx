import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LoginScreen from '../screens/LoginScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

beforeEach(() => mockNavigate.mockClear());

test('login screen shows all four role buttons', () => {
  const { getByText } = render(<LoginScreen />);
  expect(getByText('Admin')).toBeTruthy();
  expect(getByText('District Lead')).toBeTruthy();
  expect(getByText('Block Lead')).toBeTruthy();
  expect(getByText('State Lead')).toBeTruthy();
});

test('pressing Admin navigates to AdminHome', () => {
  const { getByText } = render(<LoginScreen />);
  fireEvent.press(getByText('Admin'));
  expect(mockNavigate).toHaveBeenCalledWith('AdminHome');
});

test('pressing District Lead navigates to DistrictLeadHome', () => {
  const { getByText } = render(<LoginScreen />);
  fireEvent.press(getByText('District Lead'));
  expect(mockNavigate).toHaveBeenCalledWith('DistrictLeadHome');
});

test('pressing Block Lead navigates to BlockLeadHome', () => {
  const { getByText } = render(<LoginScreen />);
  fireEvent.press(getByText('Block Lead'));
  expect(mockNavigate).toHaveBeenCalledWith('BlockLeadHome');
});

test('pressing State Lead navigates to StateLeadHome', () => {
  const { getByText } = render(<LoginScreen />);
  fireEvent.press(getByText('State Lead'));
  expect(mockNavigate).toHaveBeenCalledWith('StateLeadHome');
});
