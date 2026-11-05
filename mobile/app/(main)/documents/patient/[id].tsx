import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { AddDocumentModal } from '../../../../components/AddDocumentModal';
import { DocumentRows } from '../../../../components/DocumentRows';
import { Screen } from '../../../../components/Screen';
import { Banner, PageTitle, font } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';
import { canDelete, canUpload } from '../../../../lib/permissions';
import type { DocumentRow, Patient } from '../../../../lib/types';

export default function PatientDocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const patientId = Number(params.id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = user ? canUpload(user.role) : false;
  const canRemove = user ? canDelete(user.role) : false;

  const load = useCallback(async () => {
    if (!Number.isInteger(patientId)) return;
    try {
      const [person, files] = await Promise.all([api.patient(patientId), api.documents({ patientId })]);
      setPatient(person.patient);
      setDocuments(files.documents);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load these documents.');
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View className="flex-1">
      <Screen>
        <Pressable accessibilityRole="button" onPress={() => router.push('/documents')} className="mb-3 self-start">
          <Text style={font.medium} className="text-sm text-moss">
            Documents
          </Text>
        </Pressable>
        <View className="flex-row items-start justify-between">
          <View className="mr-4 flex-1">
            <PageTitle kicker="Patient" title={patient?.fullName || 'Documents'} detail="Files kept for this patient." />
          </View>
          {upload ? (
            <Pressable accessibilityRole="button" onPress={() => setAdding(true)} className="mt-1 rounded-full bg-clay px-3 py-2">
              <Text style={font.medium} className="text-sm text-card">
                Add a document
              </Text>
            </Pressable>
          ) : null}
        </View>
        {message ? <Banner tone="ok">{message}</Banner> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        <DocumentRows documents={documents} canRemove={canRemove} empty="No documents for this patient yet." onChanged={() => void load()} onError={setError} />
      </Screen>
      <AddDocumentModal
        open={adding}
        initialSubject="patients"
        initialPatient={patient}
        onClose={() => setAdding(false)}
        onSaved={(saved) => {
          setAdding(false);
          setMessage(`Added “${saved}”.`);
          void load();
        }}
      />
    </View>
  );
}
