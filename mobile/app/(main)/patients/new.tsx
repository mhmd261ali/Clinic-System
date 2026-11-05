import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '../../../components/Screen';
import { Banner, Button, Chip, DateField, Field, PageTitle, font } from '../../../components/ui';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { isClinician } from '../../../lib/permissions';
import { GENDERS, PAYER_TYPES, hasSessionQuota, todayISO } from '../../../lib/format';
import { useTherapies } from '../../../lib/therapies';
import type { Doctor } from '../../../lib/types';

export default function NewPatientScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const lockedTherapy = user && isClinician(user.role) ? user.therapyType ?? null : null;
  const therapies = useTherapies();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<(typeof GENDERS)[number] | null>(null);
  const [patientType, setPatientType] = useState<(typeof PAYER_TYPES)[number]>('Private');
  const [sessionsAllotted, setSessionsAllotted] = useState('');
  const [therapy, setTherapy] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lockedTherapy) setTherapy(lockedTherapy);
    api.doctors().then((data) => setDoctors(data.doctors)).catch(() => setError('Could not load the doctors.'));
  }, [lockedTherapy]);

  function chooseTherapy(item: string) {
    setTherapy(item);
    setDoctorId((current) => (doctors.some((doctor) => doctor.id === current && doctor.therapyType === item) ? current : null));
  }

  async function submit() {
    if (name.trim().length < 2) {
      setError('Enter the patient name.');
      return;
    }
    if (phone.trim().length < 3) {
      setError('Enter a phone number.');
      return;
    }
    if (!gender) {
      setError('Choose male or female.');
      return;
    }
    if (!therapy || !doctorId) {
      setError('Choose a therapy and one of its doctors.');
      return;
    }
    const covered = hasSessionQuota(patientType);
    const allotted = covered ? Number(sessionsAllotted.trim()) : null;
    if (covered && (!Number.isInteger(allotted) || (allotted ?? 0) < 0 || sessionsAllotted.trim() === '')) {
      setError('Enter how many sessions this cover includes.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.createPatient({
        fullName: name.trim(),
        phone: phone.trim(),
        dateOfBirth: dob || null,
        gender,
        patientType,
        sessionsAllotted: allotted,
        therapyType: therapy,
        doctorId,
        notes: notes.trim() || null,
      });
      router.replace({ pathname: '/patients/[id]', params: { id: String(result.patient.id) } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the patient.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} className="mb-4 self-start">
        <Text style={font.medium} className="text-sm text-moss">
          Back to patients
        </Text>
      </Pressable>
      <PageTitle kicker="Patients" title="Add a patient" detail="Name, phone, birthday, gender, patient type, therapy, one doctor, and the case." />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Patient name" autoCapitalize="words" />
      <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="555-0100" keyboardType="phone-pad" />
      <DateField label="Date of birth" value={dob} onChange={setDob} max={todayISO()} />
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Gender
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {GENDERS.map((item) => (
          <Chip key={item} label={item} active={gender === item} onPress={() => setGender(item)} />
        ))}
      </View>
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Patient type
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {PAYER_TYPES.map((item) => (
          <Chip
            key={item}
            label={item}
            active={patientType === item}
            onPress={() => {
              setPatientType(item);
              if (!hasSessionQuota(item)) setSessionsAllotted('');
            }}
          />
        ))}
      </View>
      {hasSessionQuota(patientType) ? (
        <Field
          label="Number of sessions"
          value={sessionsAllotted}
          onChangeText={setSessionsAllotted}
          keyboardType="number-pad"
          placeholder="12"
        />
      ) : null}
      {lockedTherapy ? (
        <Text style={font.sans} className="mb-4 text-base text-ink">
          {lockedTherapy}
        </Text>
      ) : (
        <>
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Therapy type
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {therapies.map((item) => (
          <Chip key={item} label={item} active={therapy === item} onPress={() => chooseTherapy(item)} />
        ))}
      </View>
        </>
      )}
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Doctor following the case
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {doctors
          .filter((doctor) => doctor.therapyType === therapy)
          .map((doctor) => (
            <Chip key={doctor.id} label={doctor.name} active={doctorId === doctor.id} onPress={() => setDoctorId(doctor.id)} />
          ))}
      </View>
      <View className="mt-4">
        <Field
          label="Case notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="The case, and what the patient is suffering from"
        />
      </View>
      <Button label={busy ? 'Saving…' : 'Save patient'} disabled={busy} onPress={() => void submit()} />
    </Screen>
  );
}
