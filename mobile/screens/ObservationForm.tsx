import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, ScrollView,
  Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { v4 as uuidv4 } from 'uuid';
import { queueObservation, getCachedFieldWorkers, getCachedVillages } from '../lib/db';
import { syncPending } from '../lib/sync';

const FIELD_WORKERS_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/hierarchy/field-workers`;
const VILLAGES_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/hierarchy/villages`;
const MAX_PHOTOS = 5;

type PickerProps = {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};

function PickerModal({ label, value, options, onSelect, placeholder, loading, disabled, testID }: PickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        testID={testID}
        style={[styles.selector, (disabled || loading) && styles.selectorDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled || loading}
        accessibilityState={{ disabled: !!(disabled || loading) }}
      >
        {loading ? (
          <>
            <ActivityIndicator size="small" color="#9ca3af" style={{ marginRight: 8 }} />
            <Text style={styles.selectorPlaceholder}>Loading…</Text>
          </>
        ) : (
          <Text style={value ? styles.selectorValue : styles.selectorPlaceholder}>
            {value || placeholder}
          </Text>
        )}
        {!loading && <Text style={styles.chevron}>▾</Text>}
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            {open && (
              <FlatList
                data={options}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalOption, item === value && styles.modalOptionSelected]}
                    onPress={() => { onSelect(item); setOpen(false); }}
                  >
                    <Text style={[styles.modalOptionText, item === value && styles.modalOptionTextSelected]}>
                      {item}
                    </Text>
                    {item === value && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

type Props = { blockLeadEmail: string };

export default function ObservationForm({ blockLeadEmail }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fieldWorkers, setFieldWorkers] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [observationText, setObservationText] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  useEffect(() => {
    const cached = getCachedFieldWorkers(blockLeadEmail);
    if (cached.length > 0) {
      setFieldWorkers(cached);
      setLoadingWorkers(false);
    } else {
      fetch(`${FIELD_WORKERS_URL}?block_lead_email=${encodeURIComponent(blockLeadEmail)}`)
        .then(r => r.json())
        .then(b => setFieldWorkers((b.field_workers ?? []).map((w: { field_worker_name: string }) => w.field_worker_name)))
        .finally(() => setLoadingWorkers(false));
    }
  }, [blockLeadEmail]);

  useEffect(() => {
    if (!selectedWorker) { setVillages([]); return; }
    const cached = getCachedVillages(blockLeadEmail, selectedWorker);
    if (cached.length > 0) {
      setVillages(cached);
    } else {
      fetch(`${VILLAGES_URL}?block_lead_email=${encodeURIComponent(blockLeadEmail)}&field_worker_name=${encodeURIComponent(selectedWorker)}`)
        .then(r => r.json())
        .then(b => setVillages((b.villages ?? []).map((v: { village_name: string }) => v.village_name)));
    }
  }, [selectedWorker, blockLeadEmail]);

  async function addPhoto(uri: string, width: number) {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: Math.min(width, 1280) });
    const ref = await context.renderAsync();
    const resized = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const destUri = `${FileSystem.documentDirectory}obs_photos/${filename}`;
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}obs_photos`, { intermediates: true });
    await FileSystem.copyAsync({ from: resized.uri, to: destUri });
    setPhotoUris(prev => [...prev, destUri]);
  }

  async function handlePickPhoto() {
    setPhotoError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const { uri, width } = result.assets[0];
    try {
      await addPhoto(uri, width);
    } catch {
      setPhotoError('Could not process photo — please try again.');
    }
  }

  async function handleTakePhoto() {
    setPhotoError('');
    await ImagePicker.requestCameraPermissionsAsync();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const { uri, width } = result.assets[0];
    try {
      await addPhoto(uri, width);
    } catch {
      setPhotoError('Could not process photo — please try again.');
    }
  }

  async function handleSubmit() {
    if (!observationText.trim()) return;
    if (!selectedWorker) { setSubmitError('Please select a field worker.'); return; }
    if (!selectedVillage) { setSubmitError('Please select a village.'); return; }
    setSubmitting(true);
    setSubmitError('');
    const id = uuidv4();

    let gps_lat: number | undefined;
    let gps_lng: number | undefined;
    let gpsTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          gpsTimer = setTimeout(() => reject(new Error('GPS timeout')), 5_000);
        }),
      ]);
      gps_lat = loc.coords.latitude;
      gps_lng = loc.coords.longitude;
    } catch {
      // permission denied, unavailable, or timed out — submit without GPS
    } finally {
      clearTimeout(gpsTimer);
    }

    try {
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
    } catch {
      setSubmitError('Could not save observation — device may be out of storage.');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    navigation.navigate('BlockLeadHome', {
      email: blockLeadEmail,
      justSubmitted: true,
      wasSynced: false,
    });
    syncPending(); // fire and forget — home screen refreshes counts on focus
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <PickerModal
          label="Field Worker"
          value={selectedWorker}
          options={fieldWorkers}
          onSelect={w => { setSelectedWorker(w); setSelectedVillage(''); }}
          loading={loadingWorkers}
          placeholder="Select field worker"
          testID="field-worker-picker"
        />

        <PickerModal
          label="Village"
          value={selectedVillage}
          options={villages}
          onSelect={setSelectedVillage}
          placeholder="Select village"
          disabled={!selectedWorker}
          testID="village-picker"
        />

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

        {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <TouchableOpacity
          style={[styles.submit, (submitting || loadingWorkers) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting || loadingWorkers}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>Submit</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  // Picker selector row
  selector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  selectorDisabled: { backgroundColor: '#f9fafb', opacity: 0.6 },
  selectorValue: { flex: 1, fontSize: 14, color: '#111827' },
  selectorPlaceholder: { flex: 1, fontSize: 14, color: '#9ca3af' },
  chevron: { fontSize: 14, color: '#9ca3af', marginLeft: 8 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32, maxHeight: '70%' },
  modalTitle: { fontSize: 15, fontWeight: '600', color: '#111827', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  modalOptionSelected: { backgroundColor: '#f9fafb' },
  modalOptionText: { flex: 1, fontSize: 14, color: '#374151' },
  modalOptionTextSelected: { color: '#111827', fontWeight: '600' },
  checkmark: { fontSize: 14, color: '#111827', marginLeft: 8 },
  modalCancel: { margin: 16, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, alignItems: 'center' },
  modalCancelText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  // Form fields
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
  submit: { marginTop: 24, marginBottom: 16, backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  error: { marginTop: 12, fontSize: 13, color: '#dc2626', textAlign: 'center' },
});
