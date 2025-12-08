// SortableJS をグローバルから取ってくる保険
const Sortable = window.Sortable;
if (!Sortable) {
  console.error('SortableJS が読み込まれてないかも…');
}

// mm:ss 形式に変換
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// mm:ss を秒にパース（不正なら null）
function parseMmSsToSec(input = '') {
  const match = input.trim().match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (!match) return null;
  const m = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  if (isNaN(m) || isNaN(s) || s >= 60) return null;
  return m * 60 + s;
}

function normalizeUrl(raw = '') {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildAutoLiveTitle(title = '', date = '') {
  const trimmed = (title || '').trim();
  if (trimmed) return trimmed;
  const iso = (date || '').trim();
  if (!iso) return '無題のライブ';
  const [y, m, d] = iso.split('-');
  if (y && m && d) {
    return `無題のライブ:${y}年${String(m).padStart(2, '0')}月${String(d).padStart(2, '0')}日`;
  }
  return '無題のライブ';
}

// firebase.js からも使う
window.formatTime = formatTime;

// 合計時間や残り時間を計算
function recalcTimes() {
  const setlistEl = document.getElementById('setlist');
  const items = setlistEl.querySelectorAll('.song-item');
  let totalSec = 0;
  items.forEach(item => {
    const d = parseInt(item.dataset.duration || '0', 10);
    totalSec += d;
  });

  const slotMinutes = parseInt(document.getElementById('slotMinutes').value || '0', 10);
  const slotSec = slotMinutes * 60;

  const totalPill = document.getElementById('totalTimePill');
  const diffPill  = document.getElementById('diffPill');

  document.getElementById('totalTimeText').textContent = formatTime(totalSec);
  document.getElementById('slotTimeText').textContent  = formatTime(slotSec);

  const diff = slotSec - totalSec;
  const abs  = Math.abs(diff);
  document.getElementById('diffText').textContent = `${diff >= 0 ? '' : '-'}${formatTime(abs)}`;
  diffPill.querySelector('.label').textContent = diff >= 0 ? '残り' : 'オーバー';

  totalPill.classList.remove('ok','warn','over');
  diffPill.classList.remove('ok','warn','over');

  if (diff >= 0) {
    diffPill.classList.add(diff <= 60 ? 'warn' : 'ok');
  } else {
    diffPill.classList.add('over');
  }

  updateEmptyPlaceholders();
  saveLocalState();
}

function createSongLi({ title = '', durationSec = 0, url = '', metaLabel = 'Custom', source = '', firestoreId = '', artist = '', enableEdit = false }) {
  const li = document.createElement('li');
  li.className = 'song-item';
  li.dataset.duration = String(durationSec || 0);
  const safeUrl = normalizeUrl(url);
  if (safeUrl) li.dataset.url = safeUrl;
  if (source) li.dataset.source = source;
  if (firestoreId) li.dataset.firestoreId = firestoreId;
  if (artist) li.dataset.artist = artist;

  li.innerHTML = `
    <div class="song-main">
      <div class="song-title"></div>
      <div class="song-meta">${safeUrl ? `${metaLabel} / URLあり` : metaLabel}</div>
    </div>
    <div class="song-right">
      ${safeUrl ? '<button class="icon-btn link-btn" title="音源を開く（URL登録時）">🔗</button>' : ''}
      <div class="song-duration">${formatTime(durationSec || 0)}</div>
      ${enableEdit ? '<button class="icon-btn edit-btn" title="この曲を編集">✎</button>' : ''}
      <button class="icon-btn delete-btn" title="この曲を削除">🗑</button>
    </div>
  `;
  li.querySelector('.song-title').textContent = title || '';
  return li;
}

function renderSongLibraryFromData(items = []) {
  songLibraryEl.innerHTML = '';
  const hasOrder = items.some(s => typeof s.order === 'number');
  const sorted = hasOrder
    ? [...items].sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    : items;

  sorted.forEach((song, idx) => {
    const li = createSongLi({
      title: song.title || '',
      durationSec: song.durationSec || 0,
      url: song.url || '',
      metaLabel: (song.source === 'firestore' ? 'Firestore' : 'Custom'),
      source: song.source || '',
      firestoreId: song.firestoreId || '',
      artist: song.artist || '',
      enableEdit: true
    });
    li.dataset.order = typeof song.order === 'number' ? String(song.order) : String(idx);
    songLibraryEl.appendChild(li);
  });
  updateEmptyPlaceholders();
}

function enforceArtistEmptyState() {
  const noArtists = artistNames.length === 0;
  if (!noArtists || isApplyingArtistEmptyState) return false;

  const hasLibraryItems = !!songLibraryEl?.querySelector('.song-item');
  const hasSetlistItems = !!setlistEl?.querySelector('.song-item');
  const hasSelection    = !!(currentArtist || setlistHistoryEl?.value);
  if (!hasLibraryItems && !hasSetlistItems && !hasSelection) return false;

  isApplyingArtistEmptyState = true;
  currentArtist = '';
  if (songLibraryEl) songLibraryEl.innerHTML = '';
  if (setlistEl) setlistEl.innerHTML = '';
  if (setlistHistoryEl) setlistHistoryEl.value = '';
  recalcTimes(); // 残り時間などを即座に0リセット
  isApplyingArtistEmptyState = false;
  return true;
}

function updateEmptyPlaceholders() {
  const ensurePlaceholder = (listEl, message) => {
    if (!listEl) return;
    const existing = listEl.querySelector(`.${EMPTY_PLACEHOLDER_CLASS}`);
    const items = listEl.querySelectorAll('.song-item');
    if (items.length === 0) {
      if (!existing) {
        const hint = document.createElement('div');
        hint.className = EMPTY_PLACEHOLDER_CLASS;
        hint.textContent = message;
        listEl.appendChild(hint);
      }
    } else if (existing) {
      existing.remove();
    }
  };
  const noArtists = artistNames.length === 0;
  if (artistEmptyHintEl) {
    artistEmptyHintEl.style.display = noArtists ? 'block' : 'none';
  }
  if (noArtists) {
    enforceArtistEmptyState();
  }
  ensurePlaceholder(songLibraryEl, '曲ライブラリに曲を追加してください');
  ensurePlaceholder(setlistEl, 'セットリストに曲を追加してください');
}

function saveLocalState() {
  if (!window.localStorage) return;
  const libraryItems = Array.from(songLibraryEl.querySelectorAll('.song-item')).map((li, idx) => ({
    title: li.querySelector('.song-title')?.textContent || '',
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    source: li.dataset.source || '',
    firestoreId: li.dataset.firestoreId || '',
    artist: li.dataset.artist || '',
    order: idx
  }));

  const setlistItems = Array.from(setlistEl.querySelectorAll('.song-item')).map(li => ({
    title: li.querySelector('.song-title')?.textContent || '',
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    artist: li.dataset.artist || ''
  }));

  const state = {
    currentArtist,
    liveTitle: (document.getElementById('liveTitle').value || '').trim(),
    liveDate: (document.getElementById('liveDate').value || '').trim(),
    slotMinutes: parseInt(document.getElementById('slotMinutes').value || '0', 10),
    library: libraryItems,
    setlist: setlistItems,
    selectedSetlistId: setlistHistoryEl.value || ''
  };
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('localStorage save error', e);
  }
}

