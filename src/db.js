import { openDB } from 'idb';

const dbPromise = openDB('zemrs-offline', 1, {
  upgrade(db) {
    const results = db.createObjectStore('results', { keyPath: 'id' });
    results.createIndex('stationId', 'stationId');
    results.createIndex('status', 'status');
    db.createObjectStore('settings', { keyPath: 'key' });
  }
});

export const listResults = async () => (await dbPromise).getAll('results');
export const saveResult = async result => (await dbPromise).put('results', result);
export const getSetting = async key => (await dbPromise).get('settings', key);
export const saveSetting = async (key, value) => (await dbPromise).put('settings', { key, value });

