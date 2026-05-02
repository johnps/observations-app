import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import ObservationForm from './screens/ObservationForm';

export type RootStackParamList = {
  Login: undefined;
  AdminHome: undefined;
  DistrictLeadHome: undefined;
  BlockLeadHome: undefined;
  StateLeadHome: undefined;
  ObservationForm: undefined;
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
        <Stack.Screen name="BlockLeadHome">
          {() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: '600' }}>Block Lead</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
                onPress={() => {}}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>New Observation</Text>
              </TouchableOpacity>
            </View>
          )}
        </Stack.Screen>
        <Stack.Screen name="StateLeadHome">{() => <HomeScreen title="State Lead" />}</Stack.Screen>
        <Stack.Screen name="ObservationForm" options={{ title: 'New Observation' }}>
          {() => <ObservationForm blockLeadEmail="test-block-lead@placeholder.local" />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