function applySongEdits(li, { title, durationSec, url }) {
  const titleEl = li.querySelector('.song-title');
  const metaEl = li.querySelector('.song-meta');
  const durationEl = li.querySelector('.song-duration');
  const linkBtn = li.querySelector('.link-btn');
  const safeUrl = normalizeUrl(url);
  const listId = li.parentElement?.id;

  if (titleEl) titleEl.textContent = title;
  li.dataset.duration = String(durationSec);

  const baseMeta = li.dataset.source === 'firestore' ? 'Firestore' : 'Custom';
  if (safeUrl) {
    li.dataset.url = safeUrl;
    if (!linkBtn) {
      const durationParent = durationEl?.parentElement;
      if (durationParent) {
        const btn = document.createElement('button');
        btn.className = 'icon-btn link-btn';
        btn.title = '音源を開く（URL登録時）';
        btn.textContent = '🔗';
        durationParent.insertBefore(btn, durationEl);
      }
    }
  } else {
    delete li.dataset.url;
    if (linkBtn) linkBtn.remove();
  }

  if (metaEl) metaEl.textContent = safeUrl ? `${baseMeta} / URLあり` : baseMeta;
  if (durationEl) durationEl.textContent = formatTime(durationSec);
  saveLocalState();
  if (listId === 'setlist') {
    propagateSetlistEditToLibrary(li, { title, durationSec, url: safeUrl });
    recalcTimes();
  }
}

async function persistSongEditToFirestore(li) {
  const firestoreId = li.dataset.firestoreId;
  const auth = window._setlistFirebase?.auth;
  if (!firestoreId || !window.updateSongForCurrentUser || !auth?.currentUser) return;
  const order = Array.from(songLibraryEl.querySelectorAll('.song-item')).indexOf(li);
  const payload = {
    title: li.querySelector('.song-title')?.textContent || '',
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    artist: li.dataset.artist || '',
    order
  };
  try {
    await window.updateSongForCurrentUser(firestoreId, payload);
  } catch (e) {
    console.error('Firestore更新エラー:', e);
  }
}

function showEditSongError(msg = '') {
  if (editSongErrorEl) {
    editSongErrorEl.textContent = msg;
  } else {
    alert(msg);
  }
}

