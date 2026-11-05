import { Platform } from 'react-native';

import { getToken, serverUrl } from './api';
import type { DocumentRow } from './types';

export async function downloadTextFile(fileName: string, body: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = href;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(href);
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const safeName = fileName.replace(/[^\w.\-]+/g, '_');
  const uri = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(uri, body);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: fileName });
}

export async function downloadDocument(document: DocumentRow) {
  const token = await getToken();
  const url = `${serverUrl()}/api/documents/${document.id}/file`;
  if (!document.fileName) throw new Error('That document has no file.');

  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } });
    if (!response.ok) throw new Error('Could not download that file.');
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = href;
    anchor.download = document.fileName;
    anchor.click();
    URL.revokeObjectURL(href);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const safeName = document.fileName.replace(/[^\w.\-]+/g, '_');
  const result = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${safeName}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(result.uri);
}
