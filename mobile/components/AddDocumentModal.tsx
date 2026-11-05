import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { api } from '../lib/api';
import type { Patient, PickedFile, User } from '../lib/types';
import { PatientSearch } from './PatientSearch';
import { StaffSearch } from './StaffSearch';
import { Banner, Button, Field, font } from './ui';

export type DocumentSubject = 'patients' | 'staff' | 'archive';

export function AddDocumentModal({
  open,
  initialSubject,
  initialPatient,
  initialStaff,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialSubject: DocumentSubject;
  initialPatient?: Patient | null;
  initialStaff?: User | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [subject, setSubject] = useState<DocumentSubject>(initialSubject);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [patient, setPatient] = useState<Patient | null>(initialPatient ?? null);
  const [staff, setStaff] = useState<User | null>(initialStaff ?? null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pickingPerson = subject === 'staff' ? !staff : subject === 'patients' ? !patient : false;

  useEffect(() => {
    if (!open) return;
    setSubject(initialSubject);
    setName('');
    setDescription('');
    setPatient(initialPatient ?? null);
    setStaff(initialStaff ?? null);
    setFile(null);
    setError(null);
    setBusy(false);
  }, [open, initialSubject, initialPatient, initialStaff]);

  if (!open) return null;

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? undefined,
      file: 'file' in asset ? (asset.file as Blob | undefined) : undefined,
    });
    if (!name.trim()) setName(asset.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  }

  async function submit() {
    if (!name.trim()) {
      setError('Name the document. Search uses that name.');
      return;
    }
    if (subject === 'patients' && !patient) {
      setError('Choose a patient.');
      return;
    }
    if (subject === 'staff' && !staff) {
      setError('Choose a staff member.');
      return;
    }
    if (!file) {
      setError('Attach a file.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createDocument({
        name: name.trim(),
        description: description.trim(),
        patientId: subject === 'patients' ? patient?.id : undefined,
        staffId: subject === 'staff' ? staff?.id : undefined,
        file,
      });
      onSaved(name.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center px-4 py-4" style={{ backgroundColor: 'rgba(18, 48, 51, 0.45)', zIndex: 20 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close add document" onPress={() => { if (!busy) onClose(); }} className="absolute inset-0" />
      <View
        className="rounded-2xl border border-line bg-card px-6 py-5"
        style={{
          width: Math.min(width - 32, 720),
          maxHeight: height - 32,
          height: pickingPerson ? height - 32 : undefined,
          overflow: 'hidden',
        }}
      >
        <Text style={font.display} className="mb-3 text-2xl text-ink">
          Add a document
        </Text>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Field label="Document name" value={name} onChangeText={setName} placeholder="Hassan blood panel" />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="What the file is for" />
        <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
          This document refers to
        </Text>
        <View className="mb-3 flex-row rounded-full border border-line bg-card p-1">
          {(['patients', 'staff', 'archive'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: subject === item }}
              onPress={() => setSubject(item)}
              className={`flex-1 items-center rounded-full py-2 ${subject === item ? 'bg-pine' : ''}`}
            >
              <Text style={[font.medium, { color: subject === item ? '#ffffff' : '#123033' }]} className="text-sm">
                {item === 'patients' ? 'Patients' : item === 'staff' ? 'Staff' : 'Archive'}
              </Text>
            </Pressable>
          ))}
        </View>
        {subject === 'staff' ? <StaffSearch selected={staff} onSelect={setStaff} fillList={pickingPerson} /> : null}
        {subject === 'patients' ? <PatientSearch selected={patient} onSelect={setPatient} fillList={pickingPerson} /> : null}
        {subject === 'archive' ? (
          <Text style={font.sans} className="mb-4 text-base leading-6 text-mute">
            This file stays in the archive, not on a patient or a staff member.
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => void pickFile()} className="mb-3 rounded-xl border border-dashed border-line bg-card px-3 py-3">
          <Text style={font.medium} className="text-sm text-ink">
            {file ? file.name : 'Choose a PDF, image, text, or Word file'}
          </Text>
        </Pressable>
        <View className="flex-row">
          <View className="mr-3 flex-1">
            <Button label={busy ? 'Adding…' : 'Save document'} disabled={busy} onPress={() => void submit()} />
          </View>
          <View className="flex-1">
            <Button label="Cancel" tone="ghost" onPress={() => { if (!busy) onClose(); }} />
          </View>
        </View>
      </View>
    </View>
  );
}
