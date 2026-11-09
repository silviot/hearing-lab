// SPDX-License-Identifier: AGPL-3.0-only
const KEY = 'hearing-lab:notebook:v1';
const PREFS = 'hearing-lab:preferences:v1';
export function readNotes() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.id === 'string').slice(0, 300) : []; } catch { return []; }
}
export function saveNote(note) {
  const entry = { ...note, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString(), schemaVersion: 1, appVersion: '1.0.0' };
  const notes = [entry, ...readNotes()].slice(0, 300);
  localStorage.setItem(KEY, JSON.stringify(notes));
  return entry;
}
export function removeNote(id) { localStorage.setItem(KEY, JSON.stringify(readNotes().filter(n => n.id !== id))); }
export function readPreferences() { try { const value = JSON.parse(localStorage.getItem(PREFS) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } }
export function savePreferences(prefs) { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); return true; } catch { return false; } }
export function downloadNotes() {
  const payload = { application: 'Hearing Lab', schemaVersion: 1, exportedAt: new Date().toISOString(), notes: readNotes() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `hearing-lab-notebook-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
