import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../App';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = makeRedirectUri({ scheme: 'livelihood-monitor', path: 'auth-callback' });

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogleSignIn() {
    setLoading(true);
    setError('');
    try {
      console.log('[auth] redirect uri', REDIRECT_URI);
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true },
      });
      if (oauthError || !data.url) throw oauthError ?? new Error('No auth URL');
      console.log('[auth] oauth url created');
      const oauthUrl = new URL(data.url);
      console.log('[auth] oauth redirect_to', oauthUrl.searchParams.get('redirect_to'));

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
      console.log('[auth] browser result', result.type);
      if (result.type !== 'success') { setLoading(false); return; }

      const parsed = new URL(result.url);
      const code = parsed.searchParams.get('code');
      console.log('[auth] callback received', code ? 'code' : 'tokens');

      if (code) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError) throw sessionError;
      } else {
        // Implicit flow — tokens arrive as hash fragment
        const hash = parsed.hash.slice(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (!accessToken) throw new Error('Sign in failed — no token received');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });
        if (sessionError) throw sessionError;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No email from Google');

      const roleRes = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/role?email=${encodeURIComponent(user.email)}`
      );
      if (!roleRes.ok) {
        await supabase.auth.signOut();
        setError("Your account hasn't been assigned a role. Contact your administrator.");
        setLoading(false);
        return;
      }
      const { role } = await roleRes.json();
      if (role !== 'block_lead') {
        await supabase.auth.signOut();
        setError('This app is for block leads only. Use the web app for your role.');
        setLoading(false);
        return;
      }

      navigation.replace('BlockLeadHome', { email: user.email });
    } catch (e: any) {
      setError(e.message ?? 'Sign in failed');
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Livelihood Monitor</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleGoogleSignIn} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#374151" />
          : <Text style={styles.buttonText}>Sign in with Google</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 22, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  error: { fontSize: 13, color: '#dc2626', textAlign: 'center', maxWidth: 280 },
  button: { width: 240, paddingVertical: 14, paddingHorizontal: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  buttonText: { textAlign: 'center', color: '#374151', fontWeight: '500' },
});
