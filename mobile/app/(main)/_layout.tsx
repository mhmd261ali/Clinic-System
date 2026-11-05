import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrawerNav, MobileBar, SideNav, useDeskBadges } from '../../components/Nav';
import { useAuth } from '../../lib/auth';
import { WIDE } from '../../lib/format';

export default function MainLayout() {
  const { user, ready, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE;
  const badges = useDeskBadges();
  const [menu, setMenu] = useState(false);

  if (!ready) return <View className="flex-1 bg-paper" />;
  if (!user) return <Redirect href="/login" />;

  return (
    <View className="flex-1 flex-row bg-paper">
      {wide ? (
        <SideNav
          user={user}
          badges={badges}
          insetTop={insets.top}
          insetBottom={insets.bottom}
          onSignOut={() => void signOut()}
        />
      ) : null}
      <View className="flex-1" style={{ paddingTop: wide ? 0 : insets.top }}>
        {wide ? null : <MobileBar user={user} onToggle={() => setMenu(true)} />}
        <View className="flex-1">
          <Slot />
        </View>
      </View>
      {!wide && menu ? (
        <View className="absolute bottom-0 left-0 right-0 top-0 flex-row" style={{ zIndex: 30 }}>
          <DrawerNav
            user={user}
            badges={badges}
            insetTop={insets.top}
            insetBottom={insets.bottom}
            onSignOut={() => void signOut()}
            onNavigate={() => setMenu(false)}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => setMenu(false)} className="flex-1" style={{ backgroundColor: 'rgba(18, 48, 51, 0.45)' }} />
        </View>
      ) : null}
    </View>
  );
}
