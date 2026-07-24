import { firebaseConfig } from "./firebase-config.js";
import { analyzeCriteria } from "./guidance.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// ---------- State ----------
let currentUser = null;
let unsubscribers = [];
let assignments = [];
let materials = [];
let records = [];
let editingAssignmentId = null;

// ---------- DOM refs ----------
const loginScreen = document.getElementById("login-screen");
const appEl = document.getElementById("app");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");
const userEmailEl = document.getElementById("user-email");
const noticeBanner = document.getElementById("notice-banner");

const statGrid = document.getElementById("stat-grid");
const dashboardList = document.getElementById("dashboard-list");

const assignmentForm = document.getElementById("assignment-form");
const assignmentList = document.getElementById("assignment-list");
const assignmentCancelEdit = document.getElementById("assignment-cancel-edit");

const materialForm = document.getElementById("material-form");
const materialList = document.getElementById("material-list");
const materialAssignmentSelect = document.getElementById("m-assignment");
const materialUploadStatus = document.getElementById("material-upload-status");

const recordForm = document.getElementById("record-form");
const recordList = document.getElementById("record-list");

const guidanceModal = document.getElementById("guidance-modal");
const guidanceContent = document.getElementById("guidance-content");
const guidanceClose = document.getElementById("guidance-close");

// ---------- Auth ----------
loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    loginError.textContent =
      "로그인에 실패했습니다. js/firebase-config.js 설정을 확인하세요. (" + err.code + ")";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];

  if (user) {
    loginScreen.classList.add("hidden");
    appEl.classList.remove("hidden");
    userEmailEl.textContent = user.email || "";
    subscribeAll(user.uid);
  } else {
    appEl.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    assignments = [];
    materials = [];
    records = [];
  }
});

function subscribeAll(uid) {
  const assignmentsQ = query(
    collection(db, "users", uid, "assignments"),
    orderBy("dueDate", "asc")
  );
  unsubscribers.push(
    onSnapshot(assignmentsQ, (snap) => {
      assignments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
    })
  );

  const materialsQ = query(
    collection(db, "users", uid, "materials"),
    orderBy("createdAt", "desc")
  );
  unsubscribers.push(
    onSnapshot(materialsQ, (snap) => {
      materials = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMaterials();
    })
  );

  const recordsQ = query(
    collection(db, "users", uid, "records"),
    orderBy("createdAt", "desc")
  );
  unsubscribers.push(
    onSnapshot(recordsQ, (snap) => {
      records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderRecords();
    })
  );
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
  });
});

