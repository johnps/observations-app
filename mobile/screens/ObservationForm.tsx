import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type Props = { blockLeadEmail: string };

export default function ObservationForm({ blockLeadEmail }: Props) {
  const navigation = useNavigation();
  const [fieldWorkers, setFieldWorkers] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [observationText, setObservationText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/hierarchy/field-workers?block_lead_email=${encodeURIComponent(blockLeadEmail)}`)
      .then(r => r.json())
      .then(b => setFieldWorkers((b.field_workers ?? []).map((w: { field_worker_name: string }) => w.field_worker_name)));
  }, [blockLeadEmail]);

  useEffect(() => {
    if (!selectedWorker) { setVillages([]); return; }
    fetch(`${API_BASE}/api/hierarchy/villages?block_lead_email=${encodeURIComponent(blockLeadEmail)}&field_worker_name=${encodeURIComponent(selectedWorker)}`)
      .then(r => r.json())
      .then(b => setVillages((b.villages ?? []).map((v: { village_name: string }) => v.village_name)));
  }, [selectedWorker, blockLeadEmail]);

  async function handleSubmit() {
    if (!observationText.trim()) return;
    setSubmitting(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await fetch(`${API_BASE}/api/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        text: observationText,
        field_worker_name: selectedWorker,
        village_name: selectedVillage,
        block_lead_email: blockLeadEmail,
        submitted_at: new Date().toISOString(),
      }),
    });
    setSubmitting(false);
    navigation.goBack();
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Field Worker</Text>
      {fieldWorkers.map(w => (
        <TouchableOpacity
          key={w}
          style={[styles.option, selectedWorker === w && styles.optionSelected]}
          onPress={() => { setSelectedWorker(w); setSelectedVillage(''); }}
        >
          <Text style={selectedWorker === w ? styles.optionTextSelected : styles.optionText}>{w}</Text>
        </TouchableOpacity>
      ))}

      {selectedWorker ? (
        <>
          <Text style={styles.label}>Village</Text>
          {villages.map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.option, selectedVillage === v && styles.optionSelected]}
              onPress={() => setSelectedVillage(v)}
            >
              <Text style={selectedVillage === v ? styles.optionTextSelected : styles.optionText}>{v}</Text>
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <Text style={styles.label}>Observation</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Write your observation…"
        multiline
        numberOfLines={4}
        value={observationText}
        onChangeText={setObservationText}
      />

      <TouchableOpacity
        style={[styles.submit, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>Submit</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  option: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginBottom: 6 },
  optionSelected: { borderColor: '#111827', backgroundColor: '#f9fafb' },
  optionText: { color: '#374151' },
  optionTextSelected: { color: '#111827', fontWeight: '600' },
  textInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', fontSize: 14, color: '#374151' },
  submit: { marginTop: 24, backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
