import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { getPendingObservations } from '../lib/db';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type ObsItem = {
  id: string;
  text: string;
  field_worker_name: string;
  village_name: string;
  submitted_at: string;
  synced: boolean;
};

type Props = { blockLeadEmail: string };

export default function MyObservations({ blockLeadEmail }: Props) {
  const [items, setItems] = useState<ObsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Pending from local SQLite
    const pending = getPendingObservations().map(obs => ({
      id: obs.id,
      text: obs.text,
      field_worker_name: obs.field_worker_name,
      village_name: obs.village_name,
      submitted_at: obs.submitted_at,
      synced: false as const,
    }));
    const pendingIds = new Set(pending.map(p => p.id));

    // Synced from server
    let synced: ObsItem[] = [];
    try {
      const res = await fetch(
        `${API_BASE}/api/observations?block_lead_email=${encodeURIComponent(blockLeadEmail)}`
      );
      if (res.ok) {
        const body = await res.json();
        synced = (body.observations ?? [])
          .filter((o: any) => !pendingIds.has(o.id))
          .map((o: any) => ({
            id: o.id,
            text: o.text,
            field_worker_name: o.field_worker_name,
            village_name: o.village_name,
            submitted_at: o.submitted_at,
            synced: true,
          }));
      }
    } catch { /* offline — show only local */ }

    const merged = [...pending, ...synced].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );
    setItems(merged);
  }, [blockLeadEmail]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#9ca3af" />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      ListEmptyComponent={
        <Text style={styles.empty}>No observations yet</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.meta}>{item.field_worker_name} · {item.village_name}</Text>
            <View style={[styles.badge, item.synced ? styles.badgeSynced : styles.badgePending]}>
              <Text style={[styles.badgeText, item.synced ? styles.badgeTextSynced : styles.badgeTextPending]}>
                {item.synced ? '✓ Synced' : '⏳ Pending'}
              </Text>
            </View>
          </View>
          <Text style={styles.text} numberOfLines={3}>{item.text}</Text>
          <Text style={styles.date}>
            {new Date(item.submitted_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#9ca3af', fontSize: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 12, color: '#6b7280', flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSynced: { backgroundColor: '#dcfce7' },
  badgePending: { backgroundColor: '#fef9c3' },
  badgeText: { fontSize: 11, fontWeight: '500' },
  badgeTextSynced: { color: '#15803d' },
  badgeTextPending: { color: '#92400e' },
  text: { fontSize: 14, color: '#374151', lineHeight: 20 },
  date: { fontSize: 11, color: '#9ca3af' },
});