function openEditSongModal(li) {
  if (!editSongModal || !editSongForm) return;
  editingSongLi = li;
  const title = li.querySelector('.song-title')?.textContent || '';
  const currentDuration = parseInt(li.dataset.duration || '0', 10);
  const url = li.dataset.url || '';

  editSongTitleEl.value = title;
  editSongDurationEl.value = formatTime(currentDuration);
  editSongUrlEl.value = url;
  showEditSongError('');

  editSongModal.classList.remove('hidden');
  editSongTitleEl.focus();
}

function closeEditSongModal() {
  if (!editSongModal || !editSongForm) return;
  editingSongLi = null;
  editSongForm.reset();
  showEditSongError('');
  editSongModal.classList.add('hidden');
}

function showEditLiveInfoError(msg = '') {
  if (editLiveInfoErrorEl) {
    editLiveInfoErrorEl.textContent = msg;
  } else if (msg) {
    alert(msg);
  }
}

function openEditLiveInfoModal() {
  if (!editLiveInfoModal || !editLiveInfoForm) return;
  const setlistId = setlistHistoryEl?.value;
  if (!setlistId) {
    alert('編集するセットを選んでね');
    return;
  }
  const current = cachedSetlists.find(s => s.id === setlistId);
  if (!current) {
    alert('セットが見つかりません');
    return;
  }
  showEditLiveInfoError('');
  editLiveTitleEl.value   = document.getElementById('liveTitle').value || current.title || '';
  editLiveDateEl.value    = document.getElementById('liveDate').value  || current.date  || '';
  editSlotMinutesEl.value = document.getElementById('slotMinutes').value || current.slotMinutes || 0;
  editLiveInfoModal.classList.remove('hidden');
  editLiveTitleEl.focus();
}

function closeEditLiveInfoModal() {
  if (!editLiveInfoModal || !editLiveInfoForm) return;
  editLiveInfoForm.reset();
  showEditLiveInfoError('');
  editLiveInfoModal.classList.add('hidden');
}

function loadLocalState() {
  if (!window.localStorage) {
    updateEmptyPlaceholders();
    return;
  }
  const raw = localStorage.getItem(LOCAL_STATE_KEY);
  if (!raw) {
    updateEmptyPlaceholders();
    return;
  }
  try {
    const state = JSON.parse(raw);
    if (state.currentArtist) {
      if (!artistNames.includes(state.currentArtist)) {
        artistNames.push(state.currentArtist);
        artistNames.sort((a, b) => a.localeCompare(b, 'ja'));
      }
      currentArtist = state.currentArtist;
    }
    renderArtistSelect();
    document.getElementById('liveTitle').value = state.liveTitle || '';
    document.getElementById('liveDate').value  = state.liveDate  || '';
    document.getElementById('slotMinutes').value = state.slotMinutes || 0;
    renderSongLibraryFromData(state.library || []);
    renderSetlistFromData(state.setlist || []);
    if (!state.selectedSetlistId && (!state.library || state.library.length === 0) && (state.setlist || []).length > 0) {
      setlistEl.innerHTML = '';
      recalcTimes();
    }
    if (state.selectedSetlistId) {
      setlistHistoryEl.value = state.selectedSetlistId;
    }
    hasLocalStateLoaded = true;
  } catch (e) {
    console.warn('localStorage load error', e);
  }
  updateEmptyPlaceholders();
}

window.__updateEmptyPlaceholders = updateEmptyPlaceholders;
window.__saveLocalState = saveLocalState;
window.__renderSongLibraryFromData = renderSongLibraryFromData;

function getLibraryItemsWithOrder() {
  return Array.from(songLibraryEl.querySelectorAll('.song-item')).map((li, idx) => ({
    title: li.querySelector('.song-title')?.textContent || '',
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    source: li.dataset.source || '',
    firestoreId: li.dataset.firestoreId || '',
    artist: li.dataset.artist || '',
    order: idx
  })).filter(item => item.title);
}

// DOMを掴む
const songLibraryEl = document.getElementById('songLibrary');
const setlistEl     = document.getElementById('setlist');

const newSongTitleEl= document.getElementById('newSongTitle');
const newSongUrlEl  = document.getElementById('newSongUrl');
const newSongMinEl  = document.getElementById('newSongMin');
const newSongSecEl  = document.getElementById('newSongSec');
const addSongBtn    = document.getElementById('addSongBtn');
const saveAllBtn    = document.getElementById('saveAllBtn');
const editSongModal = document.getElementById('editSongModal');
const editSongForm  = document.getElementById('editSongForm');
const editSongTitleEl = document.getElementById('editSongTitle');
const editSongDurationEl = document.getElementById('editSongDuration');
const editSongUrlEl = document.getElementById('editSongUrl');
const editSongErrorEl = document.getElementById('editSongError');

// アーティスト関連 DOM
const artistSelectEl  = document.getElementById('artistSelect');
const addArtistBtn    = document.getElementById('addArtistBtn');
const deleteArtistBtn = document.getElementById('deleteArtistBtn');
const artistBarEl     = document.querySelector('.artist-bar');
let artistEmptyHintEl = document.getElementById('artistEmptyHint');

