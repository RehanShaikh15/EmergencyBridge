import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { CARE_SOURCES, FIRST_AID_GUIDES, IMMEDIATE_STEPS } from '../care';
import { nearbySearchUrl, reportSearchArea, type CarePlace } from '../nearby';
import type { IncidentLocation } from '../types';

type Props = {
  summary: string;
  location: IncidentLocation | null;
  sharing: boolean;
  onShare: () => void;
  onReview: () => void;
};

export function NextSteps({ summary, location, sharing, onShare, onReview }: Props) {
  const [area, setArea] = useState(() => reportSearchArea(location));
  const [locationBusy, setLocationBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const openLink = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert('Could not open the link', 'Check your connection and try again. You can still call 112.'); }
  };

  const search = (kind: CarePlace) => {
    const url = nearbySearchUrl(kind, area);
    if (!url) { setMessage('Enter a city or landmark, or use your device location.'); return; }
    void openLink(url);
  };

  const useCurrentLocation = async () => {
    setLocationBusy(true);
    setMessage('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage('Location access was not granted. Enter a city or landmark above.');
        return;
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')), 12_000); }),
      ]);
      setArea(`${position.coords.latitude}, ${position.coords.longitude}`);
      setMessage(`Searching around your device location${position.coords.accuracy ? ` · approximate accuracy ±${Math.round(position.coords.accuracy)} m` : ''}.`);
    } catch { setMessage('Device location is unavailable. Enter a city or landmark above.'); }
    finally { if (timeout) clearTimeout(timeout); setLocationBusy(false); }
  };

  return <View>
    <View style={s.approvedCard}>
      <View style={s.approvedHeading}><View style={s.check}><Text style={s.checkText}>✓</Text></View><View><Text style={s.eyebrow}>REVIEW COMPLETE</Text><Text style={s.approvedTitle}>Report approved by you</Text></View></View>
      <Text style={s.summary} numberOfLines={3}>{summary}</Text>
      <Pressable onPress={onShare} disabled={sharing} accessibilityRole="button" style={({ pressed }) => [s.shareButton, pressed && s.pressed]}>
        {sharing ? <ActivityIndicator color="#FFFFFF" /> : null}<Text style={s.shareText}>{sharing ? 'Opening share options…' : 'Share approved report  ↗'}</Text>
      </Pressable>
      <Pressable onPress={onReview} accessibilityRole="button" style={s.reviewButton}><Text style={s.reviewText}>Review or change report</Text></Pressable>
    </View>

    <Text style={s.eyebrow}>RIGHT NOW</Text>
    <Text style={s.heading}>Start with these steps</Text>
    <View style={s.card}>
      {IMMEDIATE_STEPS.map((step, index) => <View key={step.title} style={[s.step, index > 0 && s.stepBorder]}><View style={s.number}><Text style={s.numberText}>{index + 1}</Text></View><View style={s.flex}><Text style={s.title}>{step.title}</Text><Text style={s.body}>{step.text}</Text></View></View>)}
      <Pressable onPress={() => openLink(CARE_SOURCES.general.url)} accessibilityRole="link" style={s.sourceButton}><Text style={s.source}>Source: American Red Cross · First aid steps ↗</Text></Pressable>
    </View>

    <Text style={s.eyebrow}>IF YOU OBSERVE THESE SIGNS</Text>
    <Text style={s.heading}>Basic first aid</Text>
    <Text style={s.caption}>Choose what matches what you see. Follow the 112 dispatcher’s instructions.</Text>
    {FIRST_AID_GUIDES.map(guide => <View key={guide.id} style={s.guideCard}>
      <Pressable onPress={() => setExpanded(expanded === guide.id ? null : guide.id)} accessibilityRole="button" accessibilityState={{ expanded: expanded === guide.id }} style={s.guideHeader}>
        <Text style={s.guideTitle}>{guide.title}</Text><Text style={s.expand}>{expanded === guide.id ? '−' : '+'}</Text>
      </Pressable>
      {expanded === guide.id ? <View style={s.guideBody}>{guide.steps.map((text, index) => <View style={s.guideStep} key={text}><Text style={s.guideNumber}>{index + 1}.</Text><Text style={[s.body, s.flex]}>{text}</Text></View>)}<Pressable onPress={() => openLink(guide.source.url)} accessibilityRole="link" style={s.sourceButton}><Text style={s.source}>{guide.source.label} ↗</Text></Pressable></View> : null}
    </View>)}
    <View style={s.caution}><Text style={s.cautionTitle}>After a fall or collision</Text><Text style={s.cautionText}>If a neck or back injury is possible, avoid moving the person unless they are in immediate danger or movement is necessary for lifesaving care. Follow the dispatcher.</Text><Pressable onPress={() => openLink(CARE_SOURCES.spinal.url)} accessibilityRole="link"><Text style={s.cautionSource}>St John Ambulance · Spinal injury ↗</Text></Pressable></View>

    <Text style={s.eyebrow}>FIND CARE NEARBY</Text>
    <Text style={s.heading}>Hospitals & medical shops</Text>
    <Text style={s.caption}>Open Maps to find facilities around your chosen location.</Text>
    <View style={s.card}>
      <Text style={s.inputLabel}>SEARCH AROUND</Text>
      <TextInput value={area} onChangeText={value => { setArea(value); setMessage(''); }} maxLength={300} placeholder="City, landmark or address" placeholderTextColor="#95A1B2" accessibilityLabel="Location for nearby hospital and pharmacy searches" style={s.input} />
      <Pressable onPress={useCurrentLocation} disabled={locationBusy} accessibilityRole="button" style={s.deviceButton}>{locationBusy ? <ActivityIndicator color="#168F83" /> : <Text style={s.deviceText}>◎  Use my device location</Text>}</Pressable>
      {message ? <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text> : null}
      <Pressable onPress={() => search('hospital')} accessibilityRole="button" style={({ pressed }) => [s.placeButton, pressed && s.pressed]}><View style={[s.placeIcon, { backgroundColor: '#FFF0F1' }]}><Text style={s.hospitalIcon}>+</Text></View><View style={s.flex}><Text style={s.title}>Find nearby hospitals</Text><Text style={s.small}>Search for hospital emergency departments</Text></View><Text style={s.arrow}>↗</Text></Pressable>
      <Pressable onPress={() => search('pharmacy')} accessibilityRole="button" style={({ pressed }) => [s.placeButton, pressed && s.pressed]}><View style={s.placeIcon}><Text style={s.pharmacyIcon}>+</Text></View><View style={s.flex}><Text style={s.title}>Find medical shops</Text><Text style={s.small}>Search for pharmacies and first-aid supplies</Text></View><Text style={s.arrow}>↗</Text></Pressable>
      <Text style={s.small}>Confirm hours and emergency services with the facility. Map listings do not confirm beds or availability. Do not delay emergency care to visit a shop.</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, pressed: { opacity: 0.8 },
  approvedCard: { padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE8DF', marginBottom: 25 }, approvedHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, check: { width: 38, height: 38, backgroundColor: '#E6F6F2', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, checkText: { color: '#168F83', fontSize: 21, fontWeight: '800' }, approvedTitle: { fontSize: 15, color: '#111D32', fontWeight: '800', marginTop: 3 }, summary: { color: '#617087', fontSize: 12, lineHeight: 18, marginTop: 12 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: '#168F83', letterSpacing: 1 }, heading: { color: '#111D32', fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 5, marginBottom: 9 }, caption: { color: '#748198', fontSize: 12, lineHeight: 18, marginBottom: 13 },
  shareButton: { minHeight: 48, backgroundColor: '#168F83', borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 14, flexDirection: 'row', gap: 8 }, shareText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, reviewButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, reviewText: { color: '#168F83', fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, borderColor: '#E7EBF2', borderWidth: 1, marginBottom: 24 }, step: { flexDirection: 'row', gap: 10, paddingVertical: 11 }, stepBorder: { borderTopWidth: 1, borderTopColor: '#EDF0F5' }, number: { width: 25, height: 25, borderRadius: 9, backgroundColor: '#EDF2FF', alignItems: 'center', justifyContent: 'center' }, numberText: { color: '#4D7CF3', fontSize: 11, fontWeight: '800' }, title: { fontSize: 12, fontWeight: '800', color: '#111D32' }, body: { fontSize: 12, lineHeight: 18, color: '#617087', marginTop: 4 }, sourceButton: { minHeight: 44, justifyContent: 'center' }, source: { color: '#168F83', fontSize: 10, lineHeight: 15, fontWeight: '600' },
  guideCard: { backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E7EBF2', marginBottom: 9 }, guideHeader: { minHeight: 56, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, guideTitle: { color: '#111D32', fontSize: 12, fontWeight: '800', flex: 1 }, expand: { color: '#168F83', fontSize: 21 }, guideBody: { paddingHorizontal: 13 }, guideStep: { flexDirection: 'row', gap: 8, marginBottom: 8 }, guideNumber: { color: '#168F83', fontWeight: '800', marginTop: 5, fontSize: 12 },
  caution: { backgroundColor: '#FFF6E7', borderRadius: 13, padding: 13, marginTop: 3, marginBottom: 25 }, cautionTitle: { color: '#805B24', fontSize: 12, fontWeight: '800' }, cautionText: { color: '#896A3F', fontSize: 11, lineHeight: 17, marginTop: 5 }, cautionSource: { color: '#805B24', fontSize: 10, lineHeight: 16, paddingVertical: 10 },
  inputLabel: { color: '#748198', fontSize: 9, letterSpacing: 0.8, fontWeight: '800', marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#E0E6F0', backgroundColor: '#F8FAFE', borderRadius: 11, minHeight: 45, padding: 11, fontSize: 12, color: '#111D32' }, deviceButton: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' }, deviceText: { color: '#168F83', fontSize: 12, fontWeight: '700' }, message: { color: '#748198', fontSize: 11, lineHeight: 16, marginBottom: 9 }, placeButton: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#E7EBF2', paddingVertical: 13 }, placeIcon: { width: 35, height: 35, backgroundColor: '#E6F6F2', borderRadius: 11, justifyContent: 'center', alignItems: 'center' }, hospitalIcon: { fontSize: 24, color: '#F04452', fontWeight: '800' }, pharmacyIcon: { fontSize: 24, color: '#168F83', fontWeight: '800' }, small: { color: '#748198', fontSize: 10, lineHeight: 15, marginTop: 4 }, arrow: { fontSize: 18, color: '#748198' },
});
