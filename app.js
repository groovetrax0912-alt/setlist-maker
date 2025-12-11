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

function getLiTitleText(li) {
  if (!li) return '';
  if (li.dataset?.baseTitle) return (li.dataset.baseTitle || '').trim();
  const textEl = li.querySelector('.song-title-text');
  if (textEl) return (textEl.textContent || '').trim();
  const titleEl = li.querySelector('.song-title');
  return (titleEl?.textContent || '').trim();
}

function parseCompactDuration(input = '') {
  const raw = (input || '').trim();
  if (!raw) return null;
  if (raw.includes(':')) {
    return parseMmSsToSec(raw);
  }
  // 数字のみ: 下2桁を秒、それ以外を分として扱う
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const secPart = digits.slice(-2);
  const minPart = digits.slice(0, -2) || '0';
  const m = parseInt(minPart, 10);
  const s = parseInt(secPart, 10);
  if (isNaN(m) || isNaN(s) || s >= 60) return null;
  return m * 60 + s;
}

function escapeHtml(str = '') {
  return (str || '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return ch;
    }
  });
}

function formatSetlistNumber(idx = 0) {
  return `M-${String(idx + 1).padStart(2, '0')}`;
}

function encodeShareToken(data = {}) {
  try {
    const json = JSON.stringify(data);
    return btoa(encodeURIComponent(json));
  } catch (e) {
    console.error('共有リンク生成エラー:', e);
    return '';
  }
}

function decodeShareToken(token = '') {
  if (!token) return null;
  try {
    const json = decodeURIComponent(atob(token));
    return JSON.parse(json);
  } catch (e) {
    console.error('共有リンク読み込みエラー:', e);
    return null;
  }
}

function updateSetlistNumbers() {
  if (!setlistEl) return;
  const items = setlistEl.querySelectorAll('.song-item');
  items.forEach((li, idx) => {
    const titleEl = li.querySelector('.song-title');
    if (!titleEl) return;

    let textEl = titleEl.querySelector('.song-title-text');
    if (!textEl) {
      textEl = document.createElement('span');
      textEl.className = 'song-title-text';
      textEl.textContent = (li.dataset.baseTitle || titleEl.textContent || '').trim();
      titleEl.innerHTML = '';
      titleEl.appendChild(textEl);
    }

    let numEl = titleEl.querySelector('.setlist-num');
    if (!numEl) {
      numEl = document.createElement('span');
      numEl.className = 'setlist-num';
      titleEl.insertBefore(numEl, titleEl.firstChild);
    }
    numEl.textContent = formatSetlistNumber(idx);
  });
}

// 合計時間や残り時間を計算
function recalcTimes() {
  const setlistEl = document.getElementById('setlist');
  const items = setlistEl.querySelectorAll('.song-item');
  updateSetlistNumbers();
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
  updateShareLinkUI();
}

function removeSetlistEditButtons() {
  if (!setlistEl) return;
  setlistEl.querySelectorAll('.edit-btn').forEach(btn => btn.remove());
}

function createSongLi({ title = '', durationSec = 0, url = '', sheetUrl = '', source = '', firestoreId = '', artist = '', enableEdit = false }) {
  const li = document.createElement('li');
  li.className = 'song-item';
  li.dataset.duration = String(durationSec || 0);
  li.dataset.baseTitle = title || '';
  const safeUrl = normalizeUrl(url);
  if (safeUrl) li.dataset.url = safeUrl;
  const safeSheet = normalizeUrl(sheetUrl);
  if (safeSheet) li.dataset.sheetUrl = safeSheet;
  if (source) li.dataset.source = source;
  if (firestoreId) li.dataset.firestoreId = firestoreId;
  if (artist) li.dataset.artist = artist;

  li.innerHTML = `
    <div class="song-main">
      <div class="song-title"><span class="song-title-text"></span></div>
      <div class="song-meta"></div>
    </div>
    <div class="song-right">
      ${safeUrl ? '<button class="icon-btn link-btn" title="音源を開く（URL登録時）">🔗</button>' : ''}
      ${safeSheet ? '<button class="icon-btn sheet-btn" title="譜面を開く（PDF/JPG/PNG）">📑</button>' : ''}
      <div class="song-duration">${formatTime(durationSec || 0)}</div>
      ${enableEdit ? '<button class="icon-btn edit-btn" title="この曲を編集">✏</button>' : ''}
      <button class="icon-btn delete-btn" title="この曲を削除">✕</button>
      ${enableEdit ? '<button class="icon-btn add-to-setlist-btn" title="セットリストに追加">▸</button>' : ''}
    </div>
  `;
  const titleSpan = li.querySelector('.song-title-text');
  if (titleSpan) titleSpan.textContent = title || '';
  return li;
}

function appendSongToSetlistFromLibrary(li) {
  if (!setlistEl || isSharedPreviewMode) return;
  const payload = {
    title: getLiTitleText(li),
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    sheetUrl: li.dataset.sheetUrl || '',
    artist: li.dataset.artist || ''
  };
  const newLi = createSongLi({
    title: payload.title,
    durationSec: payload.durationSec,
    url: payload.url,
    sheetUrl: payload.sheetUrl,
    artist: payload.artist,
    enableEdit: false
  });
  setlistEl.appendChild(newLi);
  removeSetlistEditButtons();
  recalcTimes();
  saveLocalState();
  setSetlistDirty(true);
  updateEmptyPlaceholders();
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
      sheetUrl: song.sheetUrl || '',
      source: song.source || '',
      firestoreId: song.firestoreId || '',
      artist: song.artist || '',
      enableEdit: true
    });
    li.dataset.order = typeof song.order === 'number' ? String(song.order) : String(idx);
    songLibraryEl.appendChild(li);
  });
  updateEmptyPlaceholders();
  setLibraryDirty(false);
}

