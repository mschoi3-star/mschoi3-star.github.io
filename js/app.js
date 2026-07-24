const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

// ---------- State ----------
let assignments = getAssignments();
let records = getRecords();
let editingAssignmentId = null;
let selectedDate = null; // ISO date string, filters the assignment list
const today = new Date();
let calYear = today.getFullYear();
let calMonth = today.getMonth(); // 0-indexed

// ---------- DOM refs ----------
const noticeBanner = document.getElementById("notice-banner");

const statGrid = document.getElementById("stat-grid");

const assignmentForm = document.getElementById("assignment-form");
const assignmentList = document.getElementById("assignment-list");
const assignmentCancelEdit = document.getElementById("assignment-cancel-edit");
const listHeading = document.getElementById("list-heading");
const clearDateFilterBtn = document.getElementById("clear-date-filter");

const calendarGrid = document.getElementById("calendar-grid");
const calendarLabel = document.getElementById("calendar-label");
const calPrev = document.getElementById("cal-prev");
const calNext = document.getElementById("cal-next");

const recordForm = document.getElementById("record-form");
const recordStatus = document.getElementById("record-status");
const recordGroups = document.getElementById("record-groups");
const filterGrade = document.getElementById("filter-grade");
const filterSemester = document.getElementById("filter-semester");

const guidanceModal = document.getElementById("guidance-modal");
const guidanceContent = document.getElementById("guidance-content");
const guidanceClose = document.getElementById("guidance-close");

// ---------- Date helpers ----------
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
  renderStats();
  renderCalendar();
  renderAssignments();
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

