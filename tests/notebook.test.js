// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { readNotes, saveNote, upsertNote, removeNote } from '../src/lib/notebook.js';

function installMemoryStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
  };
  return store;
}

test('upsertNote creates a note when id is absent and updates in place when id matches', () => {
  installMemoryStorage();

  const first = upsertNote({
    id: null,
    experiment: 'phase',
    title: 'Phase & Cancellation',
    type: 'observation',
    observation: 'First impression',
    params: { frequency: 220, phase: 0 },
  });
  assert.ok(typeof first.id === 'string' && first.id.length > 0);
  assert.equal(readNotes().length, 1);
  assert.equal(readNotes()[0].observation, 'First impression');

  const second = saveNote({
    experiment: 'phase',
    title: 'Phase & Cancellation',
    type: 'observation',
    observation: 'Newer note',
    params: { frequency: 440, phase: 180 },
  });
  assert.equal(readNotes().length, 2);
  assert.equal(readNotes()[0].id, second.id);
  assert.equal(readNotes()[1].id, first.id);

  const updatedFirst = upsertNote({
    id: first.id,
    experiment: 'phase',
    title: 'Phase & Cancellation',
    type: 'observation',
    observation: 'Refined first impression after mono switch',
    params: { frequency: 220, phase: 180 },
  });
  assert.equal(updatedFirst.id, first.id);
  assert.equal(updatedFirst.createdAt, first.createdAt);
  const all = readNotes();
  assert.equal(all.length, 2, 'Updating an existing note must not duplicate entries');
  assert.equal(all[0].id, second.id, 'Updating an older note preserves list ordering');
  assert.equal(all[1].observation, 'Refined first impression after mono switch');
  assert.deepEqual(all[1].params, { frequency: 220, phase: 180 });
});

test('removeNote deletes only the targeted note and upsertNote caps storage at 300 notes', () => {
  installMemoryStorage();
  for (let i = 0; i < 305; i += 1) {
    upsertNote({ experiment: 'beats', observation: `Note ${i}` });
  }
  assert.equal(readNotes().length, 300);
  const targetId = readNotes()[0].id;
  removeNote(targetId);
  assert.equal(readNotes().length, 299);
  assert.equal(readNotes().some(n => n.id === targetId), false);
});
