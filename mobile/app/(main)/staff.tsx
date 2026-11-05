import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Screen } from '../../components/Screen';
import { Banner, Button, Chip, Field, PageTitle, RolePill, TherapyPill, confirmAction, font, therapySurface } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTherapies } from '../../lib/therapies';
import { canManageStaff } from '../../lib/permissions';
import type { Role, User } from '../../lib/types';

const ROLES: Role[] = ['admin', 'sub-admin', 'user'];

type AccountDraft = {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
  therapy: string | null;
};

const emptyDraft: AccountDraft = { name: '', email: '', password: '', phone: '', role: 'user', therapy: null };

function draftFrom(person: User): AccountDraft {
  return {
    name: person.name,
    email: person.email,
    password: '',
    phone: person.phone ?? '',
    role: person.role,
    therapy: person.therapyType ?? null,
  };
}

function AccountFields({
  draft,
  onChange,
  therapies,
  passwordLabel,
  passwordPlaceholder,
}: {
  draft: AccountDraft;
  onChange: (next: AccountDraft) => void;
  therapies: string[];
  passwordLabel: string;
  passwordPlaceholder?: string;
}) {
  return (
    <View>
      <Field label="Name" value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} autoCapitalize="words" />
      <Field
        label="Email"
        value={draft.email}
        onChangeText={(email) => onChange({ ...draft, email })}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Field
        label={passwordLabel}
        value={draft.password}
        onChangeText={(password) => onChange({ ...draft, password })}
        placeholder={passwordPlaceholder}
        secureTextEntry
        autoCapitalize="none"
      />
      <Field
        label="Phone number"
        value={draft.phone}
        onChangeText={(phone) => onChange({ ...draft, phone })}
        placeholder="555-0100"
        keyboardType="phone-pad"
      />
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Role
      </Text>
      <View className="flex-row flex-wrap">
        {ROLES.map((item) => (
          <Chip key={item} label={item} active={draft.role === item} onPress={() => onChange({ ...draft, role: item })} />
        ))}
      </View>
      <Text style={font.medium} className="mb-2 mt-2 text-xs uppercase tracking-widest text-moss">
        Therapy
      </Text>
      <View className="flex-row flex-wrap">
        <Chip label="None" active={draft.therapy == null} onPress={() => onChange({ ...draft, therapy: null })} />
        {(draft.therapy && !therapies.includes(draft.therapy) ? [...therapies, draft.therapy] : therapies).map((item) => (
          <Chip key={item} label={item} active={draft.therapy === item} onPress={() => onChange({ ...draft, therapy: item })} />
        ))}
      </View>
    </View>
  );
}