// ---------- Date helpers ----------
function dDay(dueDateStr) {
  const due = new Date(dueDateStr + "T23:59:59");
  const now = new Date();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function badgeForDday(diff, done) {
  if (done) return '<span class="badge badge-done">완료</span>';
  if (diff < 0) return `<span class="badge badge-danger">기한 지남</span>`;
  if (diff === 0) return `<span class="badge badge-danger">오늘 마감</span>`;
  if (diff <= 3) return `<span class="badge badge-warning">D-${diff}</span>`;
  return `<span class="badge badge-ok">D-${diff}</span>`;
}

// ---------- Render: everything that depends on assignments ----------
function renderAll() {
  renderNoticeBanner();
  renderDashboard();
  renderAssignments();
  renderMaterialAssignmentOptions();
}

function renderNoticeBanner() {
  const upcoming = assignments
    .filter((a) => !a.done)
    .map((a) => ({ ...a, diff: dDay(a.dueDate) }))
    .filter((a) => a.diff <= 7)
    .sort((a, b) => a.diff - b.diff);

  if (upcoming.length === 0) {
    noticeBanner.classList.add("hidden");
    noticeBanner.innerHTML = "";
    return;
  }

  noticeBanner.classList.remove("hidden");
  noticeBanner.innerHTML =
    `📢 <strong>${upcoming.length}개</strong>의 수행평가 마감이 다가오고 있어요.` +
    `<ul>${upcoming
      .map(
        (a) =>
          `<li><strong>${escapeHtml(a.subject)}</strong> - ${escapeHtml(a.title)} (${
            a.diff < 0 ? "기한 지남" : a.diff === 0 ? "오늘 마감" : "D-" + a.diff
          })</li>`
      )
      .join("")}</ul>`;
}

function renderDashboard() {
  const total = assignments.length;
  const done = assignments.filter((a) => a.done).length;
  const thisWeek = assignments.filter((a) => !a.done && dDay(a.dueDate) <= 7 && dDay(a.dueDate) >= 0).length;

  statGrid.innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="label">전체 수행평가</div></div>
    <div class="stat-card"><div class="num">${thisWeek}</div><div class="label">이번 주 마감</div></div>
    <div class="stat-card"><div class="num">${done}</div><div class="label">완료</div></div>
  `;

  const upcoming = assignments
    .filter((a) => !a.done)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6);

  if (upcoming.length === 0) {
    dashboardList.innerHTML = `<div class="empty-state">등록된 수행평가가 없어요. '수행평가 일정' 탭에서 추가해보세요.</div>`;
    return;
  }

  dashboardList.innerHTML = upcoming.map((a) => assignmentCardHtml(a, false)).join("");
}

function assignmentCardHtml(a, showActions = true) {
  const diff = dDay(a.dueDate);
  return `
    <div class="item-card" data-id="${a.id}">
      <div class="item-main">
        <div class="item-title-row">
          <span class="item-title">${escapeHtml(a.title)}</span>
          ${badgeForDday(diff, a.done)}
        </div>
        <div class="item-subject">${escapeHtml(a.subject)} · 마감 ${a.dueDate}</div>
        ${a.memo ? `<div class="item-meta">${escapeHtml(a.memo)}</div>` : ""}
      </div>
      ${
        showActions
          ? `<div class="item-actions">
              ${a.criteria ? `<button class="btn btn-secondary btn-sm" data-action="guidance">준비 방향</button>` : ""}
              <button class="btn btn-secondary btn-sm" data-action="toggle-done">${a.done ? "완료 취소" : "완료"}</button>
              <button class="btn btn-secondary btn-sm" data-action="edit">수정</button>
              <button class="btn btn-danger btn-sm" data-action="delete">삭제</button>
            </div>`
          : a.criteria
          ? `<div class="item-actions"><button class="btn btn-secondary btn-sm" data-action="guidance">준비 방향</button></div>`
          : ""
      }
    </div>
  `;
}

function renderAssignments() {
  if (assignments.length === 0) {
    assignmentList.innerHTML = `<div class="empty-state">등록된 수행평가가 없어요.</div>`;
    return;
  }
  assignmentList.innerHTML = assignments.map((a) => assignmentCardHtml(a, true)).join("");
}

// event delegation for dashboard + assignment lists
[dashboardList, assignmentList].forEach((listEl) => {
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = e.target.closest(".item-card");
    const id = card.dataset.id;
    const item = assignments.find((a) => a.id === id);
    if (!item) return;

    if (btn.dataset.action === "guidance") openGuidance(item);
    if (btn.dataset.action === "toggle-done") toggleDone(item);
    if (btn.dataset.action === "edit") startEditAssignment(item);
    if (btn.dataset.action === "delete") deleteAssignment(item);
  });
});

function openGuidance(item) {
  const blocks = analyzeCriteria(item.criteria);
  guidanceContent.innerHTML =
    `<p class="muted">"${escapeHtml(item.criteria)}"</p><br/>` +
    blocks
      .map(
        (b) => `
      <div class="guidance-block">
        <h4>${escapeHtml(b.label)}</h4>
        <ul>${b.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>
    `
      )
      .join("");
  guidanceModal.classList.remove("hidden");
}

guidanceClose.addEventListener("click", () => guidanceModal.classList.add("hidden"));
guidanceModal.addEventListener("click", (e) => {
  if (e.target === guidanceModal) guidanceModal.classList.add("hidden");
});

async function toggleDone(item) {
  await updateDoc(doc(db, "users", currentUser.uid, "assignments", item.id), {
    done: !item.done,
  });
}

function startEditAssignment(item) {
  editingAssignmentId = item.id;
  document.getElementById("a-subject").value = item.subject;
  document.getElementById("a-title").value = item.title;
  document.getElementById("a-due").value = item.dueDate;
  document.getElementById("a-criteria").value = item.criteria || "";
  document.getElementById("a-memo").value = item.memo || "";
  assignmentCancelEdit.classList.remove("hidden");
  document.querySelector('[data-tab="schedule"]').click();
  assignmentForm.scrollIntoView({ behavior: "smooth" });
}

assignmentCancelEdit.addEventListener("click", () => {
  editingAssignmentId = null;
  assignmentForm.reset();
  assignmentCancelEdit.classList.add("hidden");
});

async function deleteAssignment(item) {
  if (!confirm(`"${item.title}"을(를) 삭제할까요?`)) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "assignments", item.id));
}

assignmentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    subject: document.getElementById("a-subject").value.trim(),
    title: document.getElementById("a-title").value.trim(),
    dueDate: document.getElementById("a-due").value,
    criteria: document.getElementById("a-criteria").value.trim(),
    memo: document.getElementById("a-memo").value.trim(),
  };

  if (editingAssignmentId) {
    await updateDoc(doc(db, "users", currentUser.uid, "assignments", editingAssignmentId), data);
    editingAssignmentId = null;
    assignmentCancelEdit.classList.add("hidden");
  } else {
    await addDoc(collection(db, "users", currentUser.uid, "assignments"), {
      ...data,
      done: false,
      createdAt: serverTimestamp(),
    });
  }
  assignmentForm.reset();
});

// ---------- Materials ----------
function renderMaterialAssignmentOptions() {
  const current = materialAssignmentSelect.value;
  materialAssignmentSelect.innerHTML =
    `<option value="">(연결 안 함)</option>` +
    assignments
      .map((a) => `<option value="${a.id}">${escapeHtml(a.subject)} - ${escapeHtml(a.title)}</option>`)
      .join("");
  materialAssignmentSelect.value = current || "";
}

function renderMaterials() {
  if (materials.length === 0) {
    materialList.innerHTML = `<div class="empty-state">저장된 자료가 없어요.</div>`;
    return;
  }
  materialList.innerHTML = materials
    .map((m) => {
      const linked = assignments.find((a) => a.id === m.assignmentId);
      return `
      <div class="item-card" data-id="${m.id}">
        <div class="item-main">
          <div class="item-title-row"><span class="item-title">${escapeHtml(m.title)}</span></div>
          ${linked ? `<div class="item-subject">${escapeHtml(linked.subject)} - ${escapeHtml(linked.title)}</div>` : ""}
          ${m.note ? `<div class="item-meta">${escapeHtml(m.note)}</div>` : ""}
          ${m.fileURL ? `<div class="item-meta"><a href="${m.fileURL}" target="_blank" rel="noopener">📎 첨부파일 열기</a></div>` : ""}
        </div>
        <div class="item-actions">
          <button class="btn btn-danger btn-sm" data-action="delete">삭제</button>
        </div>
      </div>
    `;
    })
    .join("");
}

materialList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action='delete']");
  if (!btn) return;
  const card = e.target.closest(".item-card");
  const id = card.dataset.id;
  if (!confirm("이 자료를 삭제할까요?")) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "materials", id));
});

materialForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("m-title").value.trim();
  const assignmentId = materialAssignmentSelect.value;
  const note = document.getElementById("m-note").value.trim();
  const fileInput = document.getElementById("m-file");
  const file = fileInput.files[0];

  let fileURL = null;
  try {
    if (file) {
      materialUploadStatus.textContent = "업로드 중...";
      const fileRef = ref(storage, `users/${currentUser.uid}/materials/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      fileURL = await getDownloadURL(fileRef);
    }

    await addDoc(collection(db, "users", currentUser.uid, "materials"), {
      title,
      assignmentId: assignmentId || null,
      note,
      fileURL,
      createdAt: serverTimestamp(),
    });

    materialUploadStatus.textContent = "";
    materialForm.reset();
  } catch (err) {
    materialUploadStatus.textContent = "저장 실패: " + err.message;
  }
});

// ---------- Records (세특 메모) ----------
function renderRecords() {
  if (records.length === 0) {
    recordList.innerHTML = `<div class="empty-state">저장된 세특 메모가 없어요.</div>`;
    return;
  }
  recordList.innerHTML = records
    .map(
      (r) => `
      <div class="item-card" data-id="${r.id}">
        <div class="item-main">
          <div class="item-title-row"><span class="item-title">${escapeHtml(r.subject)}</span></div>
          <div class="item-meta">${escapeHtml(r.content)}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-danger btn-sm" data-action="delete">삭제</button>
        </div>
      </div>
    `
    )
    .join("");
}

recordList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action='delete']");
  if (!btn) return;
  const card = e.target.closest(".item-card");
  const id = card.dataset.id;
  if (!confirm("이 메모를 삭제할까요?")) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "records", id));
});

recordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const subject = document.getElementById("r-subject").value.trim();
  const content = document.getElementById("r-content").value.trim();

  await addDoc(collection(db, "users", currentUser.uid, "records"), {
    subject,
    content,
    createdAt: serverTimestamp(),
  });
  recordForm.reset();
});

// ---------- Utils ----------
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