// ライブ情報編集モーダル DOM
const editLiveInfoModal     = document.getElementById('editLiveInfoModal');
const editLiveInfoForm      = document.getElementById('editLiveInfoForm');
const editLiveTitleEl       = document.getElementById('editLiveTitle');
const editLiveDateEl        = document.getElementById('editLiveDate');
const editSlotMinutesEl     = document.getElementById('editSlotMinutes');
const editLiveInfoErrorEl   = document.getElementById('editLiveInfoError');
const editLiveInfoBtn       = document.getElementById('editLiveInfoBtn');

const EMPTY_PLACEHOLDER_CLASS = 'empty-hint';
const LOCAL_STATE_KEY = 'setlistMakerState';
let hasLocalStateLoaded = false;
let lastLoadedDraftArtist = '';
let isApplyingArtistEmptyState = false;

if (!artistEmptyHintEl && artistBarEl) {
  artistEmptyHintEl = document.createElement('div');
  artistEmptyHintEl.id = 'artistEmptyHint';
  artistEmptyHintEl.className = 'empty-hint small artist-hint';
  artistEmptyHintEl.style.display = 'none';
  artistBarEl.insertAdjacentElement('afterend', artistEmptyHintEl);
  artistEmptyHintEl.textContent = 'アーティストを追加してください';
}

// 曲ライブラリ / セットリスト D&D
if (Sortable && songLibraryEl && setlistEl) {
  // 曲ライブラリ側
  Sortable.create(songLibraryEl, {
    group: { name:'songs', pull:'clone', put:false },
    animation:150,
    sort:true,
    onUpdate: saveLocalState
  });

  // セットリスト側
  Sortable.create(setlistEl, {
    group: { name:'songs', pull:true, put:true },
    animation:150,
    sort:true,
    onAdd: () => { recalcTimes(); saveLocalState(); },
    onUpdate: () => { recalcTimes(); saveLocalState(); },
    onRemove: () => { recalcTimes(); saveLocalState(); }
  });
} else {
  console.error('SortableJS がロードされていないか、リスト要素が見つかりません');
}

// 持ち時間変更で再計算
document.getElementById('slotMinutes').addEventListener('input', recalcTimes);

// ライブラリ/セットリスト共通：削除アイコン
document.addEventListener('click', (event) => {
  const delBtn = event.target.closest('.delete-btn');
  if (!delBtn) return;

  const item = delBtn.closest('.song-item');
  if (!item) return;
  const list = item.parentElement;
  if (!list) return;

  if (list.id === 'songLibrary') {
    const title = item.querySelector('.song-title')?.textContent || 'この曲';
    const ok = window.confirm(`「${title}」をライブラリから削除してよいですか？`);
    if (!ok) return;

    const firestoreId = item.dataset.firestoreId;
    if (firestoreId && window.deleteSongForCurrentUser) {
      window.deleteSongForCurrentUser(firestoreId).catch(err => {
        console.error('Firestore削除エラー:', err);
      });
    }
    item.remove();
    updateEmptyPlaceholders();
    saveLocalState();
  } else if (list.id === 'setlist') {
    item.remove();
    recalcTimes();
    saveLocalState();
  }
});

// 曲ライブラリ：曲情報を編集（モーダル）
document.addEventListener('click', (event) => {
  const editBtn = event.target.closest('.edit-btn');
  if (!editBtn) return;

  const item = editBtn.closest('.song-item');
  const list = item?.parentElement;
  if (!list || (list.id !== 'songLibrary' && list.id !== 'setlist')) return;

  openEditSongModal(item);
});

// 編集モーダル submit
if (editSongForm) {
  editSongForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!editingSongLi) {
      closeEditSongModal();
      return;
    }
    const title = (editSongTitleEl.value || '').trim();
    const durationInput = (editSongDurationEl.value || '').trim();
    const url = (editSongUrlEl.value || '').trim();
    const parentId = editingSongLi.parentElement?.id;

    if (!title) {
      showEditSongError('曲名を入力してね');
      return;
    }
    const parsedSec = parseMmSsToSec(durationInput);
    if (parsedSec === null) {
      showEditSongError('mm:ss 形式で入力してね');
      return;
    }

    applySongEdits(editingSongLi, { title, durationSec: parsedSec, url });
    if (parentId === 'songLibrary') {
      await persistSongEditToFirestore(editingSongLi);
    }
    closeEditSongModal();
  });
}

