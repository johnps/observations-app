import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, useFocusEffect, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { initDB, getPendingObservations } from './lib/db';
import { syncPending, syncHierarchy } from './lib/sync';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import ObservationForm from './screens/ObservationForm';
import MyObservations from './screens/MyObservations';

export type RootStackParamList = {
  Login: undefined;
  BlockLeadHome: { email: string; submitKey?: number; isOnline?: boolean };
  ObservationForm: { email: string };
  MyObservations: { email: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function BlockLeadHomeScreen({ route }: { route: { params: { email: string; submitKey?: number; isOnline?: boolean } } }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { email, submitKey, isOnline } = route.params;
  const [banner, setBanner] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const loadCounts = useCallback(async () => {
    setPendingCount(getPendingObservations().length);
    try {
      const res = await fetch(`${API_BASE}/api/observations?block_lead_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const body = await res.json();
        setSyncedCount((body.observations ?? []).length);
      }
    } catch { /* offline — leave synced count as-is */ }
  }, [email]);

  // Full count refresh (including API) on focus; local pending count polls every 3s so
  // background syncs (AppState, NetInfo, post-submit) are reflected without manual tap.
  useFocusEffect(useCallback(() => {
    loadCounts();
    const id = setInterval(() => setPendingCount(getPendingObservations().length), 3_000);
    return () => clearInterval(id);
  }, [loadCounts]));

  // submitKey is a timestamp — unique per submission, so this always re-fires.
  useEffect(() => {
    if (!submitKey) return;
    setBanner(isOnline ? '✓ Saved — syncing in background' : '⏳ Saved offline — will sync when connected');
    const t = setTimeout(() => setBanner(''), 4000);
    return () => clearTimeout(t);
  }, [submitKey, isOnline]);

  async function handleSync() {
    setSyncing(true);
    setSyncError('');
    try {
      const result = await syncPending();
      await loadCounts();
      if (result.failed > 0) {
        setSyncError(`${result.failed} observation${result.failed > 1 ? 's' : ''} failed to sync — will retry automatically.`);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigation.replace('Login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Livelihood Monitor</Text>
      <Text style={styles.email}>{email}</Text>

      {banner ? (
        <View style={[styles.banner, isOnline ? styles.bannerSynced : styles.bannerPending]}>
          <Text style={[styles.bannerText, isOnline ? styles.bannerTextSynced : styles.bannerTextPending]}>
            {banner}
          </Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{syncedCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Synced</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statNumber, pendingCount > 0 && styles.statNumberPending]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {pendingCount > 0 && (
        <TouchableOpacity style={styles.syncButton} onPress={handleSync} disabled={syncing}>
          {syncing
            ? <ActivityIndicator size="small" color="#374151" />
            : <Text style={styles.syncButtonText}>Sync now</Text>}
        </TouchableOpacity>
      )}
      {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}

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
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32, gap: 24, marginBottom: 4 },
  stat: { alignItems: 'center', gap: 2 },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#111827' },
  statNumberPending: { color: '#b45309' },
  statLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  statDivider: { width: 1, height: 32, backgroundColor: '#e5e7eb' },
  syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20, minWidth: 100, minHeight: 36 },
  syncButtonText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  syncError: { fontSize: 13, color: '#dc2626', textAlign: 'center', maxWidth: 280 },
  primaryButton: { width: 240, backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8 },
  primaryButtonText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  secondaryButton: { width: 240, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8 },
  secondaryButtonText: { color: '#374151', fontWeight: '500', textAlign: 'center' },
  signOut: { color: '#9ca3af', fontSize: 13, marginTop: 8 },
});
