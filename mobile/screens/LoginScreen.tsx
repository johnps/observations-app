import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

const ROLES: { label: string; screen: keyof RootStackParamList }[] = [
  { label: 'Admin', screen: 'AdminHome' },
  { label: 'District Lead', screen: 'DistrictLeadHome' },
  { label: 'Block Lead', screen: 'BlockLeadHome' },
  { label: 'State Lead', screen: 'StateLeadHome' },
];

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Livelihood Monitor</Text>
      <Text style={styles.subtitle}>Select your role to continue</Text>
      {ROLES.map(({ label, screen }) => (
        <TouchableOpacity
          key={label}
          style={styles.button}
          onPress={() => navigation.navigate(screen)}
        >
          <Text style={styles.buttonText}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '600', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  button: { width: 240, paddingVertical: 14, paddingHorizontal: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  buttonText: { textAlign: 'center', color: '#374151', fontWeight: '500' },
});