// ライブ情報編集モーダル submit
if (editLiveInfoForm) {
  editLiveInfoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const setlistId = setlistHistoryEl?.value;
    if (!setlistId) {
      alert('編集するセットを選んでね');
      return;
    }
    const title = (editLiveTitleEl.value || '').trim();
    const date = (editLiveDateEl.value || '').trim();
    const slot = parseInt(editSlotMinutesEl.value || '0', 10);

    if (!title) {
      showEditLiveInfoError('タイトルを入力してね');
      return;
    }
    if (isNaN(slot) || slot < 0) {
      showEditLiveInfoError('持ち時間を0以上で入力してね');
      return;
    }

    document.getElementById('liveTitle').value = title;
    document.getElementById('liveDate').value  = date;
    document.getElementById('slotMinutes').value = slot;

    const payload = getCurrentSetlistPayload();
    const cached = cachedSetlists.find(s => s.id === setlistId);
    if (cached) {
      cached.title = title;
      cached.date = date;
      cached.slotMinutes = slot;
      cached.items = payload.items;
      cached.artist = payload.artist;
    }
    renderSetlistHistory();
    setlistHistoryEl.value = setlistId;
    recalcTimes();
    saveLocalState();

    if (window.updateSetlistForCurrentUser) {
      try {
        await window.updateSetlistForCurrentUser(setlistId, payload);
      } catch (e) {
        console.error('setlist update error:', e);
      }
    }
    closeEditLiveInfoModal();
  });
}

// モーダル閉じる
document.addEventListener('click', (event) => {
  const dismissSong = event.target.closest('[data-dismiss="edit-song"]');
  const dismissLive = event.target.closest('[data-dismiss="edit-live"]');
  if (dismissSong) closeEditSongModal();
  if (dismissLive) closeEditLiveInfoModal();
});

// セットリスト側：長さ変更
document.addEventListener('click', (event) => {
  const durEl = event.target.closest('.song-duration');
  if (!durEl) return;

  const item = durEl.closest('.song-item');
  const list = item?.parentElement;
  if (!list || list.id !== 'setlist') return;

  const currentSec = parseInt(item.dataset.duration || '0', 10);
  const currentStr = formatTime(currentSec);

  const input = window.prompt(`長さを mm:ss で入力してね（今は ${currentStr}）`, currentStr);
  if (!input) return;

  const match = input.trim().match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (!match) return alert('mm:ss 形式で入力してね');

  const m = parseInt(match[1],10);
  const s = parseInt(match[2],10);
  if (isNaN(m) || isNaN(s) || s >= 60) return alert('時間の形式がおかしいよ');

  const newSec = m*60 + s;
  item.dataset.duration = String(newSec);
  durEl.textContent = formatTime(newSec);
  recalcTimes();
});

// URLを開く
document.addEventListener('click', (event) => {
  const linkBtn = event.target.closest('.link-btn');
  if (!linkBtn) return;

  const item = linkBtn.closest('.song-item');
  const url = item?.dataset.url;
  if (!url) return alert('この曲にはURLがありません');

  const safeUrl = normalizeUrl(url);
  window.open(safeUrl, '_blank');
});

// セットリストクリア
document.getElementById('clearSetlist').addEventListener('click', ()=>{
  const ok = window.confirm('セットリストを全部クリアしますか？');
  if (!ok) return;
  setlistEl.innerHTML = '';
  recalcTimes();
  saveLocalState();
});

// 曲追加（手入力）
async function addSong() {
  const title = (newSongTitleEl.value || '').trim();
  const url   = (newSongUrlEl.value || '').trim();
  const min   = parseInt(newSongMinEl.value || '0', 10);
  const sec   = parseInt(newSongSecEl.value || '0', 10);
  const artist= (currentArtist || artistSelectEl?.value || '').trim();

  if (!title) return alert('曲名を入力してね');

  const safeMin = isNaN(min) || min < 0 ? 0 : min;
  let safeSec   = isNaN(sec) || sec < 0 ? 0 : sec;

  const extraMin = Math.floor(safeSec / 60);
  safeSec = safeSec % 60;

  const totalSec = (safeMin + extraMin) * 60 + safeSec;
  if (totalSec <= 0) return alert('長さ（分・秒）を入力してね');

  const li = createSongLi({
    title,
    durationSec: totalSec,
    url,
    metaLabel: 'Custom',
    source: 'local',
    artist,
    enableEdit: true
  });
  songLibraryEl.appendChild(li);

  if (window.saveSongForCurrentUser) {
    try {
      const id = await window.saveSongForCurrentUser({
        title,
        durationSec: totalSec,
        url: normalizeUrl(url),
        artist
      });
      if (id) {
        li.dataset.firestoreId = id;
        li.dataset.source = 'firestore';
      }
    } catch (err) {
      console.error('Firestoreへの曲保存でエラー:', err);
    }
  }

  newSongTitleEl.value = '';
  newSongUrlEl.value   = '';
  newSongMinEl.value   = '';
  newSongSecEl.value   = '';
  newSongTitleEl.focus();
  updateEmptyPlaceholders();
  saveLocalState();
}

addSongBtn.addEventListener('click', addSong);
newSongSecEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSong();
});

// =========================
// セットリスト保存 / 読み込み / 削除 UI
const loadSetlistBtn   = document.getElementById('loadSetlistBtn');
const deleteSetlistBtn = document.getElementById('deleteSetlistBtn');
const setlistHistoryEl = document.getElementById('setlistHistory');

