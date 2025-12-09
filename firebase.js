import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  setDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDoc,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhBZ_W5FU69d3nuf6MqhWBEwavvGTyPKU",
  authDomain: "setlist-maker-ae55c.firebaseapp.com",
  projectId: "setlist-maker-ae55c",
  storageBucket: "setlist-maker-ae55c.firebasestorage.app",
  messagingSenderId: "760814602090",
  appId: "1:760814602090:web:ee9b7a75f5fba08656c713"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const loginBtn   = document.getElementById("loginBtn");
const logoutBtn  = document.getElementById("logoutBtn");
const userStatus = document.getElementById("userStatus");

const provider = new GoogleAuthProvider();

// --------------------
// Auth UI
// --------------------
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Googleログインに失敗しました", err);
    alert("ログインに失敗しました。時間をおいて再度お試しください。");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("ログアウトに失敗しました", err);
  }
});

// --------------------
// Songs
// --------------------
async function saveSongForUser(uid, song) {
  const colRef = collection(db, "users", uid, "songs");
  const docRef = await addDoc(colRef, song);
  return docRef.id;
}

async function saveLibraryForUser(uid, songs = []) {
  const colRef = collection(db, "users", uid, "songs");
  const ids = [];

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i] || {};
    const base = {
      title: song.title || "",
      durationSec: song.durationSec || 0,
      url: song.url || "",
      artist: (song.artist || "").trim(),
      order: typeof song.order === "number" ? song.order : i,
      updatedAt: serverTimestamp()
    };

    if (song.firestoreId) {
      const docRef = doc(db, "users", uid, "songs", song.firestoreId);
      await setDoc(docRef, base, { merge: true });
      ids.push(song.firestoreId);
    } else {
      const docRef = await addDoc(colRef, { ...base, createdAt: serverTimestamp() });
      ids.push(docRef.id);
    }
  }
  return ids;
}

async function loadSongsForUser(uid, artistName = "") {
  const colRef = collection(db, "users", uid, "songs");
  const q = query(colRef, orderBy("order", "asc"));
  const snap = await getDocs(q);

  const items = [];
  const targetArtist = (artistName || "").trim();

  snap.forEach((docSnap) => {
    const song = docSnap.data();
    const id = docSnap.id;
    const songArtist = (song.artist || "").trim();
    if (targetArtist && songArtist !== targetArtist) return;

    const rawUrl = song.url || "";
    const safeUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : (rawUrl ? `https://${rawUrl}` : "");

    items.push({
      title: song.title || "",
      durationSec: song.durationSec || 0,
      url: safeUrl,
      artist: songArtist,
      order: typeof song.order === "number" ? song.order : null,
      source: "firestore",
      firestoreId: id
    });
  });

  if (window.__renderSongLibraryFromData) {
    window.__renderSongLibraryFromData(items);
  } else {
    const songLibraryEl = document.getElementById("songLibrary");
    songLibraryEl.innerHTML = "";
    items.forEach((song) => {
      const rawUrl = song.url || "";
      const safeUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : (rawUrl ? `https://${rawUrl}` : "");
      const li = document.createElement("li");
      li.className = "song-item";
      li.dataset.duration = String(song.durationSec || 0);
      li.dataset.source = "firestore";
      li.dataset.firestoreId = song.firestoreId;
      if (song.artist) li.dataset.artist = song.artist;
      if (safeUrl) li.dataset.url = safeUrl;

      li.innerHTML = `
        <div class="song-main">
          <div class="song-title"></div>
          <div class="song-meta"></div>
        </div>
        <div class="song-right">
          ${safeUrl ? '<button class="icon-btn link-btn" title="音源を開く">🔗</button>' : ''}
          <div class="song-duration">${window.formatTime?.(song.durationSec || 0) ?? ""}</div>
          <button class="icon-btn edit-btn" title="この曲を編集">✎</button>
          <button class="icon-btn delete-btn" title="この曲を削除">🗑</button>
        </div>
      `;
      li.querySelector(".song-title").textContent = song.title || "";
      songLibraryEl.appendChild(li);
    });
  }

  window.__updateEmptyPlaceholders?.();
  window.__saveLocalState?.();
}

async function deleteSongForUser(uid, songId) {
  const docRef = doc(db, "users", uid, "songs", songId);
  await deleteDoc(docRef);
  return true;
}

async function updateSongForUser(uid, songId, song) {
  const docRef = doc(db, "users", uid, "songs", songId);
  const base = {
    title: song.title || "",
    durationSec: song.durationSec || 0,
    url: song.url || "",
    artist: (song.artist || "").trim(),
    updatedAt: serverTimestamp()
  };
  if (typeof song.order === "number") {
    base.order = song.order;
  }
  await setDoc(docRef, base, { merge: true });
  return true;
}

async function deleteSongsByArtistForUser(uid, artistName) {
  const trimmed = (artistName || "").trim();
  if (!trimmed) return 0;
  const colRef = collection(db, "users", uid, "songs");
  const q = query(colRef, where("artist", "==", trimmed));
  const snap = await getDocs(q);
  let count = 0;
  for (const docSnap of snap.docs) {
    await deleteDoc(docSnap.ref);
    count++;
  }
  return count;
}