export default function StaffScreen() {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const [people, setPeople] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<AccountDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'save' | null>(null);
  const allowed = user ? canManageStaff(user.role) : false;
  const therapies = useTherapies();
  const addMaxHeight = height - 32;

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const data = await api.users();
      setPeople(data.users);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load staff.');
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function beginEdit(person: User) {
    setEditingId(person.id);
    setEditDraft(draftFrom(person));
    setEditError(null);
    setError(null);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(emptyDraft);
  }

  function beginAdd() {
    setDraft(emptyDraft);
    setFormError(null);
    setAdding(true);
    setMessage(null);
  }

  function cancelAdd() {
    if (busy === 'create') return;
    setAdding(false);
    setDraft(emptyDraft);
    setFormError(null);
  }

  async function create() {
    const problem = checkDraft(draft, true);
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy('create');
    setFormError(null);
    try {
      await api.createUser({
        name: draft.name.trim(),
        email: draft.email.trim(),
        password: draft.password,
        phone: draft.phone.trim(),
        role: draft.role,
        therapyType: draft.therapy,
      });
      setMessage(`Added ${draft.name.trim()} as ${draft.role}.`);
      setAdding(false);
      setDraft(emptyDraft);
      await load();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Could not add that account.');
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(person: User) {
    const problem = checkDraft(editDraft, false);
    if (problem) {
      setEditError(problem);
      setMessage(null);
      return;
    }
    setBusy('save');
    setEditError(null);
    setError(null);
    setMessage(null);
    try {
      await api.updateUser(person.id, {
        name: editDraft.name.trim(),
        email: editDraft.email.trim(),
        password: editDraft.password,
        phone: editDraft.phone.trim(),
        role: editDraft.role,
        therapyType: editDraft.therapy,
      });
      setMessage(`Updated ${editDraft.name.trim()}.`);
      cancelEdit();
      await load();
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : 'Could not update that account.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(person: User) {
    const ok = await confirmAction('Remove this account?', `${person.name} will no longer be able to sign in.`);
    if (!ok) return;
    try {
      await api.deleteUser(person.id);
      if (editingId === person.id) cancelEdit();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove that account.');
    }
  }

  if (!allowed) {
    return (
      <Screen>
        <PageTitle kicker="Staff" title="Accounts" detail="Only an admin can add or remove desk accounts." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <PageTitle kicker="Staff" title="Desk accounts" detail="Each account has a name, email, password, and phone number." />
        </View>
        <Pressable accessibilityRole="button" onPress={beginAdd} className="mt-1 rounded-full bg-clay px-3 py-2">
          <Text style={font.medium} className="text-sm text-card">
            Add account
          </Text>
        </Pressable>
      </View>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {people.map((person) => (
        <View key={person.id} className="mb-3 rounded-2xl border px-4 py-3" style={therapySurface(person.therapyType)}>
          {editingId === person.id ? (
            <View>
              <AccountFields
                draft={editDraft}
                onChange={setEditDraft}
                therapies={therapies}
                passwordLabel="Password"
                passwordPlaceholder="Leave blank to keep it"
              />
              {editError ? <Banner tone="error">{editError}</Banner> : null}
              <View className="flex-row">
                <View className="mr-3 flex-1">
                  <Button label={busy === 'save' ? 'Saving…' : 'Save'} disabled={busy != null} onPress={() => void saveEdit(person)} />
                </View>
                <View className="flex-1">
                  <Button label="Cancel" tone="ghost" onPress={cancelEdit} />
                </View>
              </View>
            </View>
          ) : (
            <View className="flex-row items-start">
              <View className="mr-3 flex-1">
                <Text style={font.semibold} className="text-base text-ink">
                  {person.name}
                </Text>
                <Text style={font.sans} className="mt-0.5 text-sm text-mute">
                  {person.email}
                </Text>
                <Text style={font.sans} className="mt-0.5 text-sm text-mute">
                  {person.phone || 'No phone'}
                </Text>
              </View>
              <View className="items-end">
                <RolePill role={person.role} />
                {person.therapyType ? (
                  <View className="mt-1">
                    <TherapyPill therapy={person.therapyType} />
                  </View>
                ) : null}
                <View className="mt-2 flex-row items-center">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${person.name}`}
                    onPress={() => beginEdit(person)}
                    className="h-10 w-10 items-center justify-center rounded-full"
                  >
                    <ActionIcon kind="edit" />
                  </Pressable>
                  {user && person.id !== user.id ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${person.name}`}
                      onPress={() => void remove(person)}
                      className="h-10 w-10 items-center justify-center rounded-full"
                    >
                      <ActionIcon kind="remove" />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </View>
      ))}

      {adding ? (
        <Modal visible transparent animationType="fade" onRequestClose={cancelAdd}>
          <View className="flex-1 items-center justify-center px-4 py-4" style={{ backgroundColor: 'rgba(18, 48, 51, 0.45)' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close add account" onPress={cancelAdd} className="absolute inset-0" />
            <View
              className="rounded-2xl border border-line bg-card px-6 py-5"
              style={{ width: Math.min(width - 32, 560), maxHeight: addMaxHeight, overflow: 'hidden' }}
            >
              <Text style={font.display} className="mb-3 text-2xl text-ink">
                Add account
              </Text>
              {formError ? <Banner tone="error">{formError}</Banner> : null}
              <ScrollView style={{ maxHeight: addMaxHeight - 160 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                <AccountFields draft={draft} onChange={setDraft} therapies={therapies} passwordLabel="Password" />
              </ScrollView>
              <View className="mt-2 flex-row">
                <View className="mr-3 flex-1">
                  <Button label={busy === 'create' ? 'Adding…' : 'Add account'} disabled={busy != null} onPress={() => void create()} />
                </View>
                <View className="flex-1">
                  <Button label="Cancel" tone="ghost" onPress={cancelAdd} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

function ActionIcon({ kind }: { kind: 'edit' | 'remove' }) {
  if (Platform.OS !== 'web') {
    return <Text style={[font.semibold, { color: '#146e70', fontSize: 18 }]}>{kind === 'edit' ? '✎' : '✕'}</Text>;
  }
  if (kind === 'edit') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#146e70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#146e70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function checkDraft(draft: AccountDraft, passwordRequired: boolean) {
  if (!draft.name.trim()) return 'Enter a name.';
  if (!draft.email.trim().includes('@')) return 'Enter a valid email.';
  if (passwordRequired && draft.password.length < 6) return 'Use a password of at least 6 characters.';
  if (!passwordRequired && draft.password && draft.password.length < 6) return 'Use a password of at least 6 characters.';
  if (passwordRequired && draft.phone.trim().length < 3) return 'Enter a phone number.';
  if (draft.phone.trim() && draft.phone.trim().length < 3) return 'Enter a valid phone number.';
  return null;
}