let cachedSetlists = [];
let currentArtist  = '';
let artistNames    = [];
let artistDocIds   = {};
let artistMeta     = {}; // name -> { createdAt?: number }
let lastAddedArtistName = '';
let editingSongLi  = null;

window.__getCurrentArtist = () => currentArtist;

// アーティストセレクト描画
function renderArtistSelect() {
  if (!artistSelectEl) return;
  artistSelectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = artistNames.length === 0
    ? 'アーティストを追加してください'
    : 'アーティストを選択';
  artistSelectEl.appendChild(placeholder);

  artistNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    artistSelectEl.appendChild(opt);
  });

  if (currentArtist && artistNames.includes(currentArtist)) {
    artistSelectEl.value = currentArtist;
  } else {
    artistSelectEl.value = '';
  }
  updateEmptyPlaceholders();
}

// セットリスト履歴描画（アーティストでフィルタ）
function renderSetlistHistory() {
  setlistHistoryEl.innerHTML = '<option value="">保存済みセットリスト…</option>';
  const list = cachedSetlists.filter(sl => !currentArtist || sl.artist === currentArtist);

  list.forEach(sl => {
    const opt = document.createElement('option');
    const title = buildAutoLiveTitle(sl.title, sl.date);
    const dateStr = sl.date ? `(${sl.date}) ` : '';
    opt.value = sl.id;
    opt.textContent = dateStr + title;
    setlistHistoryEl.appendChild(opt);
  });
}

async function loadSongsForArtist(artistName) {
  const target = (artistName || '').trim();
  if (!target) {
    renderSongLibraryFromData([]);
    return;
  }
  if (!window.loadSongsForCurrentUser) return;
  try {
    await window.loadSongsForCurrentUser(target);
  } catch (e) {
    console.error('Firestore曲ロードエラー:', e);
  }
}

function resetSetlistUI() {
  document.getElementById('liveTitle').value = '';
  document.getElementById('liveDate').value = '';
  document.getElementById('slotMinutes').value = 30;
  setlistEl.innerHTML = '';
  recalcTimes();
  saveLocalState();
}

function applySetlistToUI(sl) {
  const autoTitle = buildAutoLiveTitle(sl.title, sl.date);
  document.getElementById('liveTitle').value = autoTitle;
  document.getElementById('liveDate').value  = sl.date  || '';
  document.getElementById('slotMinutes').value = sl.slotMinutes || 0;
  renderSetlistFromData(sl.items || []);
  setlistHistoryEl.value = sl.id || setlistHistoryEl.value;
}

function autoLoadSetlistForCurrentArtist() {
  if (!currentArtist) {
    setlistHistoryEl.value = '';
    resetSetlistUI();
    return;
  }
  const match = cachedSetlists.find(sl => (sl.artist || '').trim() === currentArtist);
  if (!match) {
    setlistHistoryEl.value = '';
    resetSetlistUI();
    return;
  }
  setlistHistoryEl.value = match.id || '';
  applySetlistToUI(match);
}

async function setCurrentArtistAndSync(name, { skipAutoLoad = false } = {}) {
  currentArtist = (name || '').trim();
  renderArtistSelect();
  renderSetlistHistory();
  await loadSongsForArtist(currentArtist);
  resetSetlistUI();
  setlistHistoryEl.value = '';
  saveLocalState();
  updateEmptyPlaceholders();
}

// Firestore からアーティスト一覧を再取得
async function refreshArtistsFromFirestore() {
  if (!window.loadArtistsForCurrentUser) return;
  try {
    const list = await window.loadArtistsForCurrentUser();
    artistDocIds = {};
    artistMeta = {};
    list.forEach(a => {
      const name = (a.name || '').trim();
      if (name) artistDocIds[name] = a.id;
      const ts = typeof a.createdAt?.seconds === 'number'
        ? a.createdAt.seconds
        : (typeof a.createdAt?._seconds === 'number' ? a.createdAt._seconds : null);
      if (name) artistMeta[name] = { createdAt: ts };
    });
  } catch (e) {
    artistDocIds = {};
    artistMeta = {};
  }
  rebuildArtistsFromSetlists();
  await ensureDefaultArtistSelected();
}

function rebuildArtistsFromSetlists() {
  const set = new Set(Object.keys(artistDocIds || {}));
  cachedSetlists.forEach(sl => {
    const name = (sl.artist || '').trim();
    if (name) set.add(name);
  });
  artistNames = Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  if (currentArtist && !set.has(currentArtist)) {
    currentArtist = '';
  }
  renderArtistSelect();
  updateEmptyPlaceholders();
}

