import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Screen } from '../../components/Screen';
import { VisitCard } from '../../components/VisitCard';
import { Banner, PageTitle, font } from '../../components/ui';
import { api } from '../../lib/api';
import { publishPendingCount } from '../../lib/pendingBadge';
import type { Reservation } from '../../lib/types';

export default function PendingScreen() {
  const [pending, setPending] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const waiting = await api.reservations({ pending: true });
      setPending(waiting.reservations);
      publishPendingCount(waiting.reservations.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load pending sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function changed(next: Reservation) {
    if (next.status === 'completed' || next.status === 'cancelled') {
      setPending((current) => {
        const remaining = current.filter((visit) => visit.id !== next.id);
        publishPendingCount(remaining.length);
        return remaining;
      });
      return;
    }
    setPending((current) => current.map((visit) => (visit.id === next.id ? next : visit)));
  }

  return (
    <Screen>
      <PageTitle
        kicker="Bookings"
        title="Pending"
        detail={loading ? 'Opening finished sessions…' : pending.length ? `${pending.length} waiting to be submitted` : 'Nothing is waiting'}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Text style={font.sans} className="mb-4 text-base leading-6 text-mute">
        Sessions whose time has finished stay here until they are submitted.
      </Text>
      {pending.length === 0 && !loading ? (
        <Text style={font.sans} className="text-base text-mute">
          No finished sessions are waiting.
        </Text>
      ) : (
        pending.map((visit) => (
          <View key={visit.id} className="mb-4">
            <VisitCard visit={visit} pending onChanged={changed} />
          </View>
        ))
      )}
    </Screen>
  );
}
