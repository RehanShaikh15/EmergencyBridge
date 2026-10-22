import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useAnimatedValue,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { analyzeEmergency } from '../api';
import type { IncidentLocation, IncidentReport } from '../types';
import { NextSteps } from '../components/next-steps';

const C = {
  ink: '#111D32', navy: '#101B2E', muted: '#748198', paper: '#F5F7FB', white: '#FFFFFF',
  red: '#F04452', redDark: '#D92F40', coralPale: '#FFF0F1', teal: '#168F83', tealPale: '#E6F6F2',
  line: '#E7EBF2', blue: '#4D7CF3', bluePale: '#EDF2FF', amber: '#AE6B11', amberPale: '#FFF6E7',
};

const workflow = ['Capture', 'Location', 'Review', 'Next steps'];

function Stepper({ active }: { active: number }) {
  return (
    <View style={styles.stepper} accessibilityLabel={`Step ${active + 1} of 4: ${workflow[active]}`}>
      {workflow.map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View style={[styles.stepDot, index <= active && styles.stepDotActive]}>
            <Text style={[styles.stepNumber, index <= active && styles.stepNumberActive]}>{index < active ? '✓' : index + 1}</Text>
          </View>
          <Text style={[styles.stepLabel, index === active && styles.stepLabelActive]}>{step}</Text>
          {index < workflow.length - 1 && <View style={[styles.stepLine, index < active && styles.stepLineActive]} />}
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <View style={styles.sectionTitle}>
    <Text style={styles.eyebrow}>{eyebrow}</Text>
    <Text style={styles.sectionHeading}>{title}</Text>
    {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
  </View>;
}

function CallDock() {
  const call = async () => {
    try {
      const url = 'tel:112';
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Unable to open the dialer', 'Please call 112 directly from your phone.');
    } catch {
      Alert.alert('Unable to open the dialer', 'Please call 112 directly from your phone.');
    }
  };
  return <View style={styles.dock}>
    <Pressable onPress={call} accessibilityRole="button" accessibilityLabel="Call emergency number 112" style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
      <Text style={styles.callIcon}>↗</Text>
      <Text style={styles.callText}>Call 112</Text>
      <Text style={styles.callSubtext}>Emergency services</Text>
    </Pressable>
    <Text style={styles.dockNote}>Call first if anyone is in immediate danger.</Text>
  </View>;
}

export default function HomeScreen() {
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [coordinates, setCoordinates] = useState<IncidentLocation | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('Add a landmark or use your device location.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [approved, setApproved] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [sharing, setSharing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const fade = useAnimatedValue(0);
  const lift = useAnimatedValue(10);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      lift.setValue(0);
      return;
    }
    fade.setValue(0);
    lift.setValue(10);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, speed: 16, bounciness: 3, useNativeDriver: true }),
    ]).start();
  }, [fade, lift, reduceMotion, report, approved]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
  }, [report, approved, reduceMotion]);

  const getLocation = async () => {
    setLocationBusy(true);
    setLocationMessage('Checking device location…');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationMessage('Location permission not granted. You can enter a landmark below.');
        return;
      }
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Location request timed out')), 12_000);
        }),
      ]).finally(() => { if (timeout) clearTimeout(timeout); });
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
      });
      setLocationMessage(`Device location added${position.coords.accuracy ? ` · approx. ±${Math.round(position.coords.accuracy)} m` : ''}`);
    } catch {
      setLocationMessage('Could not get a device location. Enter a nearby landmark instead.');
    } finally {
      setLocationBusy(false);
    }
  };

  const choosePhoto = async (camera: boolean) => {
    setError('');
    setPhotoBusy(true);
    try {
      if (camera && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera access is needed to take a photo. You can choose a photo or describe the incident instead.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const scale = Math.min(1, 1280 / Math.max(asset.width, asset.height));
      const manipulator = ImageManipulator.manipulate(asset.uri);
      manipulator.resize({ width: Math.max(1, Math.round(asset.width * scale)) });
      const rendered = await manipulator.renderAsync();
      const image = await rendered.saveAsync({ compress: 0.65, format: SaveFormat.JPEG, base64: true });
      rendered.release();
      manipulator.release();
      if (!image.base64 || image.base64.length > 4_194_304) {
        setError('This photo is too large. Try a smaller or closer photo.');
        return;
      }
      setPhoto({ uri: image.uri, base64: image.base64 });
    } catch {
      setError('Could not open or prepare the photo. Try again or describe what happened.');
    } finally { setPhotoBusy(false); }
  };

  const generate = async () => {
    Keyboard.dismiss();
    setError('');
    if (!description.trim() && !photo) { setError('Take a photo or add a short description to prepare a report.'); return; }
    if (description.trim().length > 1000) { setError('Keep the description under 1,000 characters.'); return; }
    setBusy(true);
    try {
      const location = {
        ...(coordinates ?? {}),
        manual_text: manualLocation.trim() || null,
      };
      const result = await analyzeEmergency({ description: description.trim(), location, ...(photo ? { photo: { base64: photo.base64, mime_type: 'image/jpeg' as const } } : {}) });
      setReport(result);
      setApproved(false);
      setEditedSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed. You can still call 112.');
    } finally {
      setBusy(false);
    }
  };

  const shareReport = async () => {
    if (!report || !approved) return;
    const loc = report.location ?? coordinates;
    const mapLink = loc?.latitude != null && loc.longitude != null
      ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}` : '';
    const locationText = loc?.manual_text || manualLocation.trim() || mapLink || 'Not provided';
    const message = [
      'EMERGENCYBRIDGE · INCIDENT REPORT',
      editedSummary.trim(),
      `Incident type: ${report.incident_type.replaceAll('_', ' ')}`,
      `People: ${report.people_count ?? 'Unknown'}`,
      `Reported observations: ${report.observed_conditions.length ? report.observed_conditions.join('; ') : 'None provided'}`,
      `Location: ${locationText}`,
      mapLink && locationText !== mapLink ? `Map: ${mapLink}` : '',
      `Unknown / missing: ${report.missing_information.length ? report.missing_information.join(', ') : 'Not specified'}`,
      '', 'AI-assisted summary; please verify details. For emergencies, call 112.',
    ].filter(Boolean).join('\n');
    try {
      setSharing(true);
      await Share.share({ message, title: 'EmergencyBridge incident report' });
    } catch {
      Alert.alert('Could not open sharing', 'You can read the reviewed summary to the dispatcher.');
    } finally { setSharing(false); }
  };

  const approveReport = () => {
    if (!editedSummary.trim()) { setError('Add a summary before approving the report.'); return; }
    Keyboard.dismiss();
    setError('');
    setApproved(true);
  };
  const reset = () => { setApproved(false); setReport(null); setEditedSummary(''); setError(''); };
  const currentStep = approved ? 3 : report ? 2 : 0;
  const locationLabel = report?.location?.manual_text || manualLocation.trim() || (coordinates ? 'Device coordinates attached' : 'Not provided');

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
    <View style={styles.topBand}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>E</Text></View>
        <View><Text style={styles.brandName}>EmergencyBridge</Text><Text style={styles.brandTag}>CLEAR INFORMATION. FASTER CONVERSATIONS.</Text></View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>READY</Text></View>
      </View>
      <Text style={styles.heroTitle}>{approved ? 'A clear next step.' : report ? 'Your report is ready.' : 'Help starts with\na clear report.'}</Text>
      <Text style={styles.heroCopy}>{approved ? 'Practical help, nearby care, and your reviewed report.' : report ? 'Check every detail before you approve it.' : 'Turn what you see into useful information for emergency services.'}</Text>
      <View style={styles.heroGlow} />
    </View>

    <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }] }}>
        <Stepper active={currentStep} />
        {!report ? <>
          <SectionTitle eyebrow="STEP 01 · WHAT HAPPENED?" title="Show us what happened" detail="Take a photo or describe the incident. You can use either." />
          <View style={styles.photoCard}>
            {photo ? <Image source={{ uri: photo.uri }} style={styles.photoPreview} accessibilityLabel="Incident photo preview" /> : <View style={styles.cameraIntro}><Text style={styles.cameraGlyph}>◎</Text><Text style={styles.cameraTitle}>A photo can tell the story</Text><Text style={styles.cameraCopy}>Capture visible details, then review the AI report.</Text></View>}
            <View style={styles.photoActions}>
              <Pressable onPress={() => choosePhoto(true)} disabled={photoBusy || busy} accessibilityRole="button" style={styles.captureButton}>{photoBusy ? <ActivityIndicator color={C.white} /> : <Text style={styles.captureText}>{photo ? 'Retake photo' : 'Take a photo'}</Text>}</Pressable>
              <Pressable onPress={() => choosePhoto(false)} disabled={photoBusy || busy} accessibilityRole="button" style={styles.photoSecondary}><Text style={styles.photoSecondaryText}>Choose photo</Text></Pressable>
              {photo ? <Pressable onPress={() => setPhoto(null)} disabled={busy} accessibilityRole="button" style={styles.photoSecondary}><Text style={styles.photoRemoveText}>Remove</Text></Pressable> : null}
            </View>
            <Text style={styles.photoDisclosure}>Your photo is sent to NVIDIA AI when you prepare the report. It is not included when sharing.</Text>
          </View>
          <Text style={styles.descriptionLabel}>{photo ? 'ADD DETAILS · OPTIONAL' : 'OR DESCRIBE WHAT HAPPENED'}</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.descriptionInput}
              placeholder={'Example: A motorcycle crashed near the college gate. Two people are hurt; one is not responding.'}
              placeholderTextColor="#9AA4B5"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              maxLength={1000}
              accessibilityLabel="Describe what happened"
            />
            <View style={styles.inputFooter}><Text style={styles.inputHint}>Only share what you observed</Text><Text style={styles.charCount}>{description.length}/1000</Text></View>
          </View>

          <View style={styles.locationHeader}>
            <View style={styles.locationIcon}><Text style={styles.locationIconText}>⌖</Text></View>
            <View style={styles.locationTitleWrap}><Text style={styles.cardTitle}>Add a location</Text><Text style={styles.cardCaption}>Optional · helps people find the incident</Text></View>
          </View>
          <Pressable onPress={getLocation} disabled={locationBusy} style={({ pressed }) => [styles.locationAction, pressed && styles.pressed]}>
            {locationBusy ? <ActivityIndicator color={C.teal} /> : <Text style={styles.gpsIcon}>◎</Text>}
            <View style={{ flex: 1 }}><Text style={styles.locationActionTitle}>{coordinates ? 'Refresh device location' : 'Use my location'}</Text><Text style={styles.locationActionCaption}>{locationMessage}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.manualWrap}><Text style={styles.orLabel}>OR ADD A LANDMARK</Text><TextInput style={styles.manualInput} value={manualLocation} onChangeText={setManualLocation} placeholder="Street, landmark, or nearby place" placeholderTextColor="#9AA4B5" accessibilityLabel="Enter a landmark or address" /></View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorIcon}>!</Text><Text style={styles.errorText}>{error}</Text></View> : null}

          <Pressable onPress={generate} disabled={busy || photoBusy} accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && !busy && styles.pressed, (busy || photoBusy) && styles.buttonDisabled]}>
            {busy ? <><ActivityIndicator color={C.white} /><Text style={styles.primaryButtonText}>{photo ? 'Reading your photo…' : 'Preparing your report…'}</Text></> : <><Text style={styles.primaryButtonText}>{photo ? 'Generate report from photo' : 'Prepare my report'}</Text><Text style={styles.primaryArrow}>→</Text></>}
          </Pressable>
          <Text style={styles.helperNote}>You’ll review and edit everything before sharing.</Text>
        </> : approved ? <NextSteps summary={editedSummary.trim()} location={report.location} sharing={sharing} onShare={shareReport} onReview={() => { setApproved(false); setError(''); }} /> : <>
          <SectionTitle eyebrow="STEP 03 · REVIEW BEFORE APPROVAL" title="Your incident report" detail="Check the summary and reported details. Approve to see nearby care and basic first-aid steps." />
          <View style={styles.reportCard}>
            <View style={styles.reportTop}><View style={styles.reportIcon}><Text style={styles.reportIconText}>✳</Text></View><View style={{ flex: 1 }}><Text style={styles.reportEyebrow}>AI-ASSISTED SUMMARY</Text><Text style={styles.reportType}>{report.incident_type.replaceAll('_', ' ')}</Text></View><View style={styles.reviewPill}><Text style={styles.reviewPillText}>REVIEW</Text></View></View>
            <TextInput value={editedSummary} onChangeText={setEditedSummary} multiline textAlignVertical="top" style={styles.summaryEditor} accessibilityLabel="Edit incident report summary" />
            <Text style={styles.editHint}>Tap the summary to make corrections</Text>
          </View>
          <View style={styles.factGrid}>
            <View style={styles.factCard}><Text style={styles.factLabel}>PEOPLE REPORTED</Text><Text style={styles.factValue}>{report.people_count ?? 'Unknown'}</Text></View>
            <View style={styles.factCard}><Text style={styles.factLabel}>LOCATION</Text><Text style={styles.factValueSmall}>{locationLabel}</Text></View>
          </View>
          <View style={styles.breathingRow}><Text style={styles.breathingLabel}>BREATHING STATUS</Text><Text style={styles.breathingValue}>{report.breathing_status === 'reported_breathing' ? 'Reported breathing' : report.breathing_status === 'reported_not_breathing' ? 'Reported not breathing' : 'Unknown'}</Text></View>
          <View style={styles.observationCard}>
            <Text style={styles.cardTitle}>Reported observations</Text>
            {report.observed_conditions.length ? report.observed_conditions.map((item, i) => <View key={`${i}-${item}`} style={styles.observationRow}><View style={styles.observationDot} /><Text style={styles.observationText}>{item}</Text></View>) : <Text style={styles.unknownText}>No observations extracted.</Text>}
          </View>
          <View style={styles.unknownCard}><View style={styles.unknownBadge}><Text style={styles.unknownBadgeText}>?</Text></View><View style={{ flex: 1 }}><Text style={styles.unknownTitle}>Still unknown</Text><Text style={styles.unknownCopy}>{report.missing_information.length ? report.missing_information.join(' · ') : 'No missing information was identified.'}</Text></View></View>
          <View style={styles.safetyNote}><Text style={styles.safetyMark}>i</Text><Text style={styles.safetyText}>This summary contains reported observations, not a diagnosis. Verify details before sharing.</Text></View>
          {error ? <View style={styles.errorBox}><Text style={styles.errorIcon}>!</Text><Text style={styles.errorText}>{error}</Text></View> : null}
          <Pressable onPress={approveReport} accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.shareIcon}>✓</Text>
            <Text style={styles.primaryButtonText}>Approve & see next steps</Text>
          </Pressable>
          <Pressable onPress={reset} style={styles.editButton}><Text style={styles.editButtonText}>←  Edit incident details</Text></Pressable>
        </>}
      </Animated.View>
      <View style={styles.footer}><Text style={styles.footerText}>EmergencyBridge prepares information. It does not contact or dispatch responders.</Text></View>
    </ScrollView>
    <CallDock />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  topBand: { backgroundColor: C.navy, paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 26, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 100, backgroundColor: 'rgba(73,126,219,0.15)', right: -85, bottom: -100 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: C.white, fontSize: 22, fontWeight: '900' }, brandName: { color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  brandTag: { color: '#A8B5C8', fontSize: 7.5, fontWeight: '700', letterSpacing: 1.15, marginTop: 3 },
  liveBadge: { marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 30, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }, liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#5BE0B4' }, liveText: { color: '#D6E3F0', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  heroTitle: { color: C.white, fontSize: 29, fontWeight: '800', lineHeight: 35, letterSpacing: -0.7, marginTop: 23 }, heroCopy: { color: '#BAC6D8', fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 310 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  stepper: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, marginBottom: 25 }, stepItem: { flex: 1, flexDirection: 'column', alignItems: 'center', position: 'relative' }, stepDot: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#E7EBF2', alignItems: 'center', justifyContent: 'center', zIndex: 1 }, stepDotActive: { backgroundColor: C.navy }, stepNumber: { fontSize: 10, color: '#8994A6', fontWeight: '800' }, stepNumberActive: { color: C.white }, stepLabel: { marginTop: 6, color: '#9AA4B5', fontSize: 9, fontWeight: '600' }, stepLabelActive: { color: C.ink, fontWeight: '800' }, stepLine: { position: 'absolute', height: 2, backgroundColor: '#E7EBF2', top: 11, left: '60%', width: '80%' }, stepLineActive: { backgroundColor: C.teal },
  sectionTitle: { marginBottom: 15 }, eyebrow: { fontSize: 9, fontWeight: '800', color: C.teal, letterSpacing: 1.1 }, sectionHeading: { color: C.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.45, marginTop: 5 }, sectionDetail: { fontSize: 12, color: C.muted, lineHeight: 17, marginTop: 5 },
  inputCard: { backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.line, padding: 14, shadowColor: '#182643', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, descriptionInput: { minHeight: 107, color: C.ink, fontSize: 14, lineHeight: 21, padding: 0 }, inputFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F0F2F6' }, inputHint: { color: C.muted, fontSize: 10 }, charCount: { color: '#A5AFBD', fontSize: 10, fontWeight: '600' },
  photoCard: { backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: '#D5E9E4', padding: 13, marginBottom: 17 }, photoPreview: { width: '100%', height: 190, borderRadius: 12, backgroundColor: C.line }, cameraIntro: { backgroundColor: C.tealPale, borderRadius: 12, paddingVertical: 20, paddingHorizontal: 12, alignItems: 'center' }, cameraGlyph: { fontSize: 34, color: C.teal, marginBottom: 5 }, cameraTitle: { color: C.ink, fontSize: 15, fontWeight: '800' }, cameraCopy: { color: '#55786F', fontSize: 11, marginTop: 5, textAlign: 'center', lineHeight: 16 }, photoActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11, flexWrap: 'wrap' }, captureButton: { backgroundColor: C.teal, minHeight: 44, minWidth: 112, borderRadius: 11, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' }, captureText: { color: C.white, fontSize: 12, fontWeight: '800' }, photoSecondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 3 }, photoSecondaryText: { color: C.teal, fontSize: 11, fontWeight: '800' }, photoRemoveText: { color: C.redDark, fontSize: 11, fontWeight: '700' }, photoDisclosure: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 9 }, descriptionLabel: { color: C.muted, fontWeight: '800', fontSize: 9, letterSpacing: 0.8, marginBottom: 9 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 23, marginBottom: 11 }, locationIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: C.tealPale, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, locationIconText: { color: C.teal, fontSize: 22, lineHeight: 26 }, locationTitleWrap: { flex: 1 }, cardTitle: { color: C.ink, fontSize: 13, fontWeight: '800' }, cardCaption: { color: C.muted, fontSize: 10, marginTop: 3 },
  locationAction: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10 }, gpsIcon: { color: C.teal, fontSize: 23, width: 25, textAlign: 'center' }, locationActionTitle: { color: C.ink, fontWeight: '700', fontSize: 12 }, locationActionCaption: { color: C.muted, fontSize: 9.5, marginTop: 3, lineHeight: 14 }, chevron: { color: '#9AA4B5', fontSize: 24, paddingHorizontal: 2 },
  manualWrap: { marginTop: 11 }, orLabel: { color: '#8B96A7', fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginBottom: 7 }, manualInput: { height: 45, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, color: C.ink, fontSize: 12 },
  primaryButton: { minHeight: 53, backgroundColor: C.teal, borderRadius: 15, paddingHorizontal: 17, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: C.teal, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, primaryButtonText: { color: C.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.1 }, primaryArrow: { color: C.white, fontSize: 20, fontWeight: '500', position: 'absolute', right: 17 }, shareIcon: { color: C.white, fontSize: 16, fontWeight: '800' }, buttonDisabled: { opacity: 0.8 }, pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] }, helperNote: { textAlign: 'center', color: C.muted, fontSize: 10, marginTop: 9 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.coralPale, borderColor: '#F7C9CD', borderWidth: 1, padding: 11, borderRadius: 12, marginTop: 12 }, errorIcon: { color: C.redDark, fontWeight: '900', fontSize: 14 }, errorText: { color: '#8E3340', flex: 1, fontSize: 11, lineHeight: 16 },
  reportCard: { backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 17, padding: 15, shadowColor: '#182643', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, reportTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, reportIcon: { width: 35, height: 35, backgroundColor: C.bluePale, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, reportIconText: { color: C.blue, fontSize: 19 }, reportEyebrow: { color: C.muted, fontWeight: '800', fontSize: 8, letterSpacing: 0.8 }, reportType: { color: C.ink, textTransform: 'capitalize', fontWeight: '800', fontSize: 13, marginTop: 3 }, reviewPill: { backgroundColor: C.amberPale, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 20 }, reviewPillText: { color: C.amber, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }, summaryEditor: { minHeight: 96, borderRadius: 11, borderWidth: 1, borderColor: '#DFE7F5', backgroundColor: '#F8FAFE', padding: 11, color: C.ink, fontSize: 13, lineHeight: 19 }, editHint: { color: '#8994A6', fontSize: 9, marginTop: 7 },
  factGrid: { flexDirection: 'row', gap: 10, marginTop: 11 }, factCard: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 12, minHeight: 65 }, factLabel: { fontSize: 8, fontWeight: '800', color: C.muted, letterSpacing: 0.6 }, factValue: { color: C.ink, fontSize: 15, fontWeight: '800', marginTop: 7 }, factValueSmall: { color: C.ink, fontSize: 10, fontWeight: '700', marginTop: 7 },
  breathingRow: { backgroundColor: C.bluePale, borderRadius: 11, marginTop: 9, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, breathingLabel: { color: '#65749A', fontSize: 8, fontWeight: '800', letterSpacing: 0.6 }, breathingValue: { color: '#344A83', fontSize: 10, fontWeight: '800' },
  observationCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13, marginTop: 11 }, observationRow: { flexDirection: 'row', gap: 8, marginTop: 9, alignItems: 'flex-start' }, observationDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.teal, marginTop: 5 }, observationText: { color: '#526078', fontSize: 11, lineHeight: 16, flex: 1 }, unknownText: { color: C.muted, fontSize: 11, marginTop: 7 }, unknownCard: { backgroundColor: C.amberPale, borderRadius: 13, padding: 12, marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, unknownBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FCE7C5', alignItems: 'center', justifyContent: 'center' }, unknownBadgeText: { color: C.amber, fontSize: 13, fontWeight: '900' }, unknownTitle: { color: '#7A521D', fontSize: 11, fontWeight: '800' }, unknownCopy: { color: '#896A3F', fontSize: 10, lineHeight: 15, marginTop: 3 },
  safetyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 11, paddingHorizontal: 2 }, safetyMark: { color: C.blue, width: 17, height: 17, borderRadius: 9, textAlign: 'center', overflow: 'hidden', backgroundColor: C.bluePale, fontSize: 11, fontWeight: '900' }, safetyText: { color: C.muted, fontSize: 10, lineHeight: 15, flex: 1 }, editButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, editButtonText: { color: C.teal, fontSize: 12, fontWeight: '800' },
  footer: { paddingTop: 17, paddingBottom: 9 }, footerText: { textAlign: 'center', color: '#9AA4B5', fontSize: 9, lineHeight: 14 },
  dock: { backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, borderTopWidth: 1, borderTopColor: C.line, shadowColor: '#17243B', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: -3 }, elevation: 8 }, callButton: { minHeight: 48, borderRadius: 14, backgroundColor: C.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, callIcon: { color: C.white, fontSize: 18, fontWeight: '800' }, callText: { color: C.white, fontSize: 14, fontWeight: '900' }, callSubtext: { color: '#FFE1E3', fontSize: 10, marginLeft: 2 }, dockNote: { color: C.muted, textAlign: 'center', fontSize: 9, marginTop: 6, marginBottom: 1 },
});
