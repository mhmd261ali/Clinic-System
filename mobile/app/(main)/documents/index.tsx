import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { AddDocumentModal, type DocumentSubject } from '../../../components/AddDocumentModal';
import { DocumentRows } from '../../../components/DocumentRows';
import { Screen } from '../../../components/Screen';
import { Banner, Field, PageTitle, RolePill, TherapyPill, font, therapySurface } from '../../../components/ui';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { todayISO } from '../../../lib/format';
import { canDelete, canUpload, isClinician } from '../../../lib/permissions';
import type { DocumentRow, Patient, User } from '../../../lib/types';

type Tab = DocumentSubject;

function countOf(documents: DocumentRow[], id: number, key: 'patientId' | 'staffId') {
  return documents.filter((document) => document[key] === id).length;
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('patients');
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [archive, setArchive] = useState<DocumentRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = user ? canUpload(user.role) : false;
  const canRemove = user ? canDelete(user.role) : false;
  const clinician = user ? isClinician(user.role) : false;

  const load = useCallback(async () => {
    try {
      const [roster, files, archived, people] = await Promise.all([
        api.patients('', todayISO()),
        api.documents(),
        api.documents({ archive: true }),
        clinician ? api.doctors().then((data) => data.doctors.map((doctor) => ({ ...doctor, email: '', role: 'user' as const }))) : api.users().then((data) => data.users),
      ]);
      setPatients([...roster.patients].sort((left, right) => left.fullName.localeCompare(right.fullName, undefined, { sensitivity: 'base' })));
      setDocuments(files.documents);
      setArchive(archived.documents);
      setStaff([...people].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load documents.');
    }
  }, [clinician]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const term = query.trim().toLowerCase();
  const visiblePatients = useMemo(
    () => patients.filter((person) => !term || person.fullName.toLowerCase().includes(term) || (person.phone ?? '').toLowerCase().includes(term)),
    [patients, term],
  );
  const visibleStaff = useMemo(
    () => staff.filter((person) => !term || person.name.toLowerCase().includes(term) || (person.therapyType ?? '').toLowerCase().includes(term)),
    [staff, term],
  );
  const visibleArchive = useMemo(
    () => archive.filter((document) => !term || document.name.toLowerCase().includes(term)),
    [archive, term],
  );

  function openTab(next: Tab) {
    setTab(next);
    setQuery('');
    setMessage(null);
  }

  return (
    <View className="flex-1">
      <Screen>
        <View className="flex-row items-start justify-between">
          <View className="mr-4 flex-1">
            <PageTitle kicker="Files" title="Documents" detail="Patients and staff keep their own files. Archive holds everything else." />
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
        <View className="mb-5 flex-row rounded-full border border-line bg-card p-1">
          {(['patients', 'staff', 'archive'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === item }}
              onPress={() => openTab(item)}
              className={`flex-1 items-center rounded-full py-2 ${tab === item ? 'bg-pine' : ''}`}
            >
              <Text style={[font.medium, { color: tab === item ? '#ffffff' : '#123033' }]} className="text-sm">
                {item === 'patients' ? 'Patients' : item === 'staff' ? 'Staff' : 'Archive'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label={tab === 'archive' ? 'Search documents' : 'Search'}
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'patients' ? 'Patient name' : tab === 'staff' ? 'Staff name' : 'Document name'}
        />
        {tab === 'patients'
          ? visiblePatients.map((person) => {
              const count = countOf(documents, person.id, 'patientId');
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/documents/patient/${person.id}`)}
                  className="mb-2 rounded-2xl border px-4 py-3"
                  style={therapySurface(person.therapyType)}
                >
                  <View className="flex-row items-start justify-between">
                    <Text style={font.semibold} className="mr-3 flex-1 text-lg text-ink">
                      {person.fullName}
                    </Text>
                    <TherapyPill therapy={person.therapyType} />
                  </View>
                  <Text style={font.sans} className="mt-1 text-sm text-mute">
                    {count === 1 ? '1 document' : `${count} documents`}
                    {person.phone ? ` · ${person.phone}` : ''}
                  </Text>
                </Pressable>
              );
            })
          : null}
        {tab === 'patients' && visiblePatients.length === 0 ? (
          <Text style={font.sans} className="text-base text-mute">
            No patients match.
          </Text>
        ) : null}
        {tab === 'staff'
          ? visibleStaff.map((person) => {
              const count = countOf(documents, person.id, 'staffId');
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/documents/staff/${person.id}`)}
                  className="mb-2 rounded-2xl border px-4 py-3"
                  style={therapySurface(person.therapyType)}
                >
                  <View className="flex-row items-start justify-between">
                    <Text style={font.semibold} className="mr-3 flex-1 text-lg text-ink">
                      {person.name}
                    </Text>
                    {person.role ? <RolePill role={person.role} /> : null}
                  </View>
                  <Text style={font.sans} className="mt-1 text-sm text-mute">
                    {[person.therapyType, count === 1 ? '1 document' : `${count} documents`].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              );
            })
          : null}
        {tab === 'staff' && visibleStaff.length === 0 ? (
          <Text style={font.sans} className="text-base text-mute">
            No staff match.
          </Text>
        ) : null}
        {tab === 'archive' ? (
          <DocumentRows
            documents={visibleArchive}
            canRemove={canRemove}
            empty={archive.length === 0 ? 'The archive is empty.' : 'No documents match.'}
            onChanged={() => void load()}
            onError={setError}
          />
        ) : null}
      </Screen>
      <AddDocumentModal
        open={adding}
        initialSubject={tab}
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
