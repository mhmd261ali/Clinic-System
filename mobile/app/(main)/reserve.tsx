import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { PatientSearch } from '../../components/PatientSearch';
import { Screen } from '../../components/Screen';
import { Banner, Button, Chip, DateField, Field, PageTitle, font } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DURATIONS, START_TIMES, WIDE, addDays, addMinutes, formatClock, formatDay, todayISO } from '../../lib/format';
import { canEdit } from '../../lib/permissions';
import type { Patient } from '../../lib/types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ReserveScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const passedDate = typeof params.date === 'string' && DATE.test(params.date) ? params.date : todayISO();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState(passedDate);
  const [start, setStart] = useState('10:00');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayISO();
  const reason = patient?.therapyType ?? '';
  const doctorId = patient?.doctorId ?? null;

  async function submit() {
    const startTime = start.trim();
    const minutes = Number(duration.trim());
    const end = addMinutes(startTime, minutes);
    if (!DATE.test(date)) {
      setError('Use a date like 2026-10-21.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !end) {
      setError('Use a start time like 09:30, and keep the visit inside the same day.');
      return;
    }
    if (!/^\d+$/.test(duration.trim()) || minutes < 1) {
      setError('Enter the length in minutes, like 120.');
      return;
    }
    if (!patient) {
      setError('Choose a registered patient.');
      return;
    }
    if (patient.therapyType && !doctorId) {
      setError('This patient needs a doctor on file before the visit can be booked.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.createReservation({
        patientId: patient.id,
        scheduledDate: date,
        startTime,
        endTime: end,
        reason,
        notes,
        doctorId,
        status: 'scheduled',
      });
      const overlap = result.overlaps
        .map((visit) => `${visit.patientName} (${visit.startTime}–${visit.endTime})`)
        .join(', ');
      const booked = `Booked ${result.reservation.patientName} for ${formatDay(date)}, ${startTime}–${end}.`;
      setMessage(overlap ? `${booked} This overlaps ${overlap}.` : booked);
      setPatient(null);
      setNotes('');
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'Could not book the visit.');
    } finally {
      setBusy(false);
    }
  }

  const who = (
    <View>
      <PatientSearch selected={patient} onSelect={setPatient} />
      {patient ? (
        <Pressable accessibilityRole="button" onPress={() => setPatient(null)} className="mb-4 self-start">
          <Text style={font.medium} className="text-sm text-moss">
            Choose a different patient
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const when = (
    <View>
      <DateField label="Date" value={date} onChange={setDate} />
      <View className="mb-3 flex-row flex-wrap">
        {[0, 1, 2, 3].map((offset) => {
          const value = addDays(today, offset);
          const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : formatDay(value).split(',')[0];
          return <Chip key={value} label={`${label} ${value.slice(5)}`} active={date === value} onPress={() => setDate(value)} />;
        })}
      </View>
      <Field label="Start time" value={start} onChangeText={setStart} autoCapitalize="none" placeholder="09:45" />
      <View className="flex-row flex-wrap">
        {START_TIMES.map((time) => (
          <Chip
            key={time}
            label={formatClock(time)}
            active={start.trim() === time}
            onPress={() => setStart(time)}
          />
        ))}
      </View>
      <Field
        label="Length in minutes"
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
        placeholder="120"
      />
      <View className="flex-row flex-wrap">
        {DURATIONS.map((minutes) => (
          <Chip
            key={minutes}
            label={`${minutes} min`}
            active={duration.trim() === String(minutes)}
            onPress={() => setDuration(String(minutes))}
          />
        ))}
      </View>
      <Text style={font.medium} className="mb-1 text-xs uppercase tracking-widest text-moss">
        Reason
      </Text>
      <Text style={font.sans} className="mb-4 text-base text-ink">
        {patient?.therapyType || 'No therapy on file'}
      </Text>
      <Text style={font.medium} className="mb-1 text-xs uppercase tracking-widest text-moss">
        Doctor
      </Text>
      <Text style={font.sans} className="mb-4 text-base text-ink">
        {patient?.doctorName || 'No doctor on file'}
      </Text>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Anything the desk should know" />
      <Button label={busy ? 'Booking…' : 'Book the visit'} disabled={busy} onPress={() => void submit()} />
      {user && !canEdit(user.role) ? (
        <Text style={font.sans} className="mt-3 text-sm leading-5 text-mute">
          You can book the visit. A sub-admin or admin changes the status afterward.
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <PageTitle kicker="Book" title="Add a reservation" detail="Book a visit for someone already registered." />
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {patient && wide ? (
        <View className="flex-row items-start">
          <View className="pr-6" style={{ width: '66.666%' }}>
            {who}
          </View>
          <View style={{ width: '33.333%' }}>{when}</View>
        </View>
      ) : (
        <>
          {who}
          {patient ? <View className="mt-2">{when}</View> : null}
        </>
      )}
    </Screen>
  );
}