function renderStats() {
  const total = assignments.length;
  const done = assignments.filter((a) => a.done).length;
  const thisWeek = assignments.filter(
    (a) => !a.done && dDay(a.dueDate) <= 7 && dDay(a.dueDate) >= 0
  ).length;

  statGrid.innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="label">전체 수행평가</div></div>
    <div class="stat-card"><div class="num">${thisWeek}</div><div class="label">이번 주 마감</div></div>
    <div class="stat-card"><div class="num">${done}</div><div class="label">완료</div></div>
  `;
}

// ---------- Calendar ----------
function renderCalendar() {
  calendarLabel.textContent = `${calYear}년 ${calMonth + 1}월`;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = toISODate(today);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  calendarGrid.innerHTML = cells
    .map((d) => {
      if (d === null) return `<div class="cal-cell cal-empty"></div>`;
      const dateStr = toISODate(new Date(calYear, calMonth, d));
      const dayAssignments = assignments.filter((a) => a.dueDate === dateStr);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      let urgency = "";
      if (dayAssignments.some((a) => !a.done)) {
        if (dayAssignments.some((a) => !a.done && dDay(a.dueDate) <= 0)) urgency = "danger";
        else if (dayAssignments.some((a) => !a.done && dDay(a.dueDate) <= 3)) urgency = "warning";
        else urgency = "ok";
      }

      return `
        <div class="cal-cell ${isToday ? "cal-today" : ""} ${isSelected ? "cal-selected" : ""}" data-date="${dateStr}">
          <div class="cal-date">${d}</div>
          ${urgency ? `<div class="cal-dot cal-dot-${urgency}"></div>` : ""}
          ${dayAssignments
            .slice(0, 2)
            .map((a) => `<div class="cal-item">${escapeHtml(a.title)}</div>`)
            .join("")}
          ${dayAssignments.length > 2 ? `<div class="cal-more">+${dayAssignments.length - 2}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

calendarGrid.addEventListener("click", (e) => {
  const cell = e.target.closest(".cal-cell[data-date]");
  if (!cell) return;
  const dateStr = cell.dataset.date;
  selectedDate = selectedDate === dateStr ? null : dateStr;
  renderCalendar();
  renderAssignments();
});

calPrev.addEventListener("click", () => {
  calMonth -= 1;
  if (calMonth < 0) {
    calMonth = 11;
    calYear -= 1;
  }
  renderCalendar();
});

calNext.addEventListener("click", () => {
  calMonth += 1;
  if (calMonth > 11) {
    calMonth = 0;
    calYear += 1;
  }
  renderCalendar();
});

clearDateFilterBtn.addEventListener("click", () => {
  selectedDate = null;
  renderCalendar();
  renderAssignments();
});

// ---------- Assignment list ----------
function assignmentCardHtml(a) {
  const diff = dDay(a.dueDate);
  return `
    <div class="item-card ${a.criteria ? "item-card-clickable" : ""}" data-id="${a.id}">
      <div class="item-main" data-action="guidance">
        <div class="item-title-row">
          <span class="item-title">${escapeHtml(a.title)}</span>
          ${badgeForDday(diff, a.done)}
        </div>
        <div class="item-subject">${escapeHtml(a.subject)} · 마감 ${a.dueDate}</div>
        ${a.memo ? `<div class="item-meta">${escapeHtml(a.memo)}</div>` : ""}
        ${a.criteria ? `<div class="item-hint">📌 클릭하면 준비 방향을 볼 수 있어요</div>` : ""}
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="toggle-done">${a.done ? "완료 취소" : "완료"}</button>
        <button class="btn btn-secondary btn-sm" data-action="edit">수정</button>
        <button class="btn btn-danger btn-sm" data-action="delete">삭제</button>
      </div>
    </div>
  `;
}

function renderAssignments() {
  let list = [...assignments];
  if (selectedDate) {
    list = list.filter((a) => a.dueDate === selectedDate);
    listHeading.textContent = `${selectedDate} 마감 수행평가`;
    clearDateFilterBtn.classList.remove("hidden");
  } else {
    listHeading.textContent = "전체 수행평가";
    clearDateFilterBtn.classList.add("hidden");
  }

  if (list.length === 0) {
    assignmentList.innerHTML = `<div class="empty-state">${
      selectedDate ? "이 날짜에 등록된 수행평가가 없어요." : "등록된 수행평가가 없어요. 오른쪽 양식으로 추가해보세요."
    }</div>`;
    return;
  }
  const sorted = list.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  assignmentList.innerHTML = sorted.map(assignmentCardHtml).join("");
}

assignmentList.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const card = e.target.closest(".item-card");
  const id = card.dataset.id;
  const item = assignments.find((a) => a.id === id);
  if (!item) return;

  const action = actionEl.dataset.action;
  if (action === "guidance") {
    if (item.criteria) openGuidanceModal(item);
  }
  if (action === "toggle-done") toggleDone(item);
  if (action === "edit") startEditAssignment(item);
  if (action === "delete") deleteAssignment(item);
});

function guidanceBlocksHtml(item) {
  const blocks = analyzeCriteria(item.criteria, item.title);
  const header = `
    <div class="guidance-head">
      <div class="guidance-head-title">${escapeHtml(item.subject)} · ${escapeHtml(item.title)}</div>
      ${item.criteria ? `<div class="guidance-head-criteria">평가기준: ${escapeHtml(item.criteria)}</div>` : ""}
    </div>`;

  const body = blocks
    .map((b) => {
      const examplesHtml =
        b.examples && b.examples.length
          ? `<div class="guidance-examples">
               <div class="guidance-examples-label">이렇게 써보세요</div>
               <ul>${b.examples.map((ex) => `<li>${escapeHtml(ex)}</li>`).join("")}</ul>
             </div>`
          : "";
      return `
        <div class="guidance-block ${b.isFramework ? "guidance-block-framework" : ""}">
          <h4>${escapeHtml(b.label)}</h4>
          <ul>${b.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
          ${examplesHtml}
        </div>`;
    })
    .join("");

  return header + body;
}

function openGuidanceModal(item) {
  guidanceContent.innerHTML = guidanceBlocksHtml(item);
  guidanceModal.classList.remove("hidden");
}

guidanceClose.addEventListener("click", () => guidanceModal.classList.add("hidden"));
guidanceModal.addEventListener("click", (e) => {
  if (e.target === guidanceModal) guidanceModal.classList.add("hidden");
});

function toggleDone(item) {
  item.done = !item.done;
  persistAssignments();
}

function startEditAssignment(item) {
  editingAssignmentId = item.id;
  document.getElementById("a-subject").value = item.subject;
  document.getElementById("a-title").value = item.title;
  document.getElementById("a-due").value = item.dueDate;
  document.getElementById("a-criteria").value = item.criteria || "";
  document.getElementById("a-memo").value = item.memo || "";
  assignmentCancelEdit.classList.remove("hidden");
  assignmentForm.scrollIntoView({ behavior: "smooth" });
}

assignmentCancelEdit.addEventListener("click", () => {
  editingAssignmentId = null;
  assignmentForm.reset();
  assignmentCancelEdit.classList.add("hidden");
});

function deleteAssignment(item) {
  if (!confirm(`"${item.title}"을(를) 삭제할까요?`)) return;
  assignments = assignments.filter((a) => a.id !== item.id);
  persistAssignments();
}

function persistAssignments() {
  setAssignments(assignments);
  renderAll();
}

assignmentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    subject: document.getElementById("a-subject").value.trim(),
    title: document.getElementById("a-title").value.trim(),
    dueDate: document.getElementById("a-due").value,
    criteria: document.getElementById("a-criteria").value.trim(),
    memo: document.getElementById("a-memo").value.trim(),
  };

  if (editingAssignmentId) {
    const target = assignments.find((a) => a.id === editingAssignmentId);
    Object.assign(target, data);
    editingAssignmentId = null;
    assignmentCancelEdit.classList.add("hidden");
  } else {
    assignments.push({
      id: makeId(),
      ...data,
      done: false,
      createdAt: Date.now(),
    });
  }

  // 방금 등록한 수행평가가 보이도록 캘린더를 해당 월로 이동
  if (data.dueDate) {
    const due = new Date(data.dueDate);
    calYear = due.getFullYear();
    calMonth = due.getMonth();
    selectedDate = data.dueDate;
  }

  assignmentForm.reset();
  persistAssignments();
});

// ---------- 세특 기록 ----------
const GRADE_LABEL = { 1: "1학년", 2: "2학년", 3: "3학년" };
const SEMESTER_LABEL = { 1: "1학기", 2: "2학기" };

function persistRecords() {
  setRecords(records);
  renderRecords();
}

function recordCardHtml(r) {
  return `
    <div class="item-card" data-id="${r.id}">
      <div class="item-main">
        <div class="item-title-row">
          <span class="item-title">${escapeHtml(r.fileName || "메모")}</span>
        </div>
        ${r.content ? `<div class="item-meta">${escapeHtml(r.content)}</div>` : ""}
        ${
          r.fileName
            ? `<div class="item-meta"><a href="${r.fileData}" download="${escapeHtml(r.fileName)}">📎 ${escapeHtml(r.fileName)}</a></div>`
            : ""
        }
      </div>
      <div class="item-actions">
        <button class="btn btn-danger btn-sm" data-action="delete">삭제</button>
      </div>
    </div>
  `;
}

function renderRecords() {
  const gradeFilter = filterGrade.value;
  const semesterFilter = filterSemester.value;

  const filtered = records.filter(
    (r) =>
      (gradeFilter === "all" || String(r.grade) === gradeFilter) &&
      (semesterFilter === "all" || String(r.semester) === semesterFilter)
  );

  if (filtered.length === 0) {
    recordGroups.innerHTML = `<div class="empty-state">저장된 세특 자료가 없어요.</div>`;
    return;
  }

  const groups = {};
  filtered.forEach((r) => {
    const key = `${r.grade}-${r.semester}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const [ag, as] = a.split("-").map(Number);
    const [bg, bs] = b.split("-").map(Number);
    return ag - bg || as - bs;
  });

  recordGroups.innerHTML = sortedKeys
    .map((key) => {
      const [grade, semester] = key.split("-");
      const items = [...groups[key]].sort((a, b) => b.createdAt - a.createdAt);
      return `
        <h3 class="sub-title">${GRADE_LABEL[grade]} ${SEMESTER_LABEL[semester]}</h3>
        <div class="list">${items.map(recordCardHtml).join("")}</div>
      `;
    })
    .join("");
}

