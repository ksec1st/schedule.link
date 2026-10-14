
const API_URL = "https://script.google.com/macros/s/AKfycbyXkUUA8TlCjqENs2PD2tP2xK__lZo07jBFO8S4tYfaz8hmsTFvy8LBpcb0RDGWCvKw4g/exec";

let currentDate = new Date();
let events = [];
let categories = [];
let groupedEvents = [];

document.addEventListener("DOMContentLoaded", loadData);

/* =========================================
   API
========================================= */

async function apiGet(action) {
  const response = await fetch(
    API_URL + "?action=" + encodeURIComponent(action)
  );

  if (!response.ok) {
    throw new Error("データを取得できませんでした。");
  }

  const result = await response.json();

  if (!Array.isArray(result)) {
    throw new Error(result.message || "取得に失敗しました。");
  }

  return result;
}

async function loadData() {
  loading(true);

  try {
    [events, categories] = await Promise.all([
      apiGet("getEvents"),
      apiGet("getCategories")
    ]);

    groupedEvents = groupEvents(events);

    renderCalendar();
    renderLegend();
  } catch (error) {
    console.error(error);
    alert(
      "スケジュールの読み込みに失敗しました。Apps ScriptのURLを確認してください。"
    );
  } finally {
    loading(false);
  }
}

/* =========================================
   日付をまとめて期間にする
   同じ予定名・カテゴリ・内容で、
   日付が連続しているものを1つにまとめる
========================================= */

function groupEvents(sourceEvents) {
  const groups = new Map();

  sourceEvents.forEach((event) => {
    if (!event.date || !event.title) return;

    const key = JSON.stringify([
      event.title,
      event.category || "",
      event.description || ""
    ]);

    if (!groups.has(key)) {
      groups.set(key, {
        title: event.title,
        category: event.category || "",
        description: event.description || "",
        dates: [],
        ids: []
      });
    }

    const group = groups.get(key);
    group.dates.push(event.date);
    group.ids.push(event.id);
  });

  const result = [];

  groups.forEach((group) => {
    const dates = [...new Set(group.dates)].sort();

    if (!dates.length) return;

    let startDate = dates[0];
    let previousDate = dates[0];

    for (let i = 1; i <= dates.length; i++) {
      const nextDate = dates[i];

      if (
        nextDate &&
        nextDate === addDays(previousDate, 1)
      ) {
        previousDate = nextDate;
        continue;
      }

      result.push({
        id: group.ids[0],
        title: group.title,
        category: group.category,
        description: group.description,
        date: startDate,
        endDate: previousDate
      });

      if (nextDate) {
        startDate = nextDate;
        previousDate = nextDate;
      }
    }
  });

  return result.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.title.localeCompare(b.title, "ja")
  );
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/* =========================================
   カレンダー描画
========================================= */

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  document.getElementById("monthTitle").textContent =
    `${year}年${month + 1}月`;

  const grid = document.getElementById("calendarDays");
  grid.innerHTML = "";

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const previousLast = new Date(year, month, 0).getDate();
  const count = Math.ceil((firstDay + lastDate) / 7) * 7;

  const calendarDates = [];

  for (let i = 0; i < count; i++) {
    let day;
    let y = year;
    let m = month;
    let other = false;

    if (i < firstDay) {
      day = previousLast - firstDay + i + 1;
      m--;

      if (m < 0) {
        m = 11;
        y--;
      }

      other = true;
    } else if (i >= firstDay + lastDate) {
      day = i - firstDay - lastDate + 1;
      m++;

      if (m > 11) {
        m = 0;
        y++;
      }

      other = true;
    } else {
      day = i - firstDay + 1;
    }

    calendarDates.push({
      date: dateString(y, m, day),
      day,
      other
    });
  }

  // 1週間ずつ描画する
  for (let i = 0; i < calendarDates.length; i += 7) {
    const week = calendarDates.slice(i, i + 7);
    renderWeek(grid, week);
  }
}