function enforceArtistEmptyState() {
  const noArtists = artistNames.length === 0;
  if (isSharedPreviewMode) return false;
  if (!noArtists || isApplyingArtistEmptyState) return false;

  const hasLibraryItems = !!songLibraryEl?.querySelector('.song-item');
  const hasSetlistItems = !!setlistEl?.querySelector('.song-item');
  const hasSelection    = !!(currentArtist || setlistHistoryEl?.value);
  if (!hasLibraryItems && !hasSetlistItems && !hasSelection) return false;

  isApplyingArtistEmptyState = true;
  currentArtist = '';
  currentLiveId = '';
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
    if (!isSharedPreviewMode) {
      enforceArtistEmptyState();
    }
  }
  ensurePlaceholder(songLibraryEl, '曲ライブラリに曲を追加してください');
  ensurePlaceholder(setlistEl, 'セットリストに曲を追加してください');
}

function saveLocalState() {
  if (!window.localStorage) return;
  const libraryItems = Array.from(songLibraryEl.querySelectorAll('.song-item')).map((li, idx) => ({
    title: getLiTitleText(li),
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    sheetUrl: li.dataset.sheetUrl || '',
    source: li.dataset.source || '',
    firestoreId: li.dataset.firestoreId || '',
    artist: li.dataset.artist || '',
    order: idx
  }));

  const setlistItems = Array.from(setlistEl.querySelectorAll('.song-item')).map(li => ({
    title: getLiTitleText(li),
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    sheetUrl: li.dataset.sheetUrl || '',
    artist: li.dataset.artist || ''
  }));

  const state = {
    currentArtist: isSharedPreviewMode ? sharedPreviewArtist : currentArtist,
    liveTitle: (document.getElementById('liveTitle').value || '').trim(),
    liveDate: (document.getElementById('liveDate').value || '').trim(),
    slotMinutes: parseInt(document.getElementById('slotMinutes').value || '0', 10),
    library: libraryItems,
    setlist: setlistItems,
    selectedSetlistId: isSharedPreviewMode ? '' : (currentLiveId || setlistHistoryEl.value || ''),
    currentLiveId: isSharedPreviewMode ? '' : (currentLiveId || setlistHistoryEl.value || '')
  };
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('localStorage save error', e);
  }
}

function updateLiveSummaryFromInputs() {
  const titleInput = document.getElementById('liveTitle');
  const dateInput = document.getElementById('liveDate');
  const slotInput = document.getElementById('slotMinutes');
  if (!titleInput || !dateInput || !slotInput) return;

  const rawTitle = (titleInput.value || '').trim();
  const rawDate = (dateInput.value || '').trim();
  const slot = parseInt(slotInput.value || '0', 10);
  const displayTitle = (!rawTitle && !rawDate)
    ? '未設定'
    : buildAutoLiveTitle(rawTitle, rawDate);

  if (liveTitleDisplayEl) liveTitleDisplayEl.textContent = displayTitle;
  if (slotMinutesDisplayEl) slotMinutesDisplayEl.textContent = isNaN(slot) ? '0' : String(slot);
  if (liveDateDisplayEl) liveDateDisplayEl.textContent = rawDate ? rawDate.replace(/-/g, '/') : '未設定';
  updateShareLinkUI();
}

function applyLiveInfoToUI({ title = '', date = '', slotMinutes = 30 } = {}) {
  const titleInput = document.getElementById('liveTitle');
  const dateInput = document.getElementById('liveDate');
  const slotInput = document.getElementById('slotMinutes');
  if (titleInput) titleInput.value = title;
  if (dateInput) dateInput.value = date;
  if (slotInput) slotInput.value = typeof slotMinutes === 'number' ? slotMinutes : 0;
  updateLiveSummaryFromInputs();
}

function updateSongLiFields(li, { title, durationSec, url, sheetUrl }) {
  const titleEl = li.querySelector('.song-title-text') || li.querySelector('.song-title');
  const metaEl = li.querySelector('.song-meta');
  const durationEl = li.querySelector('.song-duration');
  const linkBtn = li.querySelector('.link-btn');
  const sheetBtn = li.querySelector('.sheet-btn');
  const safeUrl = normalizeUrl(url);
  const safeSheet = normalizeUrl(sheetUrl);

  li.dataset.baseTitle = title || '';
  li.dataset.duration = String(durationSec || 0);

  if (titleEl) {
    if (titleEl.classList.contains('song-title-text')) {
      titleEl.textContent = title || '';
    } else {
      titleEl.textContent = title || '';
    }
  }

  if (safeUrl) {
    li.dataset.url = safeUrl;
    if (!linkBtn && durationEl?.parentElement) {
      const btn = document.createElement('button');
      btn.className = 'icon-btn link-btn';
      btn.title = '音源を開く（URL登録時）';
      btn.textContent = '🔗';
      durationEl.parentElement.insertBefore(btn, durationEl);
    } else if (linkBtn) {
      linkBtn.textContent = '🔗';
    }
  } else {
    delete li.dataset.url;
    if (linkBtn) linkBtn.remove();
  }

  if (safeSheet) {
    li.dataset.sheetUrl = safeSheet;
    if (!sheetBtn && durationEl?.parentElement) {
      const btn = document.createElement('button');
      btn.className = 'icon-btn sheet-btn';
      btn.title = '譜面を開く（PDF/JPG/PNG）';
      btn.textContent = '📑';
      durationEl.parentElement.insertBefore(btn, durationEl);
    } else if (sheetBtn) {
      sheetBtn.textContent = '📑';
    }
  } else {
    delete li.dataset.sheetUrl;
    if (sheetBtn) sheetBtn.remove();
  }

  if (metaEl) metaEl.textContent = '';
  if (durationEl) durationEl.textContent = formatTime(durationSec || 0);
}

function propagateLibraryEditToSetlist(sourceLi, payload, { matchTitle = '', matchArtist = '' } = {}) {
  if (!setlistEl) return 0;
  const firestoreId = sourceLi.dataset.firestoreId || '';
  const baseTitle = (sourceLi.dataset.baseTitle || '').trim();
  const artist = (sourceLi.dataset.artist || '').trim();
  const titleCandidates = [matchTitle, baseTitle].map(t => (t || '').trim()).filter(Boolean);
  const artistMatch = (matchArtist || artist || '').trim();
  let updated = 0;

  Array.from(setlistEl.querySelectorAll('.song-item')).forEach((li) => {
    const sameId = firestoreId && li.dataset.firestoreId === firestoreId;
    const label = (li.dataset.baseTitle || '').trim();
    const sameLabel = !firestoreId &&
      !li.dataset.firestoreId &&
      titleCandidates.includes(label) &&
      (li.dataset.artist || '').trim() === artistMatch;
    if (!sameId && !sameLabel) return;
    updateSongLiFields(li, payload);
    updated++;
  });
  return updated;
}