function resolveLastAddedArtist() {
  let latestName = '';
  let latestTs = -Infinity;
  Object.entries(artistMeta || {}).forEach(([name, meta]) => {
    const ts = typeof meta?.createdAt === 'number' ? meta.createdAt : null;
    if (ts !== null && ts > latestTs) {
      latestTs = ts;
      latestName = name;
    }
  });
  if (latestName) return latestName;
  if (lastAddedArtistName && artistNames.includes(lastAddedArtistName)) return lastAddedArtistName;
  return artistNames[artistNames.length - 1] || '';
}

async function ensureDefaultArtistSelected() {
  if (currentArtist || artistNames.length === 0) return;
  const pick = resolveLastAddedArtist();
  if (!pick) return;
  await setCurrentArtistAndSync(pick);
}

// Firestore から履歴取得
async function refreshSetlistHistory() {
  if (!window.loadSetlistsForCurrentUser) return;
  try {
    cachedSetlists = await window.loadSetlistsForCurrentUser();
  } catch (e) {
    cachedSetlists = [];
  }
  rebuildArtistsFromSetlists();
  renderSetlistHistory();
  await ensureDefaultArtistSelected();
}

// モジュール側から呼べるようにする
window.__refreshSetlistHistory = refreshSetlistHistory;
window.__clearSetlistHistory = () => {
  cachedSetlists = [];
  setlistHistoryEl.innerHTML = '<option value="">保存済みセットリスト…</option>';
};
window.__refreshArtists = refreshArtistsFromFirestore;
window.__clearArtists = () => {
  artistDocIds = {};
  artistMeta = {};
  artistNames = [];
  currentArtist = '';
  lastAddedArtistName = '';
  renderArtistSelect();
  saveLocalState();
};

function getCurrentSetlistPayload() {
  const liveTitleRaw = (document.getElementById('liveTitle').value || '').trim();
  const liveDate  = (document.getElementById('liveDate').value || '').trim();
  const slotMinutes = parseInt(document.getElementById('slotMinutes').value || '0', 10);
  const liveTitle = buildAutoLiveTitle(liveTitleRaw, liveDate);

  const artist = (currentArtist || artistSelectEl?.value || '').trim();

  const items = Array.from(setlistEl.querySelectorAll('.song-item')).map(li => ({
    title: li.querySelector('.song-title')?.textContent || '',
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || ''
  })).filter(x => x.title);

  return { title: liveTitle, date: liveDate, slotMinutes, artist, items };
}

async function loadDraftForArtist(artistName, { respectLocalFlag = true } = {}) {
  if (!window.loadDraftSetlistForCurrentUser) return false;
  const target = (artistName || '').trim();
  if (respectLocalFlag && hasLocalStateLoaded && lastLoadedDraftArtist === target) return false;
  try {
    const draft = await window.loadDraftSetlistForCurrentUser(target);
    if (draft && draft.items) {
      applySetlistToUI(draft);
      lastLoadedDraftArtist = target;
      return true;
    }
  } catch (e) {
    console.error('draft load error:', e);
  }
  return false;
}

// アーティスト選択で履歴フィルタ
if (artistSelectEl) {
  artistSelectEl.addEventListener('change', async () => {
    await setCurrentArtistAndSync(artistSelectEl.value || '');
  });
}

// アーティスト追加ボタン
if (addArtistBtn) {
  addArtistBtn.addEventListener('click', async () => {
    const base = currentArtist || '';
    const name = window.prompt('追加するアーティスト名を入力してね', base);
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    if (artistDocIds[trimmed]) {
      currentArtist = trimmed;
      renderArtistSelect();
      renderSetlistHistory();
      return;
    }

    let savedId = null;
    if (window.saveArtistForCurrentUser) {
      try {
        savedId = await window.saveArtistForCurrentUser(trimmed);
      } catch (e) {
        console.error('artist save error:', e);
      }
    }
    if (savedId) {
      artistDocIds[trimmed] = savedId;
    }
    artistMeta[trimmed] = { createdAt: Date.now() / 1000 };

    if (!artistNames.includes(trimmed)) {
      artistNames.push(trimmed);
      artistNames.sort((a, b) => a.localeCompare(b, 'ja'));
    }
    lastAddedArtistName = trimmed;
    await setCurrentArtistAndSync(trimmed);
  });
}

