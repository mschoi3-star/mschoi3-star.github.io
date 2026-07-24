// 서버/로그인 없이 이 브라우저(기기)에만 데이터를 저장하는 간단한 localStorage 래퍼.
// 다른 기기나 다른 브라우저에서는 데이터가 보이지 않는다.

const KEYS = {
  assignments: "spm_assignments",
  records: "spm_records",
};

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getAssignments() {
  return load(KEYS.assignments);
}

export function setAssignments(data) {
  save(KEYS.assignments, data);
}

export function getRecords() {
  return load(KEYS.records);
}

export function setRecords(data) {
  save(KEYS.records, data);
}

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
