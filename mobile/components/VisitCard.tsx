import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { canEdit, isClinician } from '../lib/permissions';
import type { Reservation, VisitStatus } from '../lib/types';
import { formatLong, formatMoney } from '../lib/format';
import { Banner, Button, Chip, Field, StatusPill, TherapyPill, font, therapyTone } from './ui';

const STATUSES: VisitStatus[] = ['scheduled', 'completed', 'cancelled'];

function shownStatus(status: VisitStatus): VisitStatus {
  return status === 'arrived' ? 'scheduled' : status;
}

export function VisitCard({
  visit,
  onChanged,
  showDate,
  pending,
}: {
  visit: Reservation;
  onChanged: (visit: Reservation) => void;
  showDate?: boolean;
  pending?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<VisitStatus>(shownStatus(visit.status));
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [amount, setAmount] = useState(visit.amountPaid != null ? String(visit.amountPaid) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const desk = user ? canEdit(user.role) : false;
  const ownTherapy = Boolean(user && isClinician(user.role) && user.therapyType && visit.therapyType === user.therapyType);
  const ownDoctor = Boolean(user && visit.doctorId === user.id);
  const canSubmit = desk || ownTherapy || ownDoctor;
  const writtenAmount = amount.trim();
  const amountReady = writtenAmount !== '' && Number.isFinite(Number(writtenAmount)) && Number(writtenAmount) >= 0;
  const showSubmit = canSubmit && (!pending || amountReady);

  useEffect(() => {
    setStatus(shownStatus(visit.status));
    setNotes(visit.notes ?? '');
    setAmount(visit.amountPaid != null ? String(visit.amountPaid) : '');
    setError(null);
  }, [visit]);

  async function submit() {
    const trimmed = amount.trim();
    let amountPaid: number | null = null;
    if (pending && !trimmed) {
      setError('Enter the amount paid.');
      return;
    }
    if (trimmed) {
      const paid = Number(trimmed);
      if (!Number.isFinite(paid) || paid < 0) {
        setError('Enter a valid amount.');
        return;
      }
      amountPaid = paid;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.updateReservation(visit.id, {
        status,
        notes: notes.trim() || null,
        amountPaid,
      });
      onChanged(result.reservation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit the visit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="rounded-2xl border border-line bg-card p-4" style={{ borderLeftWidth: 4, borderLeftColor: therapyTone(visit.therapyType).line }}>
      <View className="mb-3 flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text style={font.display} className="text-2xl text-ink">
            {visit.patientName}
          </Text>
          {showDate || pending ? (
            <Text style={font.sans} className="mt-1 text-sm text-mute">
              {formatLong(visit.scheduledDate)}
            </Text>
          ) : null}
          <Text style={[font.medium, { fontVariant: ['tabular-nums'] }]} className="mt-1 text-sm text-mute">
            {visit.startTime}–{visit.endTime}
          </Text>
        </View>
        <View className="items-end">
          <StatusPill status={shownStatus(visit.status)} />
          <View className="mt-2">
            <TherapyPill therapy={visit.therapyType} />
          </View>
        </View>
      </View>
      {visit.doctorName ? (
        <Text style={font.sans} className="text-base text-ink">
          {visit.doctorName}
        </Text>
      ) : null}
      {visit.reason ? (
        <Text style={font.sans} className="text-base text-ink">
          {visit.reason}
        </Text>
      ) : null}
      {visit.phone ? (
        <Text style={font.sans} className="mt-1 text-sm text-mute">
          {visit.phone}
        </Text>
      ) : null}
      {visit.patientType ? (
        <Text style={font.sans} className="mt-1 text-sm text-mute">
          {visit.patientType}
        </Text>
      ) : null}
      {!canSubmit && visit.amountPaid != null ? (
        <Text style={font.sans} className="mt-3 text-base text-ink">
          Paid {formatMoney(visit.amountPaid)}
        </Text>
      ) : null}
      {!canSubmit && visit.notes ? (
        <Text style={font.sans} className="mt-3 text-sm leading-5 text-ink">
          {visit.notes}
        </Text>
      ) : null}
      {visit.createdByName ? (
        <Text style={font.sans} className="mt-3 text-xs text-mute">
          Booked by {visit.createdByName}
        </Text>
      ) : null}
      {error ? (
        <View className="mt-3">
          <Banner tone="error">{error}</Banner>
        </View>
      ) : null}
      {canSubmit ? (
        <View className="mt-4">
          <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
            Status
          </Text>
          <View className="flex-row flex-wrap">
            {STATUSES.map((item) => (
              <Chip key={item} label={item === 'scheduled' ? 'Scheduled' : item === 'completed' ? 'Completed' : 'Cancelled'} active={status === item} onPress={() => setStatus(item)} />
            ))}
          </View>
          <Field label="Amount paid" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What happened in the visit" />
          {showSubmit ? <Button label={busy ? 'Submitting…' : 'Submit'} disabled={busy} onPress={() => void submit()} /> : null}
        </View>
      ) : null}
      <View className="mt-4">
        <Button label="View patient" tone="pine" onPress={() => router.push(`/patients/${visit.patientId}`)} />
      </View>
    </View>
  );
}