// アーティスト削除（そのアーティストのセットのみ全部削除）
if (deleteArtistBtn) {
  deleteArtistBtn.addEventListener('click', async () => {
    if (!currentArtist) {
      alert('削除するアーティストを選んでね');
      return;
    }
    const related = cachedSetlists.filter(sl => sl.artist === currentArtist);
    const count = related.length;
    const ok = window.confirm(`「${currentArtist}」のセットリストを${count}件削除します。\n曲ライブラリは消えません。`);
    if (!ok) return;

    const docId = artistDocIds[currentArtist];

    if (window.deleteSetlistForCurrentUser) {
      for (const sl of related) {
        try {
          await window.deleteSetlistForCurrentUser(sl.id);
        } catch (e) {
          console.error('setlist delete error:', e);
        }
      }
    }
    if (window.deleteArtistForCurrentUser && docId) {
      try {
        await window.deleteArtistForCurrentUser(docId);
      } catch (e) {
        console.error('artist delete error:', e);
      }
    }
    if (window.deleteSongsByArtistForCurrentUser) {
      try {
        await window.deleteSongsByArtistForCurrentUser(currentArtist);
      } catch (e) {
        console.error('songs delete error:', e);
      }
    }
    // ローカルライブラリから該当アーティストの曲を除去
    Array.from(songLibraryEl.querySelectorAll('.song-item')).forEach(li => {
      if ((li.dataset.artist || '').trim() === currentArtist) {
        li.remove();
      }
    });
    delete artistDocIds[currentArtist];
    await refreshSetlistHistory();
    await setCurrentArtistAndSync('');
    updateEmptyPlaceholders();
  });
}


// 上書き版：createSongLi を使ってセットリストを描画し、アーティスト情報も保持する
function renderSetlistFromData(items = []) {
  setlistEl.innerHTML = '';
  items.forEach(song => {
    const li = createSongLi({
      title: song.title || '',
      durationSec: song.durationSec || 0,
      url: song.url || '',
      metaLabel: 'Custom',
      artist: song.artist || '',
      enableEdit: true
    });
    setlistEl.appendChild(li);
  });
  recalcTimes();
  saveLocalState();
}

async function loadSetlistById(id, { shouldAlertOnEmpty = false } = {}) {
  if (!id) {
    if (shouldAlertOnEmpty) alert('読み込むセットを選んでね');
    setlistHistoryEl.value = '';
    resetSetlistUI();
    return;
  }

  const sl = cachedSetlists.find(s => s.id === id);
  if (!sl) {
    if (shouldAlertOnEmpty) alert('選択したセットが見つかりません');
    return;
  }

  const artist = (sl.artist || '').trim();
  await setCurrentArtistAndSync(artist, { skipAutoLoad: true });

  if (!setlistHistoryEl.value || setlistHistoryEl.value !== id) {
    setlistHistoryEl.value = id;
  }

  applySetlistToUI(sl);
}

if (editLiveInfoBtn) {
  editLiveInfoBtn.addEventListener('click', openEditLiveInfoModal);
}

if (saveAllBtn) {
  saveAllBtn.addEventListener('click', async () => {
    const artist = (currentArtist || artistSelectEl?.value || '').trim();
    if (!artist) {
      alert('アーティストを選択してね');
      return;
    }
    if (!window.saveLibraryForCurrentUser || !window.saveDraftSetlistForCurrentUser) {
      alert('ログインしてから保存してね');
      return;
    }

    const libraryItems = getLibraryItemsWithOrder().map(item => ({
      ...item,
      artist: item.artist || artist
    }));
    if (!libraryItems.length) {
      alert('ライブラリに曲がありません');
      return;
    }

    const setlistPayload = getCurrentSetlistPayload();
    const hasSetlistItems = setlistPayload.items.length > 0;

    try {
      const ids = await window.saveLibraryForCurrentUser(libraryItems);
      const lis = Array.from(songLibraryEl.querySelectorAll('.song-item'));
      ids.forEach((id, idx) => {
        const li = lis[idx];
        if (li && id) {
          li.dataset.firestoreId = id;
          li.dataset.source = 'firestore';
        }
      });

      if (hasSetlistItems) {
        await window.saveDraftSetlistForCurrentUser(setlistPayload);
        lastLoadedDraftArtist = setlistPayload.artist || '';
        alert('ライブラリとセットリストを保存しました');
      } else {
        alert('ライブラリを保存しました（セットリストは空のためスキップ）');
      }
      saveLocalState();
    } catch (e) {
      console.error('保存エラー:', e);
      alert('保存に失敗しました');
    }
  });
}

loadSetlistBtn.addEventListener('click', async () => {
  await loadSetlistById(setlistHistoryEl.value, { shouldAlertOnEmpty: true });
});

// セットリストプルダウン変更時に自動で読み込む
setlistHistoryEl.addEventListener('change', async () => {
  await loadSetlistById(setlistHistoryEl.value, { shouldAlertOnEmpty: false });
});

deleteSetlistBtn.addEventListener('click', async () => {
  const id = setlistHistoryEl.value;
  if (!id) return alert('削除するセットを選んでね');

  const sl = cachedSetlists.find(s => s.id === id);
  const name = sl?.title || '無題セット';
  const ok = window.confirm(`「${name}」を本当に削除しますか？`);
  if (!ok) return;

  await window.deleteSetlistForCurrentUser(id);
  alert('削除しました');
  await refreshSetlistHistory();
  setlistHistoryEl.value = '';
  autoLoadSetlistForCurrentArtist();
  saveLocalState();
});

// ローカル状態を復元（初期表示用）
loadLocalState();

// 初期計算
recalcTimes();

