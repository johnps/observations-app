import React, { useEffect, useState } from 'react';
import { AppState, View, Text, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { initDB } from './lib/db';
import { syncPending, syncHierarchy } from './lib/sync';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import ObservationForm from './screens/ObservationForm';

export type RootStackParamList = {
  Login: undefined;
  BlockLeadHome: { email: string };
  ObservationForm: { email: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function BlockLeadHomeScreen({ route }: { route: { params: { email: string } } }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { email } = route.params;

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigation.replace('Login');
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '600', color: '#1f2937' }}>Livelihood Monitor</Text>
      <Text style={{ fontSize: 13, color: '#6b7280' }}>{email}</Text>
      <TouchableOpacity
        style={{ backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
        onPress={() => navigation.navigate('ObservationForm', { email })}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>New Observation</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleSignOut}>
        <Text style={{ color: '#9ca3af', fontSize: 13 }}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<'Login' | 'BlockLeadHome' | null>(null);
  const [initialEmail, setInitialEmail] = useState('');

  useEffect(() => {
    initDB();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        const email = session.user.email;
        setInitialEmail(email);
        setInitialRoute('BlockLeadHome');
        syncPending();
        syncHierarchy(email);
      } else {
        setInitialRoute('Login');
      }
    });

    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        syncPending();
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.email) syncHierarchy(session.user.email);
        });
      }
    });
    const netSub = NetInfo.addEventListener(netState => {
      if (netState.isConnected) {
        syncPending();
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.email) syncHierarchy(session.user.email);
        });
      }
    });
    return () => { appSub.remove(); netSub(); };
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen
          name="BlockLeadHome"
          component={BlockLeadHomeScreen}
          initialParams={initialRoute === 'BlockLeadHome' ? { email: initialEmail } : undefined}
        />
        <Stack.Screen name="ObservationForm" options={{ headerShown: true, title: 'New Observation' }}>
          {({ route }) => <ObservationForm blockLeadEmail={(route.params as any).email} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