function propagateSetlistEditToLibrary(sourceLi, payload, { matchTitle = '', matchArtist = '' } = {}) {
  if (!songLibraryEl) return 0;
  const firestoreId = sourceLi.dataset.firestoreId || '';
  const baseTitle = (sourceLi.dataset.baseTitle || '').trim();
  const artist = (sourceLi.dataset.artist || '').trim();
  const titleCandidates = [matchTitle, baseTitle].map(t => (t || '').trim()).filter(Boolean);
  const artistMatch = (matchArtist || artist || '').trim();
  let updated = 0;

  Array.from(songLibraryEl.querySelectorAll('.song-item')).forEach((li) => {
    const sameId = firestoreId && li.dataset.firestoreId === firestoreId;
    const label = (li.dataset.baseTitle || '').trim();
    const sameLabel = !firestoreId &&
      !li.dataset.firestoreId &&
      titleCandidates.includes(label) &&
      (li.dataset.artist || '').trim() === artistMatch;
    if (!sameId && !sameLabel) return;
    updateSongLiFields(li, payload);
    updated++;
  });
  return updated;
}

function findLibraryItemFor(sourceLi, { matchTitle = '', matchArtist = '' } = {}) {
  if (!songLibraryEl) return null;
  const firestoreId = sourceLi.dataset.firestoreId || '';
  const baseTitle = (sourceLi.dataset.baseTitle || '').trim();
  const artist = (sourceLi.dataset.artist || '').trim();
  const titleCandidates = [matchTitle, baseTitle].map(t => (t || '').trim()).filter(Boolean);
  const artistMatch = (matchArtist || artist || '').trim();

  let fallback = null;
  for (const li of songLibraryEl.querySelectorAll('.song-item')) {
    if (firestoreId && li.dataset.firestoreId === firestoreId) return li;
    if (firestoreId) continue;
    const sameLabel = !li.dataset.firestoreId &&
      titleCandidates.includes((li.dataset.baseTitle || '').trim()) &&
      (li.dataset.artist || '').trim() === artistMatch;
    if (sameLabel) {
      fallback = li;
      break;
    }
  }
  return fallback;
}

async function applySongEdits(li, { title, durationSec, url, sheetUrl }) {
  const listId = li.parentElement?.id;
  const prevTitle = (li.dataset.baseTitle || li.querySelector('.song-title-text')?.textContent || '').trim();
  const prevArtist = (li.dataset.artist || '').trim();
  const normalizedPayload = { title, durationSec, url: normalizeUrl(url), sheetUrl: normalizeUrl(sheetUrl) };

  updateSongLiFields(li, normalizedPayload);
  saveLocalState();
  if (listId === 'setlist') {
    const changed = propagateSetlistEditToLibrary(li, normalizedPayload, { matchTitle: prevTitle, matchArtist: prevArtist });
    if (changed > 0) {
      const libLi = findLibraryItemFor(li, { matchTitle: prevTitle, matchArtist: prevArtist });
      if (libLi) await persistSongEditToFirestore(libLi);
      saveLocalState();
      recalcTimes();
      setLibraryDirty(true);
      setSetlistDirty(true);
    } else {
      recalcTimes();
      setSetlistDirty(true);
    }
  } else if (listId === 'songLibrary') {
    const changed = propagateLibraryEditToSetlist(li, normalizedPayload, { matchTitle: prevTitle, matchArtist: prevArtist });
    if (changed > 0) {
      recalcTimes();
      saveLocalState();
      setSetlistDirty(true);
    }
    setLibraryDirty(true);
  }
}

async function persistSongEditToFirestore(li) {
  const firestoreId = li.dataset.firestoreId;
  const auth = window._setlistFirebase?.auth;
  if (!firestoreId || !window.updateSongForCurrentUser || !auth?.currentUser) return;
  const order = Array.from(songLibraryEl.querySelectorAll('.song-item')).indexOf(li);
  const payload = {
    title: getLiTitleText(li),
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    sheetUrl: li.dataset.sheetUrl || '',
    artist: li.dataset.artist || '',
    order
  };
  try {
    await window.updateSongForCurrentUser(firestoreId, payload);
  } catch (e) {
    console.error('Firestore更新エラー:', e);
  }
}

