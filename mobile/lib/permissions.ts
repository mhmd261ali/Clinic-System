import type { Role } from './types';

export function canEdit(role: Role) {
  return role === 'admin' || role === 'sub-admin';
}

export function canDelete(role: Role) {
  return role === 'admin';
}

export function canUpload(role: Role) {
  return role === 'admin' || role === 'sub-admin';
}

export function canManageStaff(role: Role) {
  return role === 'admin';
}

export function canSeeIncome(role: Role) {
  return role === 'admin';
}

export function canSeeOutcome(role: Role) {
  return role === 'admin';
}

export function canManageSettings(role: Role) {
  return role === 'admin';
}

export function isClinician(role: Role) {
  return role === 'user';
}
