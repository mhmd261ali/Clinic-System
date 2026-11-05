import { Alert, Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import type { ReactNode } from 'react';

import type { Role, VisitStatus } from '../lib/types';

export const font = {
  display: { fontFamily: 'Fraunces_600SemiBold' },
  sans: { fontFamily: 'Outfit_400Regular' },
  medium: { fontFamily: 'Outfit_500Medium' },
  semibold: { fontFamily: 'Outfit_600SemiBold' },
};

export const STATUS: Record<VisitStatus, { label: string; bg: string; fg: string; line: string }> = {
  scheduled: { label: 'Scheduled', bg: '#e5f7f7', fg: '#0f5c5e', line: '#4BBBBC' },
  arrived: { label: 'Arrived', bg: '#fff3e4', fg: '#8a4e12', line: '#e09a45' },
  completed: { label: 'Completed', bg: '#e7f3f4', fg: '#125e60', line: '#146e70' },
  cancelled: { label: 'Cancelled', bg: '#fdecec', fg: '#9b3b36', line: '#9b3b36' },
};

export const THERAPY_TONE: Record<string, { label: string; bg: string; fg: string; line: string; mark: string }> = {
  'Occupational therapy': { label: 'Occupational', bg: '#e9f7f6', fg: '#0f5c5e', line: '#9adcdc', mark: '#4BBBBC' },
  'Speech therapy': { label: 'Speech', bg: '#fff5e8', fg: '#8a4e12', line: '#f0cba0', mark: '#e09a45' },
  'Physiotherapy': { label: 'Physiotherapy', bg: '#eaf6ee', fg: '#1b6b40', line: '#a3d4b4', mark: '#3d9a62' },
};

export const THERAPY_FALLBACK = { label: 'Unassigned', bg: '#f3f4f8', fg: '#4a4e6a', line: '#cfd2de', mark: '#8b90b0' };

export function therapyTone(therapy?: string | null) {
  if (therapy && THERAPY_TONE[therapy]) return THERAPY_TONE[therapy];
  if (therapy) return { ...THERAPY_FALLBACK, label: therapy };
  return THERAPY_FALLBACK;
}

export function therapySurface(therapy?: string | null) {
  const tone = therapyTone(therapy);
  return { backgroundColor: tone.bg, borderColor: tone.line };
}

export const ROLE_TONE: Record<Role, { bg: string; fg: string }> = {
  admin: { bg: '#0f5c5e', fg: '#ffffff' },
  'sub-admin': { bg: '#4BBBBC', fg: '#ffffff' },
  user: { bg: '#d7f4f4', fg: '#123033' },
};

export function confirmAction(title: string, message: string) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function PageTitle({ kicker, title, detail }: { kicker?: string; title: string; detail?: string }) {
  return (
    <View className="mb-6">
      {kicker ? (
        <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
          {kicker}
        </Text>
      ) : null}
      <Text style={font.display} className="mt-1 text-4xl text-ink">
        {title}
      </Text>
      {detail ? (
        <Text style={font.sans} className="mt-2 text-base leading-6 text-mute">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  const error = tone === 'error';
  return (
    <View className="mb-4 rounded-xl px-4 py-3" style={{ backgroundColor: error ? '#fdecec' : '#e5f7f7' }}>
      <Text style={[font.medium, { color: error ? '#9b3b36' : '#0f5c5e' }]} className="text-sm leading-5">
        {children}
      </Text>
    </View>
  );
}

export function Field({ label, ...props }: { label?: string } & TextInputProps) {
  return (
    <View className="mb-4">
      {label ? (
        <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="#7a9495"
        className="rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
        {...props}
        style={[font.sans, props.style]}
      />
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
}) {
  return (
    <View className="mb-4">
      <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
        {label}
      </Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={value}
          max={max}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'Outfit_400Regular',
            fontSize: 16,
            color: '#123033',
            background: '#ffffff',
            border: '1px solid #c9e4e4',
            borderRadius: 12,
            padding: 12,
          }}
        />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#7a9495"
          autoCapitalize="none"
          className="rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
          style={font.sans}
        />
      )}
    </View>
  );
}

export function MonthField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="mb-4">
      {label ? (
        <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
          {label}
        </Text>
      ) : null}
      {Platform.OS === 'web' ? (
        <input
          type="month"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'Outfit_400Regular',
            fontSize: 16,
            color: '#123033',
            background: '#ffffff',
            border: '1px solid #c9e4e4',
            borderRadius: 12,
            padding: 12,
          }}
        />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM"
          placeholderTextColor="#7a9495"
          autoCapitalize="none"
          className="rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
          style={font.sans}
        />
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'pine' | 'ghost' | 'danger';
}) {
  const background = tone === 'primary' ? '#4BBBBC' : tone === 'pine' ? '#0f5c5e' : tone === 'danger' ? '#9b3b36' : 'transparent';
  const color = tone === 'ghost' ? '#123033' : '#ffffff';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`items-center rounded-xl px-4 py-3 ${tone === 'ghost' ? 'border border-line' : ''}`}
      style={{ backgroundColor: background, opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={[font.semibold, { color }]} className="text-base">
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const wash = THERAPY_TONE[label];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-3 py-2 ${active || wash ? '' : 'border-line bg-card'}`}
      style={
        wash
          ? { backgroundColor: active ? wash.mark : wash.bg, borderColor: wash.mark }
          : active
            ? { backgroundColor: '#0f5c5e', borderColor: '#0f5c5e' }
            : undefined
      }
    >
      <Text style={[font.medium, { color: active ? '#ffffff' : wash ? wash.fg : '#123033' }]} className="text-sm">
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusPill({ status }: { status: VisitStatus }) {
  const tone = STATUS[status];
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: tone.bg }}>
      <Text style={[font.medium, { color: tone.fg }]} className="text-xs">
        {tone.label}
      </Text>
    </View>
  );
}

export function TherapyPill({ therapy }: { therapy?: string | null }) {
  const tone = therapyTone(therapy);
  return (
    <View className="rounded-full border px-2.5 py-1" style={{ backgroundColor: '#ffffff', borderColor: tone.line }}>
      <Text style={[font.medium, { color: tone.fg }]} className="text-xs">
        {tone.label}
      </Text>
    </View>
  );
}

export function RolePill({ role }: { role: Role }) {
  const tone = ROLE_TONE[role];
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: tone.bg }}>
      <Text style={[font.medium, { color: tone.fg }]} className="text-xs capitalize">
        {role}
      </Text>
    </View>
  );
}