// --------------------
// Artists
// --------------------
async function saveArtistForUser(uid, name) {
  const docRef = doc(db, "users", uid, "artists", name);
  await setDoc(docRef, { name, createdAt: serverTimestamp() }, { merge: true });
  return docRef.id;
}

async function loadArtistsForUser(uid) {
  const colRef = collection(db, "users", uid, "artists");
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() || {})
  }));
}

async function deleteArtistForUser(uid, artistId) {
  const docRef = doc(db, "users", uid, "artists", artistId);
  await deleteDoc(docRef);
  return true;
}

// --------------------
// Setlists
// --------------------
async function saveSetlistForUser(uid, payload) {
  const colRef = collection(db, "users", uid, "setlists");
  const docRef = await addDoc(colRef, {
    ...payload,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

async function updateSetlistForUser(uid, setlistId, payload) {
  const docRef = doc(db, "users", uid, "setlists", setlistId);
  await setDoc(docRef, {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

async function saveDraftSetlistForUser(uid, payload) {
  const artist = (payload.artist || "default").trim() || "default";
  const docId = `draft__${artist}`;
  const docRef = doc(db, "users", uid, "setlists", docId);
  await setDoc(docRef, {
    ...payload,
    isDraft: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return docId;
}

async function loadSetlistsForUser(uid) {
  const colRef = collection(db, "users", uid, "setlists");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

async function loadDraftSetlistForUser(uid, artistName = "") {
  const artist = (artistName || "default").trim() || "default";
  const docId = `draft__${artist}`;
  const docRef = doc(db, "users", uid, "setlists", docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: docId, ...snap.data() };
}

async function deleteSetlistForUser(uid, setlistId) {
  const docRef = doc(db, "users", uid, "setlists", setlistId);
  await deleteDoc(docRef);
  return true;
}

// --------------------
// Globals for app.js
// --------------------
window._setlistFirebase = { app, auth, db };

window.saveSongForCurrentUser = async (song) => {
  if (!auth.currentUser) return null;
  return saveSongForUser(auth.currentUser.uid, song);
};
window.updateSongForCurrentUser = async (songId, song) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return updateSongForUser(auth.currentUser.uid, songId, song);
};
window.saveLibraryForCurrentUser = async (songs = []) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return saveLibraryForUser(auth.currentUser.uid, songs);
};
window.loadSongsForCurrentUser = async (artistName = "") => {
  if (!auth.currentUser) return [];
  return loadSongsForUser(auth.currentUser.uid, artistName);
};
window.deleteSongForCurrentUser = async (songId) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return deleteSongForUser(auth.currentUser.uid, songId);
};
window.deleteSongsByArtistForCurrentUser = async (artistName) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return deleteSongsByArtistForUser(auth.currentUser.uid, artistName);
};

window.saveArtistForCurrentUser = async (name) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return saveArtistForUser(auth.currentUser.uid, name);
};
window.loadArtistsForCurrentUser = async () => {
  if (!auth.currentUser) return [];
  return loadArtistsForUser(auth.currentUser.uid);
};
window.deleteArtistForCurrentUser = async (artistId) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return deleteArtistForUser(auth.currentUser.uid, artistId);
};

window.saveSetlistForCurrentUser = async (payload) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return saveSetlistForUser(auth.currentUser.uid, payload);
};
window.updateSetlistForCurrentUser = async (setlistId, payload) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return updateSetlistForUser(auth.currentUser.uid, setlistId, payload);
};
window.saveDraftSetlistForCurrentUser = async (payload) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return saveDraftSetlistForUser(auth.currentUser.uid, payload);
};
window.loadSetlistsForCurrentUser = async () => {
  if (!auth.currentUser) return [];
  return loadSetlistsForUser(auth.currentUser.uid);
};
window.loadDraftSetlistForCurrentUser = async (artistName = "") => {
  if (!auth.currentUser) return null;
  return loadDraftSetlistForUser(auth.currentUser.uid, artistName);
};
window.deleteSetlistForCurrentUser = async (setlistId) => {
  if (!auth.currentUser) throw new Error("not-auth");
  return deleteSetlistForUser(auth.currentUser.uid, setlistId);
};

// --------------------
// Auth state change
// --------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    userStatus.textContent = user.displayName || "ログイン中";
    loginBtn.disabled = true;
    logoutBtn.disabled = false;

    const selectedArtist = window.__getCurrentArtist?.() || "";
    loadSongsForUser(user.uid, selectedArtist);
    window.__refreshArtists?.();
    window.__refreshSetlistHistory?.();
  } else {
    userStatus.textContent = "未ログイン";
    loginBtn.disabled = false;
    logoutBtn.disabled = true;

    document.getElementById("songLibrary").innerHTML = "";
    window.__clearSetlistHistory?.();
    window.__clearArtists?.();
    window.__updateEmptyPlaceholders?.();
    window.__saveLocalState?.();
  }
});



