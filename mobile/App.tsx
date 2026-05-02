import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';

export type RootStackParamList = {
  Login: undefined;
  AdminHome: undefined;
  DistrictLeadHome: undefined;
  BlockLeadHome: undefined;
  StateLeadHome: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>{title}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminHome">{() => <HomeScreen title="Admin" />}</Stack.Screen>
        <Stack.Screen name="DistrictLeadHome">{() => <HomeScreen title="District Lead" />}</Stack.Screen>
        <Stack.Screen name="BlockLeadHome">{() => <HomeScreen title="Block Lead" />}</Stack.Screen>
        <Stack.Screen name="StateLeadHome">{() => <HomeScreen title="State Lead" />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
