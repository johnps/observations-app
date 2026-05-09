import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { getFailedObservations, clearFailed, requeueFailed } from '../lib/db';
import type { FailedObservation } from '../types/observation';

type Props = { blockLeadEmail: string };

export default function FailedObservations({ blockLeadEmail: _ }: Props) {
  const [items, setItems] = useState<FailedObservation[]>([]);

  useEffect(() => {
    setItems(getFailedObservations());
  }, []);

  const handleDismiss = useCallback((id: string) => {
    clearFailed(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleRequeue = useCallback((id: string) => {
    requeueFailed(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No failed observations</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const obs = JSON.parse(item.payload);
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.meta}>{obs.field_worker_name} · {obs.village_name}</Text>
              <Text style={styles.reason}>{item.reason}</Text>
            </View>
            <Text style={styles.text}>{obs.text}</Text>
            <Text style={styles.date}>
              {new Date(obs.submitted_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.requeueButton} onPress={() => handleRequeue(item.id)}>
                <Text style={styles.requeueText}>Re-queue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dismissButton} onPress={() => handleDismiss(item.id)}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#9ca3af', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  meta: { fontSize: 12, color: '#6b7280', flex: 1 },
  reason: { fontSize: 11, color: '#dc2626', fontWeight: '500' },
  text: { fontSize: 14, color: '#374151', lineHeight: 20 },
  date: { fontSize: 11, color: '#9ca3af' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  requeueButton: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingVertical: 7, alignItems: 'center' },
  requeueText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  dismissButton: { flex: 1, borderWidth: 1, borderColor: '#fca5a5', borderRadius: 6, paddingVertical: 7, alignItems: 'center' },
  dismissText: { fontSize: 13, color: '#dc2626', fontWeight: '500' },
});