function renderWeek(parent, week) {
  const weekElement = document.createElement("div");
  weekElement.className = "calendar-week";

  const weekStart = week[0].date;
  const weekEnd = week[6].date;

  // この週に重なる期間予定を抽出
  const overlappingEvents = groupedEvents.filter((event) =>
    event.date <= weekEnd && event.endDate >= weekStart
  );

  // 週内で予定が重ならないようにレーンを割り当てる
  const lanes = [];

  const segments = overlappingEvents.map((event) => {
    const startDate = event.date > weekStart ? event.date : weekStart;
    const endDate = event.endDate < weekEnd ? event.endDate : weekEnd;

    const startIndex = week.findIndex(
      (day) => day.date === startDate
    );

    const endIndex = week.findIndex(
      (day) => day.date === endDate
    );

    return {
      event,
      startIndex,
      endIndex,
      continuesBefore: event.date < weekStart,
      continuesAfter: event.endDate > weekEnd
    };
  }).sort((a, b) =>
    a.startIndex - b.startIndex ||
    b.endIndex - a.endIndex
  );

  segments.forEach((segment) => {
    let laneIndex = 0;

    while (true) {
      if (!lanes[laneIndex]) {
        lanes[laneIndex] = [];
      }

      const overlaps = lanes[laneIndex].some((occupied) =>
        segment.startIndex <= occupied.endIndex &&
        segment.endIndex >= occupied.startIndex
      );

      if (!overlaps) break;
      laneIndex++;
    }

    lanes[laneIndex].push({
      startIndex: segment.startIndex,
      endIndex: segment.endIndex
    });

    segment.laneIndex = laneIndex;
  });

  // 日付セル
  week.forEach((dayInfo, index) => {
    const cell = document.createElement("div");

    cell.className =
      "calendar-day" +
      (dayInfo.other ? " other-month" : "");

    cell.style.gridColumn = String(index + 1);

    if (dayInfo.date === todayString()) {
      cell.classList.add("today");
    }

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = dayInfo.day;

    cell.appendChild(number);
    weekElement.appendChild(cell);
  });

  // 期間予定を重ねて描画
  const eventLayer = document.createElement("div");
  eventLayer.className = "week-events";
  eventLayer.style.setProperty(
    "--lane-count",
    String(Math.max(lanes.length, 1))
  );

  segments.forEach((segment) => {
    const event = segment.event;
    const category = categories.find(
      (item) => item.name === event.category
    );

    const color = category ? category.color : "#64748B";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "event";

    button.style.gridColumn =
      `${segment.startIndex + 1} / ${segment.endIndex + 2}`;

    button.style.gridRow = String(segment.laneIndex + 1);
    button.style.setProperty("--event-color", color);
    button.style.setProperty("--event-bg", hexToBg(color));

    if (segment.continuesBefore) {
      button.classList.add("continues-before");
    }

    if (segment.continuesAfter) {
      button.classList.add("continues-after");
    }

    button.textContent = event.title;
    button.title =
      `${event.title}（${formatDate(event.date)}〜${formatDate(event.endDate)}）`;

    button.addEventListener("click", () => openDetail(event));

    eventLayer.appendChild(button);
  });

  weekElement.appendChild(eventLayer);

  // 予定の本数に応じて週の高さを調整
  const extraHeight = Math.max(lanes.length, 1) * 28;

  weekElement.style.setProperty(
    "--extra-height",
    `${extraHeight}px`
  );

  parent.appendChild(weekElement);
}

/* =========================================
   カテゴリ凡例
========================================= */

function renderLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  categories.forEach((category) => {
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

/* =========================================
   予定詳細
========================================= */

function openDetail(event) {
  document.getElementById("detailTitle").textContent =
    event.title;

  const start = formatDate(event.date);
  const end = formatDate(event.endDate);

  document.getElementById("detailDate").textContent =
    event.date === event.endDate
      ? start
      : `${start} 〜 ${end}`;

  const category = categories.find(
    (item) => item.name === event.category
  );

  const color = category ? category.color : "#64748B";
  const badge = document.getElementById("detailCategory");

  badge.textContent = event.category || "その他";
  badge.style.backgroundColor = hexToBg(color);
  badge.style.color = color;

  document.getElementById("detailDescription").textContent =
    event.description || "詳細情報はありません。";

  document.getElementById("detailModal").classList.add("active");
}

function closeDetail() {
  document.getElementById("detailModal").classList.remove("active");
}

/* =========================================
   月移動
========================================= */

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

/* =========================================
   共通ユーティリティ
========================================= */

function dateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayString() {
  const date = new Date();

  return dateString(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function formatDate(value) {
  const [year, month, day] = value.split("-");

  return `${year}年${Number(month)}月${Number(day)}日`;
}

function hexToBg(hex) {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(hex)
    ? hex
    : "#64748B";

  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function loading(show) {
  document.getElementById("loading")
    .classList.toggle("active", show);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetail();
  }
});
