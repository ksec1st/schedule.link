
const API_URL = "https://script.google.com/macros/s/AKfycbyXkUUA8TlCjqENs2PD2tP2xK__lZo07jBFO8S4tYfaz8hmsTFvy8LBpcb0RDGWCvKw4g/exec";

let currentDate = new Date();
let events = [];
let categories = [];

document.addEventListener("DOMContentLoaded", loadData);

async function apiGet(action) {
  const response = await fetch(
    API_URL + "?action=" + encodeURIComponent(action)
  );
  if (!response.ok) throw new Error("データを取得できませんでした。");
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error(result.message || "取得に失敗しました。");
  return result;
}

async function loadData() {
  loading(true);
  try {
    [events, categories] = await Promise.all([
      apiGet("getEvents"),
      apiGet("getCategories")
    ]);
    renderCalendar();
    renderLegend();
  } catch (e) {
    console.error(e);
    alert("スケジュールの読み込みに失敗しました。Apps ScriptのURLを確認してください。");
  } finally {
    loading(false);
  }
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  document.getElementById("monthTitle").textContent = `${year}年${month + 1}月`;

  const grid = document.getElementById("calendarDays");
  grid.innerHTML = "";

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const previousLast = new Date(year, month, 0).getDate();
  const count = Math.ceil((firstDay + lastDate) / 7) * 7;

  for (let i = 0; i < count; i++) {
    let day, y = year, m = month, other = false;

    if (i < firstDay) {
      day = previousLast - firstDay + i + 1;
      m--;
      if (m < 0) { m = 11; y--; }
      other = true;
    } else if (i >= firstDay + lastDate) {
      day = i - firstDay - lastDate + 1;
      m++;
      if (m > 11) { m = 0; y++; }
      other = true;
    } else {
      day = i - firstDay + 1;
    }

    const date = dateString(y, m, day);
    const cell = document.createElement("div");
    cell.className = "calendar-day" + (other ? " other-month" : "");
    if (date === todayString()) cell.classList.add("today");

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    events.filter(e => e.date === date).forEach(event => {
      const category = categories.find(c => c.name === event.category);
      const color = category ? category.color : "#64748B";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "event";
      button.style.setProperty("--event-color", color);
      button.style.setProperty("--event-bg", hexToBg(color));
      button.textContent = event.title;
      button.title = event.title;
      button.onclick = () => openDetail(event);
      cell.appendChild(button);
    });

    grid.appendChild(cell);
  }
}

function renderLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  categories.forEach(category => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.backgroundColor = category.color;

    const label = document.createElement("span");
    label.textContent = category.name;

    item.append(dot, label);
    legend.appendChild(item);
  });
}

function openDetail(event) {
  document.getElementById("detailTitle").textContent = event.title;
  document.getElementById("detailDate").textContent =
    formatDate(event.date);

  const category = categories.find(c => c.name === event.category);
  const badge = document.getElementById("detailCategory");
  badge.textContent = event.category || "その他";
  badge.style.backgroundColor = hexToBg(category ? category.color : "#64748B");
  badge.style.color = category ? category.color : "#64748B";

  document.getElementById("detailDescription").textContent =
    event.description || "詳細情報はありません。";

  document.getElementById("detailModal").classList.add("active");
}

function closeDetail() {
  document.getElementById("detailModal").classList.remove("active");
}

function changeMonth(amount) {
  currentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + amount,
    1
  );
  renderCalendar();
}

function goToday() {
  currentDate = new Date();
  renderCalendar();
}

function dateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayString() {
  const d = new Date();
  return dateString(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(value) {
  const [y, m, d] = value.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function hexToBg(hex) {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#64748B";
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function loading(show) {
  document.getElementById("loading").classList.toggle("active", show);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeDetail();
});
