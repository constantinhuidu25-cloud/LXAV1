/**
 * Firebase Realtime Database storage
 * Free tier: 1GB storage, 10GB/month bandwidth
 * Perfect for multiplayer persistent storage
 */

const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

let app = null;
let db = null;

function initFirebase() {
  if (app) return;

  try {
    const DEFAULT_DB_URL = 'https://lxav1-a5cfd-default-rtdb.europe-west1.firebasedatabase.app';
    const envUrl = String(process.env.FIREBASE_DATABASE_URL || '').trim().replace(/^["']+|["']+$/g, '').replace(/\/+$/, '');
    const databaseURL = /^https:\/\/[^\s/]+\.firebasedatabase\.app$|^https:\/\/[^\s/]+\.firebaseio\.com$/.test(envUrl) ? envUrl : DEFAULT_DB_URL;
    const existingApps = getApps();

    // Initialize Firebase Admin app
    if (existingApps.length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        app = initializeApp({
          credential: cert(serviceAccount),
          databaseURL
        });
      } else {
        // Test mode without credentials
        app = initializeApp({
          databaseURL
        });
      }
    } else {
      app = existingApps[0];
    }

    // Get database reference
    db = getDatabase(app);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase init error:', error.message);
  }
}

// FAIL CLOSED: a failed read must never look like an empty database. Returning {} here used to make login answer
// "ID not found", and made `create` hand out an id that already exists (duplicate ids -> the wrong account answers a
// token check -> "session expired"). Callers now get an error (HTTP 500 "Server temporarily unavailable").
async function getAccounts() {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('accounts');
    const snapshot = await ref.once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('getAccounts error:', error.message);
    throw error;
  }
}

async function saveAccounts(accounts) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('accounts');
    await ref.set(accounts);
  } catch (error) {
    console.error('saveAccounts error:', error.message);
    throw error;
  }
}

// Atomically read-modify-write a single account. `mutate` receives the
// account's current server-side value (or null if it doesn't exist yet)
// and must return the new value to persist. Firebase retries `mutate`
// itself if the underlying value changed between read and write, so two
// concurrent requests for the SAME account (double-click spin, two tabs)
// can no longer silently overwrite each other's balance change.
async function updateAccount(accountKey, mutate) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  const ref = db.ref(`accounts/${accountKey}`);
  const result = await ref.transaction(current => mutate(current || null));
  if (!result.committed) throw new Error('Account update did not commit');
  return result.snapshot.val();
}

// `strict` is for read-modify-write callers: if the read fails they must stop instead of saving a board built from {}
// (saveLeaderboard replaces the whole node). Plain display reads keep the old forgiving behaviour.
async function getLeaderboard({ strict = false } = {}) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('leaderboard');
    const snapshot = await ref.once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('getLeaderboard error:', error.message);
    if (strict) throw error;
    return {};
  }
}

async function saveLeaderboard(leaderboard) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('leaderboard');
    await ref.set(leaderboard);
  } catch (error) {
    console.error('saveLeaderboard error:', error.message);
    throw error;
  }
}

// Same `strict` rule as getLeaderboard: the admin save path merges into this value and replaces the whole node.
async function getRtpSettings({ strict = false } = {}) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('rtpSettings');
    const snapshot = await ref.once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('getRtpSettings error:', error.message);
    if (strict) throw error;
    return {};
  }
}

async function saveRtpSettings(settings) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('rtpSettings');
    await ref.set(settings);
  } catch (error) {
    console.error('saveRtpSettings error:', error.message);
    throw error;
  }
}

module.exports = {
  getAccounts,
  saveAccounts,
  getLeaderboard,
  saveLeaderboard,
  updateAccount,
  getRtpSettings,
  saveRtpSettings
};
