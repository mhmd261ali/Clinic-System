import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClinicSettings, DashboardReport, DeskSummary, Doctor, DocumentRow, IncomeMonth, Instrument, OutcomeMonth, Patient, PatientReport, PickedFile, Reservation, User, VisitStatus } from './types';
import { toISO } from './format';

const TOKEN_KEY = 'halden.token';

export function serverUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (Platform.OS === 'web') return 'http://127.0.0.1:4000';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000` : 'http://localhost:4000';
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) return AsyncStorage.setItem(TOKEN_KEY, token);
  return AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${serverUrl()}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Cannot reach the clinic server at ${serverUrl()}.`);
  }

  const raw = await response.text();
  let data: { error?: string } | null = null;
  if (raw) {
    try {
      data = JSON.parse(raw) as { error?: string };
    } catch {
      data = null;
    }
  }

  if (response.status === 401 && token && path !== '/api/auth/login') onUnauthorized?.();
  if (!response.ok) throw new Error(data?.error || 'The request failed.');
  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request<{ user: User }>('/api/auth/me');
  },
  patients(q: string, today: string) {
    const params = new URLSearchParams({ today });
    if (q.trim()) params.set('q', q.trim());
    return request<{ patients: Patient[] }>(`/api/patients?${params.toString()}`);
  },
  createPatient(body: Partial<Patient>) {
    return request<{ patient: Patient }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  patient(id: number) {
    return request<{ patient: Patient }>(`/api/patients/${id}`);
  },
  updatePatient(id: number, body: Partial<Patient>) {
    return request<{ patient: Patient }>(`/api/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  patientReport(id: number) {
    return request<PatientReport>(`/api/patients/${id}/report`, { method: 'POST' });
  },
  deletePatient(id: number) {
    return request<{ ok: true }>(`/api/patients/${id}`, { method: 'DELETE' });
  },
  reservations(query: { date?: string; from?: string; to?: string; patientId?: number; pending?: boolean }) {
    const params = new URLSearchParams();
    if (query.pending) {
      const now = new Date();
      params.set('pending', '1');
      params.set('date', toISO(now));
      params.set('time', `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    } else {
      if (query.date) params.set('date', query.date);
    }
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.patientId) params.set('patientId', String(query.patientId));
    return request<{ reservations: Reservation[] }>(`/api/reservations?${params.toString()}`);
  },
  deskSummary() {
    const now = new Date();
    const params = new URLSearchParams({
      date: toISO(now),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    });
    return request<DeskSummary>(`/api/reservations/summary?${params.toString()}`);
  },
  createReservation(body: Record<string, unknown>) {
    return request<{ reservation: Reservation; overlaps: Reservation[] }>('/api/reservations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateReservation(id: number, body: Partial<Reservation> & { status?: VisitStatus }) {
    return request<{ reservation: Reservation; overlaps: Reservation[] }>(`/api/reservations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  deleteReservation(id: number) {
    return request<{ ok: true }>(`/api/reservations/${id}`, { method: 'DELETE' });
  },
  income(month: string) {
    const params = new URLSearchParams({ month });
    return request<IncomeMonth>(`/api/income?${params.toString()}`);
  },
  dashboard(month: string) {
    const params = new URLSearchParams({ month });
    return request<DashboardReport>(`/api/dashboard?${params.toString()}`);
  },
  documents(query: { q?: string; patientId?: number; staffId?: number; archive?: boolean } = {}) {
    const params = new URLSearchParams();
    if (query.q?.trim()) params.set('q', query.q.trim());
    if (query.patientId) params.set('patientId', String(query.patientId));
    if (query.staffId) params.set('staffId', String(query.staffId));
    if (query.archive) params.set('archive', '1');
    return request<{ documents: DocumentRow[] }>(`/api/documents?${params.toString()}`);
  },
  createDocument(input: { name: string; description?: string; patientId?: number | null; staffId?: number | null; file: PickedFile }) {
    const body = new FormData();
    body.append('name', input.name);
    if (input.description) body.append('description', input.description);
    if (input.patientId) body.append('patientId', String(input.patientId));
    if (input.staffId) body.append('staffId', String(input.staffId));
    if (Platform.OS === 'web' && input.file.file) {
      body.append('file', input.file.file);
    } else {
      body.append('file', {
        uri: input.file.uri,
        name: input.file.name,
        type: input.file.mimeType || 'application/octet-stream',
      } as unknown as Blob);
    }
    return request<{ document: DocumentRow }>('/api/documents', { method: 'POST', body });
  },
  deleteDocument(id: number) {
    return request<{ ok: true }>(`/api/documents/${id}`, { method: 'DELETE' });
  },
  doctors(therapy?: string) {
    const params = new URLSearchParams();
    if (therapy) params.set('therapy', therapy);
    const query = params.toString();
    return request<{ doctors: Doctor[] }>(`/api/doctors${query ? `?${query}` : ''}`);
  },
  users() {
    return request<{ users: User[] }>('/api/users');
  },
  createUser(body: { name: string; email: string; password: string; phone: string; role: User['role']; therapyType?: string | null }) {
    return request<{ user: User }>('/api/users', { method: 'POST', body: JSON.stringify(body) });
  },
  updateUser(
    id: number,
    body: { name: string; email: string; password?: string; phone: string; role: User['role']; therapyType?: string | null },
  ) {
    return request<{ user: User }>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteUser(id: number) {
    return request<{ ok: true }>(`/api/users/${id}`, { method: 'DELETE' });
  },
  instruments(therapy?: string) {
    const params = new URLSearchParams();
    if (therapy) params.set('therapy', therapy);
    const query = params.toString();
    return request<{ instruments: Instrument[] }>(`/api/instruments${query ? `?${query}` : ''}`);
  },
  createInstrument(input: { name: string; usedFor: string; therapyType: string; price?: string; image: PickedFile }) {
    const body = new FormData();
    body.append('name', input.name);
    body.append('usedFor', input.usedFor);
    body.append('therapyType', input.therapyType);
    if (input.price) body.append('price', input.price);
    if (Platform.OS === 'web' && input.image.file) {
      body.append('image', input.image.file);
    } else {
      body.append('image', {
        uri: input.image.uri,
        name: input.image.name,
        type: input.image.mimeType || 'image/jpeg',
      } as unknown as Blob);
    }
    return request<{ instrument: Instrument }>('/api/instruments', { method: 'POST', body });
  },
  updateInstrumentPrice(id: number, price: number | null) {
    return request<{ instrument: Instrument }>(`/api/instruments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ price }),
    });
  },
  deleteInstrument(id: number) {
    return request<{ ok: true }>(`/api/instruments/${id}`, { method: 'DELETE' });
  },
  outcome(month: string) {
    return request<OutcomeMonth>(`/api/expenses?month=${encodeURIComponent(month)}`);
  },
  createOutcome(body: {
    month: string;
    payments: ({ category: 'salaries'; staffId: number; amount: number } | { category: 'rent' | 'services'; label: string; amount: number })[];
  }) {
    return request<OutcomeMonth>('/api/expenses', { method: 'POST', body: JSON.stringify(body) });
  },
  deleteOutcome(id: number, month: string) {
    return request<OutcomeMonth>(`/api/expenses/${id}?month=${encodeURIComponent(month)}`, { method: 'DELETE' });
  },
  settings() {
    return request<ClinicSettings>('/api/settings');
  },
  updateSettings(body: ClinicSettings['settings']) {
    return request<ClinicSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
  },
  therapies() {
    return request<{ therapies: string[] }>('/api/therapies');
  },
  addTherapy(name: string) {
    return request<{ therapies: string[] }>('/api/therapies', { method: 'POST', body: JSON.stringify({ name }) });
  },
};
