import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Screen } from '../../components/Screen';
import { Banner, Button, Chip, Field, PageTitle, font } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatClock } from '../../lib/format';
import { canManageSettings } from '../../lib/permissions';

type Mode = 'before' | 'tomorrow';

type Reminder = {
  mode: Mode;
  reminderHours: number;
  reminderTime: string;
};

function lead(hours: number) {
  return hours === 1 ? '1 hour before' : `${hours} hours before`;
}

function working(reminder: Reminder) {
  if (reminder.mode === 'tomorrow') {
    return `One time for tomorrow, at ${formatClock(reminder.reminderTime)}`;
  }
  return `Hours before the session, ${lead(reminder.reminderHours)}`;
}

function summary(reminder: Reminder) {
  if (reminder.mode === 'tomorrow') {
    return `At ${formatClock(reminder.reminderTime)}, every patient with a session tomorrow gets a WhatsApp message.`;
  }
  return `A patient is reminded ${lead(reminder.reminderHours)} the session starts.`;
}

const EMPTY: Reminder = { mode: 'before', reminderHours: 24, reminderTime: '18:00' };

export default function SettingsScreen() {
  const { user } = useAuth();
  const allowed = user ? canManageSettings(user.role) : false;
  const [choices, setChoices] = useState<number[]>([1, 2, 6, 12, 24, 48]);
  const [times, setTimes] = useState<string[]>(['07:00', '08:00', '09:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00']);
  const [saved, setSaved] = useState<Reminder>(EMPTY);
  const [draft, setDraft] = useState<Reminder>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [therapies, setTherapies] = useState<string[]>([]);
  const [therapyName, setTherapyName] = useState('');
  const [therapyBusy, setTherapyBusy] = useState(false);
  const [therapyMessage, setTherapyMessage] = useState<string | null>(null);
  const [therapyError, setTherapyError] = useState<string | null>(null);
  const unchanged = draft.mode === saved.mode && draft.reminderHours === saved.reminderHours && draft.reminderTime === saved.reminderTime;

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const data = await api.settings();
      setChoices(data.choices);
      setTimes(data.times);
      setSaved(data.settings);
      setDraft(data.settings);
      const catalog = await api.therapies();
      setTherapies(catalog.therapies);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load settings.');
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api.updateSettings(draft);
      setSaved(data.settings);
      setDraft(data.settings);
      setMessage(summary(data.settings));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that reminder.');
    } finally {
      setBusy(false);
    }
  }

  async function addTherapy() {
    const name = therapyName.trim();
    if (name.length < 2) {
      setTherapyError('Name the therapy.');
      return;
    }
    setTherapyBusy(true);
    setTherapyError(null);
    setTherapyMessage(null);
    try {
      const data = await api.addTherapy(name);
      setTherapies(data.therapies);
      setTherapyName('');
      setTherapyMessage(`${name} can now be assigned to staff.`);
    } catch (reason) {
      setTherapyError(reason instanceof Error ? reason.message : 'Could not add that therapy.');
    } finally {
      setTherapyBusy(false);
    }
  }

  if (!allowed) {
    return (
      <Screen>
        <PageTitle kicker="Settings" title="Clinic settings" detail="Only an admin can change these." />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageTitle kicker="Settings" title="WhatsApp reminders" detail="Choose one way for WhatsApp to remind patients." />
      <View className="mb-6 rounded-2xl border border-line bg-card px-4 py-4">
        <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
          Working now
        </Text>
        <Text style={font.semibold} className="mt-2 text-lg text-ink">
          {working(saved)}
        </Text>
        <Text style={font.sans} className="mt-1 text-base leading-6 text-mute">
          {summary(saved)}
        </Text>
      </View>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        How to send
      </Text>
      <View className="flex-row flex-wrap">
        <Chip label="Hours before the session" active={draft.mode === 'before'} onPress={() => setDraft((current) => ({ ...current, mode: 'before' }))} />
        <Chip label="One time for tomorrow" active={draft.mode === 'tomorrow'} onPress={() => setDraft((current) => ({ ...current, mode: 'tomorrow' }))} />
      </View>
      {draft.mode === 'before' ? (
        <>
          <Text style={font.sans} className="mb-4 text-base leading-6 text-mute">
            Choose how many hours before the session the WhatsApp message goes to that patient.
          </Text>
          <View className="flex-row flex-wrap">
            {choices.map((hours) => (
              <Chip
                key={hours}
                label={lead(hours)}
                active={draft.reminderHours === hours}
                onPress={() => setDraft((current) => ({ ...current, reminderHours: hours }))}
              />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={font.sans} className="mb-4 text-base leading-6 text-mute">
            Choose the time of day. At that time, every patient who has a session tomorrow gets a WhatsApp message.
          </Text>
          <View className="flex-row flex-wrap">
            {times.map((time) => (
              <Chip
                key={time}
                label={formatClock(time)}
                active={draft.reminderTime === time}
                onPress={() => setDraft((current) => ({ ...current, reminderTime: time }))}
              />
            ))}
          </View>
        </>
      )}
      <Button label={busy ? 'Saving…' : 'Save reminder'} disabled={busy || unchanged} onPress={() => void save()} />

      <View className="mt-10">
        <PageTitle kicker="Settings" title="Staff therapies" detail="Add a therapy here, then choose it when you create or edit a staff account." />
      </View>
      {therapyMessage ? <Banner tone="ok">{therapyMessage}</Banner> : null}
      {therapyError ? <Banner tone="error">{therapyError}</Banner> : null}
      <View className="mb-4 flex-row flex-wrap">
        {therapies.map((name) => (
          <View key={name} className="mb-2 mr-2 rounded-full border border-line bg-card px-3 py-2">
            <Text style={font.medium} className="text-sm text-ink">
              {name}
            </Text>
          </View>
        ))}
      </View>
      <Field label="New therapy" value={therapyName} onChangeText={setTherapyName} placeholder="Hydrotherapy" autoCapitalize="words" />
      <Button label={therapyBusy ? 'Adding…' : 'Add therapy'} disabled={therapyBusy || therapyName.trim().length < 2} onPress={() => void addTherapy()} />
    </Screen>
  );
}