async function persistLibrarySnapshot() {
  if (!window.saveLibraryForCurrentUser) return false;
  const artist = (currentArtist || artistSelectEl?.value || '').trim();
  if (!artist) return false;
  const items = getLibraryItemsWithOrder().map(item => ({
    ...item,
    artist: item.artist || artist
  }));
  if (!items.length) return false;
  try {
    await window.saveLibraryForCurrentUser(items);
    return true;
  } catch (e) {
    console.error('ライブラリ保存エラー:', e);
    return false;
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
  const title = getLiTitleText(li);
  const currentDuration = parseInt(li.dataset.duration || '0', 10);
  const url = li.dataset.url || '';

  editSongTitleEl.value = title;
  editSongDurationEl.value = formatTime(currentDuration);
  editSongUrlEl.value = url;
  if (editSongSheetFileEl) editSongSheetFileEl.value = '';
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

function openLiveInfoModal(mode = 'edit') {
  if (!editLiveInfoModal || !editLiveInfoForm) return;
  liveInfoModalMode = mode;
  const isCreate = mode === 'create';
  const targetId = currentLiveId || setlistHistoryEl?.value;
  const current = cachedSetlists.find(s => s.id === targetId);

  showEditLiveInfoError('');
  if (liveInfoModalTitleEl) {
    liveInfoModalTitleEl.textContent = isCreate ? '新規ライブ情報を追加' : 'ライブ情報を編集';
  }
  if (liveInfoSubmitBtn) {
    liveInfoSubmitBtn.textContent = isCreate ? '作成' : '保存';
  }

  if (!isCreate) {
    if (!targetId) {
      alert('編集するライブ情報を選んでね');
      return;
    }
    if (!current) {
      alert('ライブ情報が見つかりません');
      return;
    }
  }

  const titleInput = document.getElementById('liveTitle');
  const dateInput  = document.getElementById('liveDate');
  const slotInput  = document.getElementById('slotMinutes');

  editLiveTitleEl.value   = titleInput?.value || current?.title || '';
  editLiveDateEl.value    = dateInput?.value  || current?.date  || '';
  editSlotMinutesEl.value = slotInput?.value || current?.slotMinutes || 30;

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
  clearSharePreview();
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
    currentLiveId = state.currentLiveId || state.selectedSetlistId || '';
    applyLiveInfoToUI({
      title: state.liveTitle || '',
      date: state.liveDate || '',
      slotMinutes: typeof state.slotMinutes === 'number' ? state.slotMinutes : 30
    });
    renderSongLibraryFromData(state.library || []);
    renderSetlistFromData(state.setlist || []);
    if (!state.selectedSetlistId && (!state.library || state.library.length === 0) && (state.setlist || []).length > 0) {
      setlistEl.innerHTML = '';
      recalcTimes();
    }
    if (state.currentLiveId) {
      setlistHistoryEl.value = state.currentLiveId;
    } else if (state.selectedSetlistId) {
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
    title: getLiTitleText(li),
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    sheetUrl: li.dataset.sheetUrl || '',
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
const newSongSheetFileEl = document.getElementById('newSongSheetFile');
const newSongSheetUploadBtn = document.getElementById('newSongSheetUploadBtn');
const newSongDurationCompactEl  = document.getElementById('newSongDurationCompact');
const addSongBtn    = document.getElementById('addSongBtn');
const saveAllBtn    = document.getElementById('saveAllBtn');
const saveLibraryBtn= document.getElementById('saveLibraryBtn');
const editSongModal = document.getElementById('editSongModal');
const editSongForm  = document.getElementById('editSongForm');
const editSongTitleEl = document.getElementById('editSongTitle');
const editSongDurationEl = document.getElementById('editSongDuration');
const editSongUrlEl = document.getElementById('editSongUrl');
const editSongSheetFileEl = document.getElementById('editSongSheetFile');
const editSongErrorEl = document.getElementById('editSongError');
const liveTitleDisplayEl = document.getElementById('liveTitleDisplay');
const slotMinutesDisplayEl = document.getElementById('slotMinutesDisplay');
const liveDateDisplayEl = document.getElementById('liveDateDisplay');
const addLiveInfoBtn = document.getElementById('addLiveInfoBtn');
const shareLinkField = document.getElementById('shareLinkField');
const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
const shareLinkHintEl = document.getElementById('shareLinkHint');
const sharePreviewBannerEl = document.getElementById('sharePreviewBanner');
const clearSetlistBtn = document.getElementById('clearSetlist');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const audioPreviewModal = document.getElementById('audioPreviewModal');
const audioPreviewFrame = document.getElementById('audioPreviewFrame');
const audioPreviewTitleEl = document.getElementById('audioPreviewTitle');

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
const liveInfoModalTitleEl  = document.getElementById('liveInfoModalTitle');
const liveInfoSubmitBtn     = document.getElementById('liveInfoSubmitBtn');

const EMPTY_PLACEHOLDER_CLASS = 'empty-hint';
const LOCAL_STATE_KEY = 'setlistMakerState';
const SHEET_MAX_BYTES = 2 * 1024 * 1024; // 2MB
let hasLocalStateLoaded = false;
let lastLoadedDraftArtist = '';
let isApplyingArtistEmptyState = false;
let songLibrarySortable = null;
let setlistSortable = null;
let lastArtistSelectValue = '';
let lastSetlistSelectValue = '';
let audioPreviewUrl = '';

function updateSaveButtons() {
  if (saveLibraryBtn) saveLibraryBtn.disabled = !libraryDirty;
  if (saveAllBtn) saveAllBtn.disabled = !setlistDirty;
}
function setLibraryDirty(flag = true) {
  libraryDirty = !!flag;
  updateSaveButtons();
}
function setSetlistDirty(flag = true) {
  setlistDirty = !!flag;
  updateSaveButtons();
}

function hasUnsavedChanges() {
  return !!(libraryDirty || setlistDirty);
}

function confirmDiscardChanges() {
  if (!hasUnsavedChanges()) return true;
  return window.confirm('保存していない変更があります。続行しますか？\nはい: 保存せず進む / いいえ: キャンセル');
}

function setDragAndDropEnabled(flag = true) {
  if (songLibrarySortable) songLibrarySortable.option('disabled', !flag);
  if (setlistSortable) setlistSortable.option('disabled', !flag);
}

function buildEmbedUrl(url = '') {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // YouTube
    if (host.includes('youtube.com') || host === 'youtu.be') {
      let videoId = '';
      if (u.searchParams.get('v')) {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/')[2] || '';
      } else if (host === 'youtu.be') {
        videoId = u.pathname.replace('/', '');
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    // Google Drive file
    if (host.includes('drive.google.com')) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }
    // fallback: same URL（iframe再生できない場合はブラウザ挙動に依存）
    return url;
  } catch (e) {
    return url;
  }
}

async function uploadSheetFile(file) {
  if (!file) return '';
  if (file.size > SHEET_MAX_BYTES) {
    alert('譜面ファイルは2MB以内にしてね');
    return null;
  }
  if (!window.uploadSheetForCurrentUser) {
    alert('ログインしてからファイルをアップロードしてね');
    return null;
  }
  try {
    return await window.uploadSheetForCurrentUser(file);
  } catch (e) {
    console.error('譜面アップロードエラー:', e);
    alert('譜面ファイルのアップロードに失敗しました');
    return null;
  }
}

function openAudioPreview(url = '', title = '', label = '音源プレビュー') {
  if (!audioPreviewModal || !audioPreviewFrame) {
    window.open(url, '_blank');
    return;
  }
  const embed = buildEmbedUrl(url);
  audioPreviewUrl = embed;
  if (audioPreviewFrame) {
    audioPreviewFrame.src = embed;
  }
  if (audioPreviewTitleEl) {
    const base = label || '音源プレビュー';
    audioPreviewTitleEl.textContent = title ? `${base}: ${title}` : base;
  }
  audioPreviewModal.classList.remove('hidden');
}

function closeAudioPreview() {
  if (!audioPreviewModal || !audioPreviewFrame) return;
  audioPreviewFrame.src = '';
  audioPreviewUrl = '';
  audioPreviewModal.classList.add('hidden');
}

function openSheetPreview(url = '', title = '') {
  const label = '譜面プレビュー';
  if (!url) {
    alert('譜面URLがありません');
    return;
  }
  openAudioPreview(url, title, label);
}

function updateLiveControlsEnabled() {
  const hasSelection = !!(setlistHistoryEl?.value);
  const controls = [
    editLiveInfoBtn,
    deleteSetlistBtn,
    saveAllBtn,
    clearSetlistBtn,
    exportPdfBtn,
    copyShareLinkBtn
  ];
  controls.forEach(btn => {
    if (!btn) return;
    btn.disabled = !hasSelection;
  });
}

function clearSharePreview() {
  isSharedPreviewMode = false;
  sharedPreviewArtist = '';
  document.body?.classList.remove('shared-preview');
  setDragAndDropEnabled(true);
  if (sharePreviewBannerEl) {
    sharePreviewBannerEl.classList.add('hidden');
  }
}

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
  songLibrarySortable = Sortable.create(songLibraryEl, {
    group: { name:'songs', pull:'clone', put:false },
    animation:150,
    sort:true,
    onUpdate: () => { saveLocalState(); setLibraryDirty(true); }
  });

  // セットリスト側
  setlistSortable = Sortable.create(setlistEl, {
    group: { name:'songs', pull:true, put:true },
    animation:150,
    sort:true,
    onAdd: () => { removeSetlistEditButtons(); recalcTimes(); saveLocalState(); setSetlistDirty(true); },
    onUpdate: () => { recalcTimes(); saveLocalState(); setSetlistDirty(true); },
    onRemove: () => { recalcTimes(); saveLocalState(); setSetlistDirty(true); }
  });
} else {
  console.error('SortableJS がロードされていないか、リスト要素が見つかりません');
}

// 持ち時間変更で再計算
document.getElementById('slotMinutes').addEventListener('input', () => {
  updateLiveSummaryFromInputs();
  recalcTimes();
  setSetlistDirty(true);
});

// 曲ライブラリ：ワンクリックでセットリスト末尾に追加
document.addEventListener('click', (event) => {
  const addBtn = event.target.closest('.add-to-setlist-btn');
  if (!addBtn) return;
  const item = addBtn.closest('.song-item');
  if (!item || item.parentElement?.id !== 'songLibrary') return;
  appendSongToSetlistFromLibrary(item);
});

// ライブラリ/セットリスト共通：削除アイコン
document.addEventListener('click', (event) => {
  const delBtn = event.target.closest('.delete-btn');
  if (!delBtn) return;

  const item = delBtn.closest('.song-item');
  if (!item) return;
  const list = item.parentElement;
  if (!list) return;

  if (list.id === 'songLibrary') {
    const title = getLiTitleText(item) || 'この曲';
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
    setLibraryDirty(true);
  } else if (list.id === 'setlist') {
    item.remove();
    recalcTimes();
    saveLocalState();
    setSetlistDirty(true);
  }
});

// 曲ライブラリ：曲情報を編集（モーダル）
document.addEventListener('click', (event) => {
  const editBtn = event.target.closest('.edit-btn');
  if (!editBtn) return;

  const item = editBtn.closest('.song-item');
  const list = item?.parentElement;
  if (!list || list.id !== 'songLibrary') return;

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
    const sheetFile = editSongSheetFileEl?.files?.[0] || null;
    const parentId = editingSongLi.parentElement?.id;

    if (!title) {
      showEditSongError('曲名を入力してね');
      return;
    }
    const parsedSec = parseCompactDuration(durationInput);
    if (parsedSec === null) {
      showEditSongError('mm:ss か 0324 のように入力してね');
      return;
    }

    const submitBtn = editSongForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      let sheetUrl = editingSongLi.dataset.sheetUrl || '';
      if (sheetFile) {
        const uploaded = await uploadSheetFile(sheetFile);
        if (!uploaded) return;
        sheetUrl = uploaded;
      }

      await applySongEdits(editingSongLi, { title, durationSec: parsedSec, url, sheetUrl });
      if (parentId === 'songLibrary') {
        await persistSongEditToFirestore(editingSongLi);
      }
      closeEditSongModal();
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ライブ情報編集モーダル submit
if (editLiveInfoForm) {
  editLiveInfoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mode = liveInfoModalMode || 'edit';
    const artist = (currentArtist || artistSelectEl?.value || '').trim();
    const setlistId = currentLiveId || setlistHistoryEl?.value;

    if (!artist) {
      showEditLiveInfoError('アーティストを選択してね');
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

    if (mode === 'create') {
      const payload = {
        title,
        date,
        slotMinutes: slot,
        artist,
        items: []
      };
      let newId = `local-${Date.now()}`;
      if (window.saveSetlistForCurrentUser) {
        try {
          newId = await window.saveSetlistForCurrentUser(payload);
        } catch (e) {
          console.error('setlist create error:', e);
        }
      }
      cachedSetlists.unshift({ id: newId, ...payload });
      renderSetlistHistory();
      currentLiveId = newId;
      if (setlistHistoryEl) setlistHistoryEl.value = newId;
      applyLiveInfoToUI(payload);
      setlistEl.innerHTML = '';
      recalcTimes();
      saveLocalState();
      setSetlistDirty(true);
      closeEditLiveInfoModal();
      return;
    }

    if (!setlistId) {
      showEditLiveInfoError('編集するライブ情報を選んでね');
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
    currentLiveId = setlistId;
    updateLiveSummaryFromInputs();
    recalcTimes();
    saveLocalState();
    setSetlistDirty(true);

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
  setSetlistDirty(true);
});

// URLを開く
document.addEventListener('click', (event) => {
  const linkBtn = event.target.closest('.link-btn');
  if (!linkBtn) return;

  const item = linkBtn.closest('.song-item');
  const url = item?.dataset.url;
  if (!url) return alert('この曲にはURLがありません');

  const safeUrl = normalizeUrl(url);
  const title = getLiTitleText(item);
  openAudioPreview(safeUrl, title);
});

// 譜面を開く
document.addEventListener('click', (event) => {
  const sheetBtn = event.target.closest('.sheet-btn');
  if (!sheetBtn) return;
  const item = sheetBtn.closest('.song-item');
  const url = item?.dataset.sheetUrl;
  if (!url) return alert('この曲には譜面URLがありません');
  const safeUrl = normalizeUrl(url);
  const title = getLiTitleText(item);
  openSheetPreview(safeUrl, title);
});

// セットリストクリア
document.getElementById('clearSetlist').addEventListener('click', ()=>{
  const ok = window.confirm('セットリストを全部クリアしますか？');
  if (!ok) return;
  clearSharePreview();
  setlistEl.innerHTML = '';
  recalcTimes();
  saveLocalState();
  setSetlistDirty(true);
});

// 曲追加（手入力）
async function addSong() {
  const title = (newSongTitleEl.value || '').trim();
  const url   = (newSongUrlEl.value || '').trim();
  const sheetFile = newSongSheetFileEl?.files?.[0] || null;
  const durationRaw = (newSongDurationCompactEl.value || '').trim();
  const artist= (currentArtist || artistSelectEl?.value || '').trim();

  if (!title) return alert('曲名を入力してね');
  const totalSec = parseCompactDuration(durationRaw);
  if (totalSec === null || totalSec <= 0) return alert('長さを mm:ss か 0324 のように入力してね');

  if (addSongBtn) addSongBtn.disabled = true;
  try {
    const normalizedUrl = normalizeUrl(url);
    let normalizedSheet = '';
    if (sheetFile) {
      const uploaded = await uploadSheetFile(sheetFile);
      if (!uploaded) {
        return; // アップロードに失敗したら保存中断
      }
      normalizedSheet = uploaded;
    }
    const li = createSongLi({
      title,
      durationSec: totalSec,
      url: normalizedUrl,
      sheetUrl: normalizedSheet,
      source: 'local',
      artist,
      enableEdit: true
    });
    songLibraryEl.appendChild(li);
    setLibraryDirty(true);

    if (window.saveSongForCurrentUser) {
      try {
        const id = await window.saveSongForCurrentUser({
          title,
          durationSec: totalSec,
          url: normalizedUrl,
          sheetUrl: normalizedSheet,
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
    if (newSongSheetFileEl) newSongSheetFileEl.value = '';
    if (newSongSheetUploadBtn) newSongSheetUploadBtn.textContent = '📑 譜面をアップロード（任意）';
    newSongDurationCompactEl.value = '';
    newSongTitleEl.focus();
    updateEmptyPlaceholders();
    saveLocalState();
    await persistLibrarySnapshot();
  } finally {
    if (addSongBtn) addSongBtn.disabled = false;
  }
}

addSongBtn.addEventListener('click', addSong);
if (newSongDurationCompactEl) {
  newSongDurationCompactEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSong();
  });
}
if (newSongSheetUploadBtn && newSongSheetFileEl) {
  const resetSheetBtnLabel = () => {
    newSongSheetUploadBtn.textContent = '📑 譜面をアップロード（任意）';
  };
  resetSheetBtnLabel();
  newSongSheetUploadBtn.addEventListener('click', () => newSongSheetFileEl.click());
  newSongSheetFileEl.addEventListener('change', () => {
    const file = newSongSheetFileEl.files?.[0];
    if (file) {
      newSongSheetUploadBtn.textContent = `📑 ${file.name}`;
    } else {
      resetSheetBtnLabel();
    }
  });
}

if (saveLibraryBtn) {
  saveLibraryBtn.addEventListener('click', async () => {
    const artist = (currentArtist || artistSelectEl?.value || '').trim();
    if (!artist) {
      alert('アーティストを選択してね');
      return;
    }
    if (!window.saveLibraryForCurrentUser) {
      alert('ログインしてから保存してね');
      return;
    }
    const ok = await persistLibrarySnapshot();
    if (ok) {
      setLibraryDirty(false);
      alert('曲ライブラリを保存しました');
    } else {
      alert('保存に失敗しました');
    }
  });
}

if (copyShareLinkBtn) {
  copyShareLinkBtn.addEventListener('click', async () => {
    const link = (shareLinkField?.value || '').trim();
    if (!link) {
      alert('共有リンクがまだありません');
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        shareLinkField?.focus();
        shareLinkField?.select();
        document.execCommand('copy');
      }
      updateShareLinkUI('リンクをコピーしました');
    } catch (e) {
      console.error('share link copy error', e);
      alert('コピーに失敗しました。手動で選択してください。');
    }
  });
}

// =========================
// セットリスト保存 / 読み込み / 削除 UI
const deleteSetlistBtn = document.getElementById('deleteSetlistBtn');
const setlistHistoryEl = document.getElementById('setlistHistory');

let cachedSetlists = [];
let currentArtist  = '';
let currentLiveId  = '';
let artistNames    = [];
let artistDocIds   = {};
let artistMeta     = {}; // name -> { createdAt?: number }
let lastAddedArtistName = '';
let editingSongLi  = null;
let liveInfoModalMode = 'edit';
let libraryDirty   = false;
let setlistDirty   = false;
let isSharedPreviewMode = false;
let sharedPreviewArtist = '';

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
  lastArtistSelectValue = artistSelectEl.value;
  updateEmptyPlaceholders();
}

// セットリスト履歴描画（アーティストでフィルタ）
function renderSetlistHistory() {
  setlistHistoryEl.innerHTML = '<option value="">ライブ情報を選択…</option>';
  const list = cachedSetlists.filter(sl => !currentArtist || sl.artist === currentArtist);
  if (currentLiveId && !list.some(sl => sl.id === currentLiveId)) {
    currentLiveId = '';
  }

  list.forEach(sl => {
    const opt = document.createElement('option');
    const title = buildAutoLiveTitle(sl.title, sl.date);
    const dateStr = sl.date ? `(${sl.date}) ` : '';
    opt.value = sl.id;
    opt.textContent = dateStr + title;
    setlistHistoryEl.appendChild(opt);
  });
  if (currentLiveId && list.some(sl => sl.id === currentLiveId)) {
    setlistHistoryEl.value = currentLiveId;
  }
  lastSetlistSelectValue = setlistHistoryEl.value || '';
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
  clearSharePreview();
  currentLiveId = '';
  applyLiveInfoToUI({ title: '', date: '', slotMinutes: 30 });
  setlistEl.innerHTML = '';
  recalcTimes();
  saveLocalState();
  setSetlistDirty(false);
  if (setlistHistoryEl) {
    lastSetlistSelectValue = setlistHistoryEl.value || '';
  }
  updateLiveControlsEnabled();
}

function applySetlistToUI(sl) {
  clearSharePreview();
  if (sl.id) {
    currentLiveId = sl.id;
  }
  applyLiveInfoToUI({
    title: sl.title || '',
    date: sl.date || '',
    slotMinutes: typeof sl.slotMinutes === 'number' ? sl.slotMinutes : 30
  });
  renderSetlistFromData(sl.items || []);
  setlistHistoryEl.value = sl.id || setlistHistoryEl.value;
  lastSetlistSelectValue = setlistHistoryEl.value || '';
  setSetlistDirty(false);
  updateLiveControlsEnabled();
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
  currentLiveId = match.id || '';
  applySetlistToUI(match);
}

async function setCurrentArtistAndSync(name, { skipAutoLoad = false } = {}) {
  currentArtist = (name || '').trim();
  clearSharePreview();
  renderArtistSelect();
  renderSetlistHistory();
  await loadSongsForArtist(currentArtist);
  resetSetlistUI();
  setlistHistoryEl.value = '';
  lastArtistSelectValue = artistSelectEl?.value || '';
  lastSetlistSelectValue = setlistHistoryEl?.value || '';
  saveLocalState();
  updateEmptyPlaceholders();
  setLibraryDirty(false);
  setSetlistDirty(false);
  updateLiveControlsEnabled();
  if (!skipAutoLoad) {
    autoLoadSetlistForCurrentArtist();
  }
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
  const prevLiveId = currentLiveId;
  try {
    cachedSetlists = await window.loadSetlistsForCurrentUser();
  } catch (e) {
    cachedSetlists = [];
  }
  rebuildArtistsFromSetlists();
  renderSetlistHistory();
  const filtered = cachedSetlists.filter(sl => !currentArtist || sl.artist === currentArtist);
  if (prevLiveId && filtered.some(sl => sl.id === prevLiveId)) {
    currentLiveId = prevLiveId;
    setlistHistoryEl.value = prevLiveId;
  }
  await ensureDefaultArtistSelected();
}

// モジュール側から呼べるようにする
window.__refreshSetlistHistory = refreshSetlistHistory;
window.__clearSetlistHistory = () => {
  cachedSetlists = [];
  setlistHistoryEl.innerHTML = '<option value="">ライブ情報を選択…</option>';
  currentLiveId = '';
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

  const artist = (isSharedPreviewMode && sharedPreviewArtist)
    ? sharedPreviewArtist
    : (currentArtist || artistSelectEl?.value || '').trim();

  const items = Array.from(setlistEl.querySelectorAll('.song-item')).map(li => ({
    title: getLiTitleText(li),
    durationSec: parseInt(li.dataset.duration || '0', 10),
    url: li.dataset.url || '',
    sheetUrl: li.dataset.sheetUrl || ''
  })).filter(x => x.title);

  return { title: liveTitle, date: liveDate, slotMinutes, artist, items, liveId: currentLiveId || '' };
}

function buildShareLinkFromCurrentState() {
  const payload = getCurrentSetlistPayload();
  if (!payload.items || payload.items.length === 0) return '';
  const token = encodeShareToken({ v: 1, setlist: payload });
  if (!token) return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('share', token);
  return url.toString();
}

function updateShareLinkUI(message = '') {
  if (!shareLinkField) return;
  const link = buildShareLinkFromCurrentState();
  shareLinkField.value = link;
  if (copyShareLinkBtn) copyShareLinkBtn.disabled = !link;
  if (shareLinkHintEl) {
    if (message) {
      shareLinkHintEl.textContent = message;
    } else {
      shareLinkHintEl.textContent = link
        ? 'リンクをコピーして他のユーザーに共有できます'
        : 'セットリストを作ると共有リンクが生成されます';
    }
  }
}

function applySharedSetlist(payload = {}) {
  isSharedPreviewMode = true;
  sharedPreviewArtist = (payload.artist || '').trim();
  currentLiveId = '';
  document.body?.classList.add('shared-preview');
  setDragAndDropEnabled(false);
  applyLiveInfoToUI({
    title: payload.title || '',
    date: payload.date || '',
    slotMinutes: typeof payload.slotMinutes === 'number' ? payload.slotMinutes : 30
  });
  renderSetlistFromData(payload.items || []);
  if (sharePreviewBannerEl) {
    sharePreviewBannerEl.classList.remove('hidden');
  }
  if (setlistHistoryEl) {
    setlistHistoryEl.value = '';
    lastSetlistSelectValue = '';
  }
  setSetlistDirty(false);
  setLibraryDirty(false);
  updateLiveControlsEnabled();
  updateShareLinkUI();
}

function tryApplySharedSetlistFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('share');
  if (!token) return false;

  const decoded = decodeShareToken(token);
  const payload = decoded?.setlist || decoded?.payload || decoded;
  if (!payload || !Array.isArray(payload.items)) {
    updateShareLinkUI('共有リンクの読み込みに失敗しました');
    return false;
  }
  applySharedSetlist(payload);
  return true;
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
    if (!confirmDiscardChanges()) {
      artistSelectEl.value = lastArtistSelectValue || '';
      return;
    }
    lastArtistSelectValue = artistSelectEl.value || '';
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
      sheetUrl: song.sheetUrl || '',
      artist: song.artist || '',
      enableEdit: false
    });
    setlistEl.appendChild(li);
  });
  removeSetlistEditButtons();
  updateSetlistNumbers();
  recalcTimes();
  saveLocalState();
  setSetlistDirty(false);
}

async function loadSetlistById(id, { shouldAlertOnEmpty = false } = {}) {
  if (!id) {
    if (shouldAlertOnEmpty) alert('読み込むセットを選んでね');
    setlistHistoryEl.value = '';
    lastSetlistSelectValue = '';
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

  currentLiveId = id;
  applySetlistToUI(sl);
  lastSetlistSelectValue = setlistHistoryEl.value || id || '';
  updateLiveControlsEnabled();
}

if (editLiveInfoBtn) {
  editLiveInfoBtn.addEventListener('click', () => openLiveInfoModal('edit'));
}
if (addLiveInfoBtn) {
  addLiveInfoBtn.addEventListener('click', () => openLiveInfoModal('create'));
}

if (saveAllBtn) {
  saveAllBtn.addEventListener('click', async () => {
    const artist = (currentArtist || artistSelectEl?.value || '').trim();
    if (!artist) {
      alert('アーティストを選択してね');
      return;
    }
    if (!window.updateSetlistForCurrentUser) {
      alert('ログインしてから保存してね');
      return;
    }
    if (!currentLiveId) {
      alert('ライブ情報を作成・選択してから保存してね');
      return;
    }

    const setlistPayload = getCurrentSetlistPayload();
    const hasSetlistItems = setlistPayload.items.length > 0;

    try {
      await window.updateSetlistForCurrentUser(currentLiveId, { ...setlistPayload, liveId: currentLiveId });
      const cached = cachedSetlists.find(s => s.id === currentLiveId);
      if (cached) {
        cached.title = setlistPayload.title;
        cached.date = setlistPayload.date;
        cached.slotMinutes = setlistPayload.slotMinutes;
        cached.items = setlistPayload.items;
        cached.artist = setlistPayload.artist;
      } else {
        cachedSetlists.unshift({ id: currentLiveId, ...setlistPayload });
      }
      renderSetlistHistory();
      setlistHistoryEl.value = currentLiveId;
      alert(hasSetlistItems ? 'ライブ情報を保存しました' : 'ライブ情報を保存しました（セットリストは空です）');
      saveLocalState();
      setSetlistDirty(false);
    } catch (e) {
      console.error('保存エラー:', e);
      alert('保存に失敗しました');
    }
  });
}

// セットリストプルダウン変更時に自動で読み込む
setlistHistoryEl.addEventListener('change', async () => {
  if (!confirmDiscardChanges()) {
    setlistHistoryEl.value = lastSetlistSelectValue || '';
    return;
  }
  await loadSetlistById(setlistHistoryEl.value, { shouldAlertOnEmpty: false });
  lastSetlistSelectValue = setlistHistoryEl.value || '';
  updateLiveControlsEnabled();
});

deleteSetlistBtn.addEventListener('click', async () => {
  const id = setlistHistoryEl.value;
  if (!id) return alert('削除するセットを選んでね');

  const sl = cachedSetlists.find(s => s.id === id);
  const name = sl?.title || '無題セット';
  const ok = window.confirm(`「${name}」を本当に削除しますか？`);
  if (!ok) return;

  if (window.deleteSetlistForCurrentUser) {
    try {
      await window.deleteSetlistForCurrentUser(id);
    } catch (e) {
      console.error('delete setlist error:', e);
    }
  }
  cachedSetlists = cachedSetlists.filter(s => s.id !== id);
  alert('削除しました');
  await refreshSetlistHistory();
  currentLiveId = '';
  setlistHistoryEl.value = '';
  autoLoadSetlistForCurrentArtist();
  updateLiveSummaryFromInputs();
  saveLocalState();
});

function exportSetlistToPdf() {
  const payload = getCurrentSetlistPayload();
  if (!payload.items.length) {
    alert('セットリストが空です');
    return;
  }
  const liveTitle = buildAutoLiveTitle(payload.title, payload.date);
  const totalSec = payload.items.reduce((sum, item) => sum + (item.durationSec || 0), 0);
  const dateLabel = payload.date ? payload.date.replace(/-/g, '/') : '未設定';

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title></title>
        <style>
          @page { size: A4; margin: 16mm 14mm; }
          body { font-family: "Helvetica Neue","Arial","Noto Sans JP",sans-serif; margin: 0; color: #1a1a1a; background: #fff; }
          h1 { font-size: 18px; margin: 0 0 6px; letter-spacing: 0.04em; text-transform: uppercase; }
          .meta { color: #4b5563; font-size: 12px; margin: 0 0 12px; }
          ol { margin: 0; padding-left: 0; list-style: none; line-height: 1.2; font-size: 44px; }
          li { margin: 6px 0; font-weight: 700; display: grid; grid-template-columns: 60px 1fr; column-gap: 8px; align-items: flex-start; }
          .num { font-size: 20px; font-weight: 700; color: #9ca3af !important; text-align: right; padding-top: 4px; }
          .title { word-break: break-word; white-space: pre-wrap; }
          .footer { margin-top: 12px; font-size: 10px; color: #6b7280; }
          hr { border: none; border-top: 1px solid #d1d5db; margin: 10px 0 12px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(liveTitle)}</h1>
        <div class="meta">
          日付: ${escapeHtml(dateLabel)} ｜ 持ち時間: ${payload.slotMinutes || 0}分 ｜ 合計: ${formatTime(totalSec)}
        </div>
        <hr />
        <ol>
          ${payload.items.map((item, idx) => `<li><span class="num">${formatSetlistNumber(idx)}</span><span class="title">${escapeHtml(item.title || '')}</span></li>`).join('')}
        </ol>
      </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (!win) {
    alert('ポップアップがブロックされています。許可して再試行してください。');
    return;
  }
  win.document.write(html);
  win.document.close();
  try { win.document.title = ''; } catch (e) { /* no-op */ }
  win.focus();
  setTimeout(() => {
    win.print();
  }, 200);
}

if (exportPdfBtn) {
  exportPdfBtn.addEventListener('click', exportSetlistToPdf);
}

// 音源プレビューモーダル閉じる
document.addEventListener('click', (event) => {
  const dismiss = event.target.closest('[data-dismiss="audio-preview"]');
  if (!dismiss) return;
  closeAudioPreview();
});

// ローカル状態を復元（初期表示用）
loadLocalState();
tryApplySharedSetlistFromUrl();

// 初期計算
recalcTimes();
setLibraryDirty(false);
setSetlistDirty(false);

