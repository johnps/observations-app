import React, { useEffect, useState } from 'react';
import { AppState, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { initDB } from './lib/db';
import { syncPending, syncHierarchy } from './lib/sync';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import ObservationForm from './screens/ObservationForm';
import MyObservations from './screens/MyObservations';

export type RootStackParamList = {
  Login: undefined;
  BlockLeadHome: { email: string; justSubmitted?: boolean; wasSynced?: boolean };
  ObservationForm: { email: string };
  MyObservations: { email: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function BlockLeadHomeScreen({ route }: { route: { params: { email: string; justSubmitted?: boolean; wasSynced?: boolean } } }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { email, justSubmitted, wasSynced } = route.params;
  const [banner, setBanner] = useState('');

  useEffect(() => {
    if (justSubmitted) {
      setBanner(wasSynced ? '✓ Observation submitted' : '⏳ Saved offline — will sync when connected');
      const t = setTimeout(() => setBanner(''), 4000);
      return () => clearTimeout(t);
    }
  }, [justSubmitted, wasSynced]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigation.replace('Login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Livelihood Monitor</Text>
      <Text style={styles.email}>{email}</Text>

      {banner ? (
        <View style={[styles.banner, wasSynced ? styles.bannerSynced : styles.bannerPending]}>
          <Text style={[styles.bannerText, wasSynced ? styles.bannerTextSynced : styles.bannerTextPending]}>
            {banner}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('ObservationForm', { email })}
      >
        <Text style={styles.primaryButtonText}>New Observation</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('MyObservations', { email })}
      >
        <Text style={styles.secondaryButtonText}>My Observations</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSignOut}>
        <Text style={styles.signOut}>Sign out</Text>
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
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen
          name="BlockLeadHome"
          component={BlockLeadHomeScreen}
          initialParams={initialRoute === 'BlockLeadHome' ? { email: initialEmail } : undefined}
        />
        <Stack.Screen name="ObservationForm" options={{ headerShown: true, title: 'New Observation' }}>
          {({ route }) => <ObservationForm blockLeadEmail={(route.params as any).email} />}
        </Stack.Screen>
        <Stack.Screen name="MyObservations" options={{ headerShown: true, title: 'My Observations' }}>
          {({ route }) => <MyObservations blockLeadEmail={(route.params as any).email} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '600', color: '#1f2937' },
  email: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  banner: { width: '100%', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 4 },
  bannerSynced: { backgroundColor: '#dcfce7' },
  bannerPending: { backgroundColor: '#fef9c3' },
  bannerText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  bannerTextSynced: { color: '#15803d' },
  bannerTextPending: { color: '#92400e' },
  primaryButton: { width: 240, backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8 },
  primaryButtonText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  secondaryButton: { width: 240, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8 },
  secondaryButtonText: { color: '#374151', fontWeight: '500', textAlign: 'center' },
  signOut: { color: '#9ca3af', fontSize: 13, marginTop: 8 },
});
