import { useCallback, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../../components/Screen';
import { Banner, MonthField, font, therapyTone } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatMoney, monthISO, shiftMonthISO } from '../../lib/format';
import { canSeeIncome, isClinician } from '../../lib/permissions';
import type { DashboardReport } from '../../lib/types';

function dollars(value: number | null | undefined) {
  return `$${formatMoney(value)}`;
}

function percent(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const PANEL =
  Platform.OS === 'web'
    ? ({
        backgroundColor: '#ffffff',
        boxShadow: '0 12px 32px rgba(15, 92, 94, 0.07)',
        borderRadius: 24,
      } as const)
    : { backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#c9e4e4' };

type IconName = 'calendar' | 'close' | 'people' | 'cash' | 'users' | 'check' | 'progress' | 'clock';

function DashIcon({ name, color }: { name: IconName; color: string }) {
  if (Platform.OS !== 'web') {
    const mark = name === 'calendar' ? '◷' : name === 'close' ? '✕' : name === 'cash' ? '$' : name === 'check' ? '✓' : name === 'clock' ? '◷' : '☺';
    return (
      <Text style={[font.medium, { color, fontSize: 18, lineHeight: 22 }]}>{mark}</Text>
    );
  }
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="16" y1="3" x2="16" y2="7" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="3" y1="11" x2="21" y2="11" />
      </svg>
    );
  }
  if (name === 'close') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <line x1="9" y1="9" x2="15" y2="15" />
        <line x1="15" y1="9" x2="9" y2="15" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === 'cash') {
    return (
      <svg {...common}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (name === 'users') {
    return (
      <svg {...common}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
    );
  }
  if (name === 'progress') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 16 14" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  hint,
  hintColor,
  tint,
  icon,
  iconColor,
}: {
  label: string;
  value: string;
  hint: string;
  hintColor: string;
  tint: string;
  icon: IconName;
  iconColor: string;
}) {
  return (
    <View
      className="flex-1 p-5"
      style={[
        PANEL,
        Platform.OS === 'web'
          ? ({ backgroundImage: `linear-gradient(165deg, #ffffff 0%, ${tint} 100%)` } as object)
          : { backgroundColor: tint },
      ]}
    >
      <View className="mb-5 flex-row items-start justify-between">
        <Text style={font.medium} className="text-sm text-ink">
          {label}
        </Text>
        <DashIcon name={icon} color={iconColor} />
      </View>
      <Text style={[font.display, { fontVariant: ['tabular-nums'] }]} className="text-4xl text-ink">
        {value}
      </Text>
      <Text style={[font.medium, { color: hintColor }]} className="mt-2 text-sm">
        {hint}
      </Text>
    </View>
  );
}

