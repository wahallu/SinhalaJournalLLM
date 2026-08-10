/**
 * Anonymous identity for the research study.
 *
 * The tool reaches university journalism students through a WhatsApp group, so
 * there is no recruitment step at which a participant code could be handed out
 * and almost every session is anonymous. Runs are grouped by a device id
 * generated here on first visit and kept in localStorage.
 *
 * Deliberately not the IP address, which the backend sees anyway: Sri Lankan
 * mobile carriers use CGNAT and a campus network is one NAT address, so an IP
 * merges a whole class into one "participant" while splitting one student
 * across wifi, 4G and home broadband. A device id is wrong in neither
 * direction.
 *
 * What it is not: a person. It does not survive a cleared browser or a private
 * window, and a shared machine merges everyone who uses it.
 */

const DEVICE_KEY = 'sinai.device_id';
const SESSION_KEY = 'sinai.session_id';

// A session is one sitting. Half an hour of inactivity ends it, so the study
// can talk about "a work session" rather than one undivided blob per device.
const SESSION_IDLE_MS = 30 * 60 * 1000;

function newId(prefix) {
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    // Older Safari on the phones a lot of students will be using has no
    // randomUUID. Collision risk across a study cohort is negligible and a
    // duplicate id costs a merged pair of sessions, not a broken request.
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${uuid.replace(/-/g, '')}`;
}

/**
 * Read a key, tolerating storage being unavailable.
 *
 * Private browsing and blocked third-party storage both make localStorage
 * throw on access rather than return null. Losing the id costs the study one
 * ungrouped session; letting the exception escape would break the app, so
 * every path here degrades to "no id" instead.
 */
function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — this request simply goes ungrouped */
  }
}

export function getDeviceId() {
  let id = read(DEVICE_KEY);
  if (!id) {
    id = newId('d');
    write(DEVICE_KEY, id);
  }
  return id;
}

/** Current session id, rotating after SESSION_IDLE_MS of inactivity. */
export function getSessionId() {
  const now = Date.now();
  let id = null;
  let last = 0;
  try {
    const raw = read(SESSION_KEY);
    if (raw) ({ id, last } = JSON.parse(raw));
  } catch {
    id = null;
  }
  if (!id || now - last > SESSION_IDLE_MS) id = newId('s');
  write(SESSION_KEY, JSON.stringify({ id, last: now }));
  return id;
}

/** Headers identifying this device and sitting, for every API call. */
export function researchHeaders() {
  try {
    return { 'X-Anon-Id': getDeviceId(), 'X-Session-Id': getSessionId() };
  } catch {
    return {};
  }
}
