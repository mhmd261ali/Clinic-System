import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { api } from './api';
import { PATIENT_TYPES } from './format';

export function useTherapies() {
  const [therapies, setTherapies] = useState<string[]>(PATIENT_TYPES);

  const load = useCallback(async () => {
    try {
      const data = await api.therapies();
      if (data.therapies.length) setTherapies(data.therapies);
    } catch {
      setTherapies(PATIENT_TYPES);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return therapies;
}