recordGroups.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='delete']");
  if (!btn) return;
  const card = e.target.closest(".item-card");
  const id = card.dataset.id;
  if (!confirm("이 자료를 삭제할까요?")) return;
  records = records.filter((r) => r.id !== id);
  persistRecords();
});

filterGrade.addEventListener("change", renderRecords);
filterSemester.addEventListener("change", renderRecords);

recordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const grade = document.getElementById("r-grade").value;
  const semester = document.getElementById("r-semester").value;
  const content = document.getElementById("r-content").value.trim();
  const fileInput = document.getElementById("r-file");
  const file = fileInput.files[0];

  let fileData = null;
  let fileName = null;

  if (file) {
    if (file.size > MAX_FILE_SIZE) {
      recordStatus.textContent = "파일이 너무 커요 (3MB 이하만 첨부 가능).";
      return;
    }
    try {
      fileData = await readFileAsDataURL(file);
      fileName = file.name;
    } catch {
      recordStatus.textContent = "파일을 읽는 중 오류가 발생했어요.";
      return;
    }
  }

  if (!file && !content) {
    recordStatus.textContent = "파일을 첨부하거나 메모를 입력해주세요.";
    return;
  }

  records.push({
    id: makeId(),
    grade,
    semester,
    content,
    fileData,
    fileName,
    createdAt: Date.now(),
  });

  recordStatus.textContent = "";
  recordForm.reset();
  persistRecords();
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

// ---------- Init ----------
renderAll();
renderRecords();
