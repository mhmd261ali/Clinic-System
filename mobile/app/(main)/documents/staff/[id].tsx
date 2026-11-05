import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { AddDocumentModal } from '../../../../components/AddDocumentModal';
import { DocumentRows } from '../../../../components/DocumentRows';
import { Screen } from '../../../../components/Screen';
import { Banner, PageTitle, font } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';
import { canDelete, canUpload, isClinician } from '../../../../lib/permissions';
import type { DocumentRow, User } from '../../../../lib/types';

export default function StaffDocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const staffId = Number(params.id);
  const [person, setPerson] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = user ? canUpload(user.role) : false;
  const canRemove = user ? canDelete(user.role) : false;
  const clinician = user ? isClinician(user.role) : false;

  const load = useCallback(async () => {
    if (!Number.isInteger(staffId)) return;
    try {
      const [roster, files] = await Promise.all([
        clinician ? api.doctors().then((data) => data.doctors.map((doctor) => ({ ...doctor, email: '', role: 'user' as const }))) : api.users().then((data) => data.users),
        api.documents({ staffId }),
      ]);
      setPerson(roster.find((member) => member.id === staffId) ?? null);
      setDocuments(files.documents);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load these documents.');
    }
  }, [clinician, staffId]);

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
            <PageTitle kicker="Staff" title={person?.name || 'Documents'} detail="Files kept for this staff member." />
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
        {!person && !error ? (
          <Text style={font.sans} className="text-base text-mute">
            That staff member is not on your list.
          </Text>
        ) : (
          <DocumentRows documents={documents} canRemove={canRemove} empty="No documents for this staff member yet." onChanged={() => void load()} onError={setError} />
        )}
      </Screen>
      <AddDocumentModal
        open={adding && person != null}
        initialSubject="staff"
        initialStaff={person}
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
