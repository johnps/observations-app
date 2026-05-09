import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, ScrollView,
  Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { File, Directory, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { queueObservation } from '../lib/db';
import type { PendingObservation } from '../types/observation';
import { syncPending } from '../lib/sync';
import { useHierarchy } from '../lib/useHierarchy';

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
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [observationText, setObservationText] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [isConnected, setIsConnected] = useState(true);

  const { fieldWorkers, villages } = useHierarchy(blockLeadEmail, selectedWorker);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'acquired' | 'unavailable'>('acquiring');

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(() => {
      Location.getCurrentPositionAsync({}).then(loc => {
        if (loc) {
          locationRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          console.log('[form] gps acquired', locationRef.current.latitude, locationRef.current.longitude);
          setGpsStatus('acquired');
        } else {
          setGpsStatus('unavailable');
        }
      }).catch(err => {
        console.log('[form] gps error', String(err));
        setGpsStatus('unavailable');
      });
    });
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  async function addPhoto(uri: string, width: number) {
    const context = ImageManipulator.manipulate(uri);
    // width can be 0 on Android when the system doesn't provide dimensions;
    // passing 0 to the native resize throws an IllegalArgumentException.
    context.resize({ width: width > 0 ? Math.min(width, 1280) : 1280 });
    const ref = await context.renderAsync();
    const resized = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const obsPhotosDir = new Directory(Paths.document, 'obs_photos');
    obsPhotosDir.create({ intermediates: true, idempotent: true });
    const destFile = new File(obsPhotosDir, filename);
    new File(resized.uri).copy(destFile);
    setPhotoUris(prev => [...prev, destFile.uri]);
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
    } catch (err) {
      console.error('[photo-process] gallery:', err);
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
    } catch (err) {
      console.error('[photo-process] camera:', err);
      setPhotoError('Could not process photo — please try again.');
    }
  }

  async function handleSubmit() {
    if (!observationText.trim()) { setSubmitError('Please write an observation.'); return; }
    if (!selectedWorker) { setSubmitError('Please select a field worker.'); return; }
    if (!selectedVillage) { setSubmitError('Please select a village.'); return; }
    setSubmitting(true);
    setSubmitError('');
    const id = Crypto.randomUUID();
    console.log('[submit] start', id);

    const gps_lat = locationRef.current?.latitude;
    const gps_lng = locationRef.current?.longitude;
    console.log('[submit] gps done', locationRef.current ? 'got fix' : 'no fix');

    try {
      const obs: PendingObservation = {
        id,
        text: observationText,
        field_worker_name: selectedWorker,
        village_name: selectedVillage,
        block_lead_email: blockLeadEmail,
        photo_uris: photoUris,
        gps_lat,
        gps_lng,
        submitted_at: new Date().toISOString(),
      };
      console.log('[submit] queuing');
      queueObservation(obs);
      console.log('[submit] queued ok');
    } catch (err) {
      console.log('[submit] queue error', String(err));
      setSubmitError('Could not save observation — device may be out of storage.');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    navigation.navigate('BlockLeadHome', {
      email: blockLeadEmail,
      submitKey: Date.now(),
      isOnline: isConnected,
    });
    console.log('[submit] done');
    syncPending(); // fire and forget — home screen polls pending count and will reflect result
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
        <Text style={styles.gpsStatus}>
          {gpsStatus === 'acquiring' ? 'Acquiring GPS…'
            : gpsStatus === 'acquired' ? 'GPS acquired'
            : 'GPS unavailable — observation will be submitted without location'}
        </Text>
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
  gpsStatus: { marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  submit: { marginTop: 8, marginBottom: 16, backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  error: { marginTop: 12, fontSize: 13, color: '#dc2626', textAlign: 'center' },
});
