import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { queueObservation } from '../lib/db';
import { syncPending } from '../lib/sync';

const FIELD_WORKERS_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/hierarchy/field-workers`;
const VILLAGES_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/hierarchy/villages`;
const MAX_PHOTOS = 5;

type Props = { blockLeadEmail: string };

export default function ObservationForm({ blockLeadEmail }: Props) {
  const navigation = useNavigation();
  const [fieldWorkers, setFieldWorkers] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [observationText, setObservationText] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  useEffect(() => {
    fetch(`${FIELD_WORKERS_URL}?block_lead_email=${encodeURIComponent(blockLeadEmail)}`)
      .then(r => r.json())
      .then(b => setFieldWorkers((b.field_workers ?? []).map((w: { field_worker_name: string }) => w.field_worker_name)));
  }, [blockLeadEmail]);

  useEffect(() => {
    if (!selectedWorker) { setVillages([]); return; }
    fetch(`${VILLAGES_URL}?block_lead_email=${encodeURIComponent(blockLeadEmail)}&field_worker_name=${encodeURIComponent(selectedWorker)}`)
      .then(r => r.json())
      .then(b => setVillages((b.villages ?? []).map((v: { village_name: string }) => v.village_name)));
  }, [selectedWorker, blockLeadEmail]);

  async function addPhoto(uri: string, width: number) {
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: Math.min(width, 1280) } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    setPhotoUris(prev => [...prev, resized.uri]);
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const { uri, width } = result.assets[0];
    await addPhoto(uri, width);
  }

  async function handleTakePhoto() {
    await ImagePicker.requestCameraPermissionsAsync();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const { uri, width } = result.assets[0];
    await addPhoto(uri, width);
  }

  async function handleSubmit() {
    if (!observationText.trim()) return;
    setSubmitting(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let gps_lat: number | undefined;
    let gps_lng: number | undefined;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      gps_lat = loc.coords.latitude;
      gps_lng = loc.coords.longitude;
    } catch {
      // permission denied or unavailable — submit without GPS
    }

    queueObservation({
      id,
      text: observationText,
      field_worker_name: selectedWorker,
      village_name: selectedVillage,
      block_lead_email: blockLeadEmail,
      photo_uris: photoUris,
      gps_lat,
      gps_lng,
      submitted_at: new Date().toISOString(),
    });
    await syncPending();
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
        autoCorrect
        autoCapitalize="sentences"
        value={observationText}
        onChangeText={setObservationText}
      />
      <Text style={styles.hint}>Tap the mic on your keyboard to dictate in Hindi or English</Text>

      <Text style={styles.label}>Photos ({photoUris.length}/{MAX_PHOTOS})</Text>
      <View style={styles.photoRow}>
        {photoUris.map((uri, i) => (
          <View key={i} style={styles.photoThumb}>
            <Image source={{ uri }} style={styles.thumbImage} />
            <TouchableOpacity
              style={styles.removePhoto}
              onPress={() => setPhotoUris(prev => prev.filter((_, idx) => idx !== i))}
            >
              <Text style={styles.removePhotoText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {photoUris.length < MAX_PHOTOS && (
        <View style={styles.photoButtons}>
          <TouchableOpacity style={[styles.photoButton, { flex: 1 }]} onPress={handleTakePhoto}>
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.photoButton, { flex: 1 }]} onPress={handlePickPhoto}>
            <Text style={styles.photoButtonText}>Attach Photo</Text>
          </TouchableOpacity>
        </View>
      )}

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
  hint: { marginTop: 6, fontSize: 12, color: '#9ca3af' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photoThumb: { position: 'relative' },
  thumbImage: { width: 64, height: 64, borderRadius: 6 },
  removePhoto: { position: 'absolute', top: -6, right: -6, backgroundColor: '#111827', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#fff', fontSize: 10 },
  photoButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  photoButton: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  photoButtonText: { color: '#374151', fontSize: 14 },
  submit: { marginTop: 24, backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
