import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { api } from '../lib/api';
import { subscribePendingCount } from '../lib/pendingBadge';
import { canManageSettings, canManageStaff, canSeeIncome, canSeeOutcome } from '../lib/permissions';
import type { DeskSummary, User } from '../lib/types';
import { font } from './ui';

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/bookings', label: 'Bookings', icon: 'bookings' },
  { href: '/pending', label: 'Pending', icon: 'pending' },
  { href: '/reserve', label: 'Book', icon: 'book' },
  { href: '/calendar', label: 'Month', icon: 'month' },
  { href: '/patients', label: 'Patients', icon: 'patients' },
  { href: '/documents', label: 'Documents', icon: 'documents' },
  { href: '/instruments', label: 'Instruments', icon: 'instruments' },
] as const;

type NavIconName = (typeof ITEMS)[number]['icon'] | 'staff' | 'income' | 'outcome' | 'settings';

type NavItem = { href: string; label: string; icon: NavIconName };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function useDeskBadges() {
  const [badges, setBadges] = useState<DeskSummary>({ running: false, pending: 0 });
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const next = await api.deskSummary();
        if (alive) setBadges(next);
      } catch {
        if (alive) setBadges({ running: false, pending: 0 });
      }
    }
    void load();
    const timer = setInterval(() => void load(), 20000);
    const unsubscribe = subscribePendingCount((pending) => {
      setBadges((current) => ({ ...current, pending }));
    });
    return () => {
      alive = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, []);
  return badges;
}

function navItems(user: User) {
  const extras: NavItem[] = [];
  if (canSeeIncome(user.role)) extras.push({ href: '/income', label: 'Income', icon: 'income' });
  if (canSeeOutcome(user.role)) extras.push({ href: '/outcome', label: 'Expenses', icon: 'outcome' });
  if (canManageStaff(user.role)) extras.push({ href: '/staff', label: 'Staff', icon: 'staff' });
  if (canManageSettings(user.role)) extras.push({ href: '/settings', label: 'Settings', icon: 'settings' });
  return [...ITEMS, ...extras];
}

export function SideNav({
  user,
  badges,
  insetTop,
  insetBottom,
  onSignOut,
}: {
  user: User;
  badges: DeskSummary;
  insetTop: number;
  insetBottom: number;
  onSignOut: () => void;
}) {
  return (
    <View
      style={{ width: 240, paddingTop: Math.max(insetTop, 28), paddingBottom: Math.max(insetBottom, 24) }}
      className="justify-between bg-pine px-5"
    >
      <View>
        <Text style={font.display} className="text-3xl text-card">
          PhysioCore
        </Text>
        <Text style={font.sans} className="mb-8 mt-1 text-sm text-sand">
          Clinic desk
        </Text>
        <NavList user={user} badges={badges} />
      </View>
      <AccountRow user={user} onSignOut={onSignOut} />
    </View>
  );
}

export function DrawerNav({
  user,
  badges,
  insetTop,
  insetBottom,
  onSignOut,
  onNavigate,
}: {
  user: User;
  badges: DeskSummary;
  insetTop: number;
  insetBottom: number;
  onSignOut: () => void;
  onNavigate: () => void;
}) {
  return (
    <View
      style={{ width: 260, paddingTop: Math.max(insetTop, 16), paddingBottom: Math.max(insetBottom, 16) }}
      className="h-full justify-between bg-pine px-4"
    >
      <NavList user={user} badges={badges} onNavigate={onNavigate} />
      <AccountRow user={user} onSignOut={onSignOut} />
    </View>
  );
}

export function MobileBar({ user, onToggle }: { user: User; onToggle: () => void }) {
  return (
    <View className="flex-row items-center justify-between border-b border-line bg-paper px-4 py-3">
      <View className="mr-3 flex-1">
        <Text style={font.display} className="text-2xl text-ink">
          PhysioCore
        </Text>
        <Text style={font.sans} className="text-xs text-mute">
          {user.name}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open menu" onPress={onToggle} className="h-11 w-11 items-center justify-center rounded-xl border border-line bg-card">
        <MenuIcon />
      </Pressable>
    </View>
  );
}

function NavList({ user, badges, onNavigate }: { user: User; badges: DeskSummary; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View>
      {navItems(user).map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Pressable
            key={item.href}
            accessibilityRole="button"
            onPress={() => {
              router.push(item.href);
              onNavigate?.();
            }}
            className={`mb-1 flex-row items-center rounded-xl px-3 py-3 ${active ? 'bg-white/10' : ''}`}
          >
            <View className="mr-3 h-5 w-5 items-center justify-center">
              <NavIcon name={item.icon} color={active ? '#ffffff' : '#d7f4f4'} />
            </View>
            <Text style={font.medium} className={`flex-1 text-base ${active ? 'text-card' : 'text-sand'}`}>
              {item.label}
            </Text>
            {item.href === '/bookings' && badges.running ? <LiveDot /> : null}
            {item.href === '/pending' && badges.pending > 0 ? <PendingMark count={badges.pending} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function AccountRow({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <View className="mt-6 flex-row items-center">
      <Text style={font.semibold} className="mr-3 flex-1 text-base text-card" numberOfLines={1}>
        {user.name}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={onSignOut} className="h-10 w-10 items-center justify-center">
        <SignOutIcon />
      </Pressable>
    </View>
  );
}

function LiveDot() {
  const opacity = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3dd68c', opacity }} />;
}

function PendingMark({ count }: { count: number }) {
  return (
    <View className="flex-row items-center rounded-md px-1.5 py-0.5" style={{ backgroundColor: '#dc2626' }}>
      <Text style={[font.semibold, { color: '#ffffff' }]} className="text-xs">
        ! {count}
      </Text>
    </View>
  );
}

function MenuIcon() {
  if (Platform.OS !== 'web') return <Text style={[font.semibold, { color: '#123033' }]}>☰</Text>;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123033" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function SignOutIcon() {
  if (Platform.OS !== 'web') return <Text style={[font.semibold, { color: '#d7f4f4' }]}>↪</Text>;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d7f4f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function NavIcon({ name, color }: { name: NavIconName; color: string }) {
  if (Platform.OS !== 'web') {
    const mark =
      name === 'dashboard'
        ? '▣'
        : name === 'bookings'
          ? '◷'
          : name === 'pending'
            ? '!'
            : name === 'book'
              ? '+'
              : name === 'month'
                ? '▦'
                : name === 'patients'
                  ? '☺'
                  : name === 'documents'
                    ? '▤'
                    : name === 'instruments'
                      ? '⚒'
                      : name === 'income'
                        ? '$'
                        : name === 'outcome'
                          ? '↓'
                          : name === 'settings'
                            ? '⚙'
                            : '◉';
    return <Text style={[font.medium, { color, fontSize: 14, lineHeight: 18 }]}>{mark}</Text>;
  }

  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'dashboard') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="5" rx="1" />
        <rect x="13" y="10" width="8" height="11" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
      </svg>
    );
  }
  if (name === 'bookings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (name === 'pending') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  if (name === 'book') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    );
  }
  if (name === 'month') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (name === 'patients') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === 'documents') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  if (name === 'instruments') {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  }
  if (name === 'income') {
    return (
      <svg {...common}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (name === 'outcome') {
    return (
      <svg {...common}>
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 19 19 12" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
