import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, RolePill, font } from '../components/ui';
import { useAuth } from '../lib/auth';
import { serverUrl } from '../lib/api';
import { WIDE } from '../lib/format';
import type { Role } from '../lib/types';

const DEMOS: { role: Role; name: string; email: string; password: string; note: string }[] = [
  { role: 'admin', name: 'Amina Farid', email: 'admin@halden.clinic', password: 'admin123', note: 'Full desk, staff, and deleting records' },
  { role: 'sub-admin', name: 'Noah Keller', email: 'subadmin@halden.clinic', password: 'subadmin123', note: 'Book, edit, and add documents' },
  { role: 'user', name: 'Sara Idris', email: 'user@halden.clinic', password: 'user123', note: 'See the day and book a visit' },
];

export default function LoginScreen() {
  const { user, ready, signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return <View className="flex-1 bg-paper" />;
  if (user) return <Redirect href="/dashboard" />;

  async function submit(nextEmail = email, nextPassword = password) {
    setBusy(true);
    setError(null);
    try {
      await signIn(nextEmail, nextPassword);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <View className="w-full max-w-md">
      <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
        Sign in
      </Text>
      <Text style={font.display} className="mt-2 text-4xl text-ink">
        Open the desk
      </Text>
      <Text style={font.sans} className="mb-6 mt-2 text-base leading-6 text-mute">
        The same book on Windows, iPhone, and Android.
      </Text>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
        Email
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@physiocore.clinic"
        placeholderTextColor="#7a9495"
        className="mb-4 rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
        style={font.sans}
      />
      <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
        Password
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Password"
        placeholderTextColor="#7a9495"
        className="mb-5 rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
        style={font.sans}
        onSubmitEditing={() => void submit()}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void submit()}
        className="items-center rounded-xl bg-clay px-4 py-3"
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        <Text style={font.semibold} className="text-base text-card">
          {busy ? 'Checking…' : 'Enter the desk'}
        </Text>
      </Pressable>
      <Text style={font.sans} className="mb-3 mt-8 text-xs uppercase tracking-widest text-mute">
        Demo accounts
      </Text>
      {DEMOS.map((account) => (
        <Pressable
          key={account.email}
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setEmail(account.email);
            setPassword(account.password);
            void submit(account.email, account.password);
          }}
          className="mb-2 rounded-2xl border border-line bg-card px-4 py-3"
        >
          <View className="flex-row items-center justify-between">
            <Text style={font.semibold} className="text-base text-ink">
              {account.name}
            </Text>
            <RolePill role={account.role} />
          </View>
          <Text style={font.sans} className="mt-1 text-sm text-mute">
            {account.note}
          </Text>
          <Text style={font.medium} className="mt-1 text-xs text-moss">
            {account.email} · {account.password}
          </Text>
        </Pressable>
      ))}
      <Text style={font.sans} className="mt-4 text-xs text-mute">
        Server {serverUrl()}
      </Text>
    </View>
  );

  return (
    <View className={`flex-1 bg-paper ${wide ? 'flex-row' : ''}`} style={{ paddingTop: wide ? 0 : insets.top }}>
      <View className={wide ? 'w-[46%] justify-between bg-pine px-12 py-16' : 'bg-pine px-6 py-8'} style={wide ? { paddingTop: Math.max(insets.top, 48) } : undefined}>
        <View>
          <Text style={font.medium} className="text-xs uppercase tracking-widest text-sand">
            PhysioCore
          </Text>
          <Text style={font.display} className={`text-card ${wide ? 'mt-4 text-6xl' : 'mt-2 text-4xl'}`}>
            PhysioCore
          </Text>
          <Text style={font.sans} className="mt-3 max-w-sm text-base leading-6 text-sand">
            Today’s book, the month, and the sessions for each patient.
          </Text>
        </View>
        {wide ? (
          <View>
            <RoleLine role="Admin" text="Runs the desk, including staff accounts." />
            <RoleLine role="Sub-admin" text="Books, edits, and files documents." />
            <RoleLine role="User" text="Reads the day and books a visit." />
          </View>
        ) : null}
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: wide ? 48 : 20, paddingVertical: 28, paddingBottom: insets.bottom + 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {form}
      </ScrollView>
    </View>
  );
}

function RoleLine({ role, text }: { role: string; text: string }) {
  return (
    <View className="mb-4">
      <Text style={font.semibold} className="text-base text-card">
        {role}
      </Text>
      <Text style={font.sans} className="text-sm text-sand">
        {text}
      </Text>
    </View>
  );
}
