import { Platform, Pressable, Text, View } from 'react-native';

import { api } from '../lib/api';
import { downloadDocument } from '../lib/files';
import { formatStamp } from '../lib/format';
import type { DocumentRow } from '../lib/types';
import { confirmAction, font, therapySurface, TherapyPill } from './ui';

export function DocumentRows({
  documents,
  canRemove,
  empty,
  onChanged,
  onError,
}: {
  documents: DocumentRow[];
  canRemove: boolean;
  empty: string;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <Text style={font.sans} className="text-base text-mute">
        {empty}
      </Text>
    );
  }

  return (
    <View>
      {documents.map((document) => (
        <View key={document.id} className="mb-3 flex-row items-center rounded-2xl border border-line bg-card p-4" style={therapySurface(document.therapyType)}>
          <View className="mr-3 flex-1">
            <View className="mb-1 flex-row items-start justify-between">
              <Text style={font.semibold} className="mr-3 flex-1 text-lg text-ink">
                {document.name}
              </Text>
              {document.therapyType ? <TherapyPill therapy={document.therapyType} /> : null}
            </View>
            <Text style={font.sans} className="mt-1 text-sm text-mute">
              {[document.uploadedByName ? `Added by ${document.uploadedByName}` : null, formatStamp(document.createdAt)].filter(Boolean).join(' · ')}
            </Text>
            {document.description ? (
              <Text style={font.sans} className="mt-2 text-sm leading-5 text-ink">
                {document.description}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Download ${document.name}`}
              onPress={() => void downloadDocument(document).catch((reason: unknown) => onError(reason instanceof Error ? reason.message : 'Could not download that file.'))}
              className="h-10 w-10 items-center justify-center rounded-full"
            >
              <ActionIcon kind="download" />
            </Pressable>
            {canRemove ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${document.name}`}
                onPress={() => void remove(document)}
                className="h-10 w-10 items-center justify-center rounded-full"
              >
                <ActionIcon kind="remove" />
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );

  async function remove(document: DocumentRow) {
    const ok = await confirmAction('Remove this document?', document.name);
    if (!ok) return;
    try {
      await api.deleteDocument(document.id);
      onChanged();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not remove the document.');
    }
  }
}

function ActionIcon({ kind }: { kind: 'download' | 'remove' }) {
  if (Platform.OS !== 'web') {
    return <Text style={[font.semibold, { color: '#146e70', fontSize: 18 }]}>{kind === 'download' ? '↓' : '✕'}</Text>;
  }
  if (kind === 'download') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#146e70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#146e70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