function Pill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'mute' }) {
  const bg = tone === 'ok' ? '#dcfce7' : tone === 'warn' ? '#ffedd5' : '#eef4f4';
  const fg = tone === 'ok' ? '#15803d' : tone === 'warn' ? '#c2410c' : '#5c7576';
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: bg }}>
      <Text style={[font.medium, { color: fg }]} className="text-xs">
        {label}
      </Text>
    </View>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <View>
      <Text style={[font.medium, { color, fontVariant: ['tabular-nums'] }]} className="mb-1 text-xs">
        {width}%
      </Text>
      <View className="overflow-hidden rounded-full" style={{ height: 8, backgroundColor: '#eef4f4' }}>
        <View className="rounded-full" style={{ height: 8, width: `${width}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function MixChip({ label, value, color, icon }: { label: string; value: number; color: string; icon: IconName }) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-line bg-card px-2 py-3">
      <DashIcon name={icon} color={color} />
      <Text style={[font.display, { fontVariant: ['tabular-nums'] }]} className="mt-2 text-xl text-ink">
        {value}
      </Text>
      <Text style={font.medium} className="mt-1 text-center text-xs text-mute">
        {label}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 780;
  const now = new Date();
  const [month, setMonth] = useState(monthISO(now.getFullYear(), now.getMonth()));
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showIncome = user ? canSeeIncome(user.role) : false;
  const clinician = user ? isClinician(user.role) : false;

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await api.dashboard(month));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the dashboard.');
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const totalSessions = report?.totalSessions ?? 0;
  const completed = report?.completed ?? 0;
  const arrived = report?.arrived ?? 0;
  const scheduled = report?.scheduled ?? 0;
  const cancelled = report?.cancelled ?? 0;
  const therapists = report?.therapists ?? [];
  const patients = report?.patients ?? [];
  const therapies = report?.therapies ?? [];
  const withVisits = patients.filter((person) => person.sessions > 0).length;
  const mix = totalSessions ? percent(completed, totalSessions) : 0;
  const assigned = therapies.filter((item) => item.name !== 'Unassigned');
  const topPatients = patients.slice(0, 8);

  const stats = [
    {
      label: 'Sessions',
      value: String(totalSessions),
      hint: `${completed} completed`,
      hintColor: '#22a06b',
      tint: '#e7f8ef',
      icon: 'calendar' as const,
      iconColor: '#22a06b',
    },
    {
      label: 'Cancelled',
      value: String(cancelled),
      hint: `${scheduled} upcoming`,
      hintColor: '#2eb5c0',
      tint: '#e5f7fb',
      icon: 'close' as const,
      iconColor: '#2eb5c0',
    },
    {
      label: 'Patients',
      value: String(patients.length),
      hint: `${withVisits} with visits`,
      hintColor: '#e07a6a',
      tint: '#eef8ee',
      icon: 'people' as const,
      iconColor: '#e07a6a',
    },
    ...(showIncome
      ? [
          {
            label: 'Income',
            value: dollars(report?.totalIncome ?? 0),
            hint: 'Recorded payments',
            hintColor: '#c4921a',
            tint: '#fbf6e0',
            icon: 'cash' as const,
            iconColor: '#c4921a',
          },
          {
            label: 'Expenses',
            value: dollars(report?.totalOutcome ?? 0),
            hint: 'Paid out this month',
            hintColor: '#9b3b36',
            tint: '#fdecec',
            icon: 'close' as const,
            iconColor: '#9b3b36',
          },
        ]
      : clinician
        ? []
        : [
            {
              label: 'Therapists',
              value: String(therapists.length),
              hint: 'On the desk',
              hintColor: '#0f5c5e',
              tint: '#e7f3f4',
              icon: 'users' as const,
              iconColor: '#0f5c5e',
            },
          ]),
  ];

  return (
    <Screen>
      <Text style={font.display} className="mb-4 text-3xl text-ink">
        Dashboard
      </Text>
      <View className="mb-5 flex-row items-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth((current) => shiftMonthISO(current, -1))}
          className="mb-4 mr-2 h-12 w-12 items-center justify-center rounded-xl border border-line bg-card"
        >
          <Text style={font.semibold} className="text-base text-ink">
            ←
          </Text>
        </Pressable>
        <View className="mr-2 flex-1">
          <MonthField value={month} onChange={(value) => { if (/^\d{4}-\d{2}$/.test(value)) setMonth(value); }} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setMonth((current) => shiftMonthISO(current, 1))}
          className="mb-4 h-12 w-12 items-center justify-center rounded-xl border border-line bg-card"
        >
          <Text style={font.semibold} className="text-base text-ink">
            →
          </Text>
        </Pressable>
      </View>
      {error ? <Banner tone="error">{error}</Banner> : null}

      <View className="mb-5 flex-row" style={{ marginHorizontal: -8 }}>
        {stats.map((card) => (
          <View key={card.label} className="flex-1" style={{ paddingHorizontal: 8 }}>
            <StatCard {...card} />
          </View>
        ))}
      </View>

      <View className={clinician ? 'mb-5 flex-row items-stretch' : wide ? 'mb-5 flex-row items-start' : 'mb-5'}>
        {clinician ? (
          <View className="mr-4 justify-center p-5" style={[PANEL, { width: wide ? 220 : 148 }]}>
            <Text style={font.medium} className="text-sm text-ink">
              All sessions
            </Text>
            <Text style={[font.display, { fontVariant: ['tabular-nums'] }]} className="mt-3 text-4xl text-ink">
              {totalSessions}
            </Text>
            <Text style={font.sans} className="mt-2 text-sm text-mute">
              this month
            </Text>
          </View>
        ) : (
        <View className={wide ? 'mr-4 flex-1' : 'mb-4'} style={PANEL}>
          <View className="px-5 pb-2 pt-5">
            <Text style={font.semibold} className="text-lg text-ink">
              Therapies
            </Text>
          </View>
          {wide ? (
            <View className="flex-row px-5 pb-2">
              <Text style={font.medium} className="flex-1 text-xs uppercase tracking-wide text-mute">
                Name
              </Text>
              <Text style={font.medium} className="w-24 text-xs uppercase tracking-wide text-mute">
                Share
              </Text>
              <Text style={font.medium} className="w-24 text-xs uppercase tracking-wide text-mute">
                Status
              </Text>
              {showIncome ? (
                <Text style={font.medium} className="w-20 text-right text-xs uppercase tracking-wide text-mute">
                  Income
                </Text>
              ) : (
                <Text style={font.medium} className="w-16 text-right text-xs uppercase tracking-wide text-mute">
                  Sessions
                </Text>
              )}
            </View>
          ) : null}
          {therapies.map((therapy) => {
            const share = percent(therapy.completed ?? 0, therapy.sessions);
            const tone = therapyTone(therapy.name);
            const active = therapy.sessions > 0;
            const pill = (
              <Pill
                label={therapy.name === 'Unassigned' ? 'Unassigned' : active ? 'Active' : 'Quiet'}
                tone={therapy.name === 'Unassigned' ? 'warn' : active ? 'ok' : 'mute'}
              />
            );
            if (!wide) {
              return (
                <View key={therapy.name} className="border-t border-line px-5 py-3.5" style={{ backgroundColor: tone.bg }}>
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="mr-3 flex-1">
                      <Text style={font.semibold} className="text-sm text-ink">
                        {therapy.name}
                      </Text>
                      <Text style={font.sans} className="mt-0.5 text-xs text-mute">
                        {therapy.sessions} {therapy.sessions === 1 ? 'session' : 'sessions'}
                        {showIncome ? ` · ${dollars(therapy.income)}` : ''}
                      </Text>
                    </View>
                    {pill}
                  </View>
                  <Bar value={share} color={tone.mark} />
                </View>
              );
            }
            return (
              <View key={therapy.name} className="flex-row items-center border-t border-line px-5 py-3.5" style={{ backgroundColor: tone.bg }}>
                <View className="mr-3 flex-1">
                  <Text style={font.semibold} className="text-sm text-ink">
                    {therapy.name}
                  </Text>
                  <Text style={font.sans} className="mt-0.5 text-xs text-mute">
                    {therapy.sessions} {therapy.sessions === 1 ? 'session' : 'sessions'}
                  </Text>
                </View>
                <View className="w-24 pr-3">
                  <Bar value={share} color={tone.mark} />
                </View>
                <View className="w-24">{pill}</View>
                <Text style={[font.semibold, { fontVariant: ['tabular-nums'] }]} className="w-20 text-right text-sm text-ink">
                  {showIncome ? dollars(therapy.income) : String(therapy.sessions)}
                </Text>
              </View>
            );
          })}
        </View>
        )}

        <View className={clinician ? 'flex-1' : wide ? 'w-80' : ''} style={PANEL}>
          <View className="p-5">
            <Text style={font.semibold} className="text-lg text-ink">
              Session mix
            </Text>
            <Text style={font.display} className="mt-2 text-4xl text-ink">
              {mix}%
            </Text>
            <Text style={font.sans} className="mb-4 text-sm text-mute">
              completed of booked sessions
            </Text>
            {clinician ? null : (
            <View className="mb-4 flex-row">
              {assigned.map((therapy, index) => (
                <View key={therapy.name} className={index === assigned.length - 1 ? 'flex-1' : 'mr-1.5 flex-1'}>
                  <View className="mb-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: '#eef4f4' }}>
                    <View
                      className="h-1.5 rounded-full"
                      style={{ width: `${percent(therapy.sessions, totalSessions)}%`, backgroundColor: therapyTone(therapy.name).mark }}
                    />
                  </View>
                  <Text style={font.medium} className="text-center text-xs text-mute">
                    {percent(therapy.sessions, totalSessions)}%
                  </Text>
                </View>
              ))}
            </View>
            )}
            <View className="flex-row" style={{ marginHorizontal: -4 }}>
              <View className="flex-1" style={{ paddingHorizontal: 4 }}>
                <MixChip label="Completed" value={completed} color="#22a06b" icon="check" />
              </View>
              <View className="flex-1" style={{ paddingHorizontal: 4 }}>
                <MixChip label="Upcoming" value={scheduled} color="#e07a45" icon="clock" />
              </View>
              <View className="flex-1" style={{ paddingHorizontal: 4 }}>
                <MixChip label="Cancelled" value={cancelled} color="#9b3b36" icon="close" />
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/reserve')}
            className="m-5 mt-0 overflow-hidden rounded-2xl px-5 py-4"
            style={{ backgroundColor: '#0f5c5e' }}
          >
            <Text style={font.display} className="text-2xl text-card">
              Book the next visit
            </Text>
            <Text style={font.sans} className="mt-1 text-sm text-sand">
              Open the booking desk
            </Text>
          </Pressable>
        </View>
      </View>

      <View className={wide ? 'flex-row items-start' : ''}>
        {clinician ? null : (
        <View className={wide ? 'mr-4 flex-1' : 'mb-4'} style={PANEL}>
          <View className="px-5 pb-2 pt-5">
            <Text style={font.semibold} className="text-lg text-ink">
              Therapists
            </Text>
          </View>
          {therapists.length === 0 ? (
            <Text style={font.sans} className="px-5 pb-5 text-sm text-mute">
              No therapists on the desk yet.
            </Text>
          ) : (
            therapists.map((person) => {
              const tone = therapyTone(person.therapyType);
              return (
                <View key={person.id} className="flex-row items-center border-t border-line px-5 py-3" style={{ backgroundColor: tone.bg }}>
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: tone.mark }}
                  >
                    <Text style={font.semibold} className="text-sm text-card">
                      {initials(person.name ?? 'T')}
                    </Text>
                  </View>
                  <View className="mr-3 flex-1">
                    <Text style={font.semibold} className="text-sm text-ink">
                      {person.name}
                    </Text>
                    <Text style={font.sans} className="text-xs text-mute">
                      {tone.label}
                    </Text>
                  </View>
                  <Text style={[font.semibold, { fontVariant: ['tabular-nums'] }]} className="text-sm text-ink">
                    {person.sessions}
                  </Text>
                </View>
              );
            })
          )}
        </View>
        )}

        <View className={clinician || !wide ? 'flex-1' : 'flex-1'} style={PANEL}>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-5">
            <Text style={font.semibold} className="text-lg text-ink">
              Patients
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/patients')}>
              <Text style={font.medium} className="text-sm text-moss">
                View all
              </Text>
            </Pressable>
          </View>
          {topPatients.length === 0 ? (
            <Text style={font.sans} className="px-5 pb-5 text-sm text-mute">
              No patients on file.
            </Text>
          ) : (
            topPatients.map((person) => {
              const tone = therapyTone(person.therapyType);
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/patients/${person.id}`)}
                  className="flex-row items-center border-t border-line px-5 py-3"
                  style={{ backgroundColor: tone.bg }}
                >
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: tone.mark }}
                  >
                    <Text style={font.semibold} className="text-sm text-card">
                      {initials(person.fullName ?? 'P')}
                    </Text>
                  </View>
                  <View className="mr-3 flex-1">
                    <Text style={font.semibold} className="text-sm text-ink">
                      {person.fullName}
                    </Text>
                    <Text style={font.sans} className="text-xs text-mute">
                      {tone.label}
                    </Text>
                  </View>
                  <Text style={[font.semibold, { fontVariant: ['tabular-nums'] }]} className="text-sm text-ink">
                    {person.sessions}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </Screen>
  );
}
