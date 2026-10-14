/* ==================================================
   KSEC 1st スケジュール管理
   期間単位の表示・編集・削除対応
================================================== */

const API_URL =
  "https://script.google.com/macros/s/AKfycbyXkUUA8TlCjqENs2PD2tP2xK__lZo07jBFO8S4tYfaz8hmsTFvy8LBpcb0RDGWCvKw4g/exec";

let password = "";
let events = [];
let categories = [];

/* ==================================================
   共通処理
================================================== */

const $ = id => document.getElementById(id);

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("サーバーからの返答:", text);

    throw new Error(
      "サーバーの返答を読み取れません。API_URLとApps Scriptのデプロイを確認してください。"
    );
  }
}

async function apiGet(action) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);

  const response = await fetch(url.toString());
  const result = await readJson(response);

  if (!response.ok || !Array.isArray(result)) {
    throw new Error(
      result.message || "データを取得できませんでした。"
    );
  }

  return result;
}

async function apiPost(action, data = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      password,
      ...data
    })
  });

  const result = await readJson(response);

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || "処理に失敗しました。"
    );
  }

  return result;
}

function showMessage(id, message, isError = false) {
  const element = $(id);

  element.textContent = message;
  element.classList.toggle("error", isError);
  element.classList.toggle(
    "success",
    !isError && !!message
  );
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${year}/${month}/${day}`;
}

function todayString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

/* ==================================================
   期間の日付を生成
================================================== */

function getDatesBetween(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error("開始日と終了日を選択してください。");
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== startDate ||
    end.toISOString().slice(0, 10) !== endDate
  ) {
    throw new Error("日付の指定が正しくありません。");
  }

  if (start > end) {
    throw new Error(
      "終了日は開始日以降の日付にしてください。"
    );
  }

  const oneDay = 24 * 60 * 60 * 1000;
  const dayCount =
    Math.round((end.getTime() - start.getTime()) / oneDay) + 1;

  if (dayCount > 366) {
    throw new Error(
      "一度に登録できる期間は366日以内です。"
    );
  }

  const dates = [];

  for (let i = 0; i < dayCount; i++) {
    const date = new Date(start.getTime() + i * oneDay);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function updatePeriodPreview() {
  const start = $("startDate").value;
  const end = $("endDate").value;

  if (!start || !end) {
    $("periodPreview").textContent =
      "開始日と終了日を選択してください。";
    return;
  }

  try {
    const dates = getDatesBetween(start, end);

    $("periodPreview").textContent =
      `${formatDate(start)}〜${formatDate(end)} / ` +
      `${dates.length}日分の予定を登録します。`;
  } catch (error) {
    $("periodPreview").textContent = error.message;
  }
}

/* ==================================================
   期間予定をグループ化
================================================== */

function groupEventsByPeriod(sourceEvents) {
  const groups = new Map();

  sourceEvents.forEach(item => {
    /*
      新しい予定はgroupIdでまとめる。
      既存予定は予定名・カテゴリ・内容が一致する
      連続日付をまとめる。
    */
    const key = item.groupId
      ? `group:${item.groupId}`
      : `legacy:${JSON.stringify([
          item.title,
          item.category,
          item.description || ""
        ])}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  });

  const result = [];

  groups.forEach((items, key) => {
    items.sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    let current = [];

    function pushRange() {
      if (!current.length) return;

      result.push({
        key: `${key}:${current[0].id}`,
        ids: current.map(item => item.id),
        startDate: current[0].date,
        endDate: current[current.length - 1].date,
        title: current[0].title,
        category: current[0].category,
        description: current[0].description || "",
        groupId: current[0].groupId || ""
      });

      current = [];
    }

    items.forEach(item => {
      if (!current.length) {
        current.push(item);
        return;
      }

      const previous = current[current.length - 1];

      const next = new Date(`${previous.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);

      const nextDate = next.toISOString().slice(0, 10);

      const sameGroup =
        item.groupId &&
        item.groupId === previous.groupId;

      if (item.date === nextDate || sameGroup) {
        current.push(item);
      } else {
        pushRange();
        current.push(item);
      }
    });

    pushRange();
  });

  return result.sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );
}

/* ==================================================
   ログイン
================================================== */

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const inputPassword = $("loginPassword").value;

  showMessage("loginMessage", "確認しています...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "verifyPassword",
        password: inputPassword
      })
    });

    const result = await readJson(response);

    if (!response.ok || result.success !== true) {
      throw new Error("パスワードが正しくありません。");
    }

    password = inputPassword;

    $("loginPanel").hidden = true;
    $("adminApp").hidden = false;

    await refreshAll();
  } catch (error) {
    showMessage(
      "loginMessage",
      error.message || "ログインできませんでした。",
      true
    );
  }
});

$("logoutButton").addEventListener("click", () => {
  password = "";
  $("loginPassword").value = "";

  $("adminApp").hidden = true;
  $("loginPanel").hidden = false;

  resetScheduleForm();
  resetCategoryForm();

  showMessage("loginMessage", "");
});

/* ==================================================
   データ読み込み
================================================== */

async function refreshAll() {
  try {
    const [eventData, categoryData] = await Promise.all([
      apiGet("getEvents"),
      apiGet("getCategories")
    ]);

    events = eventData;
    categories = categoryData;

    renderCategoryOptions();
    renderEvents();
    renderCategories();
  } catch (error) {
    showMessage(
      "scheduleMessage",
      error.message || "データを読み込めませんでした。",
      true
    );
  }
}

/* ==================================================
   カテゴリ選択肢
================================================== */

function renderCategoryOptions() {
  const select = $("eventCategory");
  const selectedValue = select.value;

  select.innerHTML =
    '<option value="">カテゴリを選択</option>';

  categories.forEach(category => {
    const option = document.createElement("option");

    option.value = category.name;
    option.textContent = category.name;

    select.appendChild(option);
  });

  if (categories.some(
    category => category.name === selectedValue
  )) {
    select.value = selectedValue;
  }
}

/* ==================================================
   日程登録・期間編集
================================================== */

$("startDate").addEventListener(
  "change",
  updatePeriodPreview
);

$("endDate").addEventListener(
  "change",
  updatePeriodPreview
);

$("scheduleForm").addEventListener("submit", async event => {
  event.preventDefault();

  const editingValue = $("editingEventId").value;
  const startDate = $("startDate").value;
  const endDate = $("endDate").value;
  const title = $("eventTitle").value.trim();
  const category = $("eventCategory").value;
  const description = $("eventDescription").value.trim();

  try {
    if (!title) {
      throw new Error("予定名を入力してください。");
    }

    if (!category) {
      throw new Error("カテゴリを選択してください。");
    }

    const dates = getDatesBetween(startDate, endDate);

    if (editingValue) {
      const ids = JSON.parse(editingValue);

      await apiPost("updateEvent", {
        ids,
        dates,
        title,
        category,
        description
      });

      showMessage(
        "scheduleMessage",
        "期間の予定を更新しました。"
      );
    } else {
      await apiPost("addEvents", {
        dates,
        title,
        category,
        description
      });

      showMessage(
        "scheduleMessage",
        `${formatDate(startDate)}〜${formatDate(endDate)}の予定を登録しました。`
      );
    }

    resetScheduleForm();
    await refreshAll();
  } catch (error) {
    showMessage(
      "scheduleMessage",
      error.message || "予定を保存できませんでした。",
      true
    );
  }
});

function resetScheduleForm() {
  $("scheduleForm").reset();

  $("editingEventId").value = "";
  $("scheduleFormHeading").textContent = "日程設定";
  $("saveEventButton").textContent = "期間を指定して登録";
  $("cancelEditButton").hidden = true;

  $("startDate").value = todayString();
  $("endDate").value = todayString();

  updatePeriodPreview();
}

$("cancelEditButton").addEventListener("click", () => {
  resetScheduleForm();
  showMessage("scheduleMessage", "");
});

/* ==================================================
   登録済み予定一覧
   期間単位で1件ずつ表示
================================================== */

function renderEvents() {
  const container = $("eventList");
  const periodEvents = groupEventsByPeriod(events);

  if (!periodEvents.length) {
    container.textContent =
      "登録されている予定はありません。";
    return;
  }

  container.innerHTML = periodEvents.map(item => {
    const category = categories.find(
      entry => entry.name === item.category
    );

    const color = category?.color || "#64748B";

    const periodLabel = item.startDate === item.endDate
      ? formatDate(item.startDate)
      : `${formatDate(item.startDate)}〜${formatDate(item.endDate)}`;

    return `
      <article class="event-item">
        <div class="event-item-main">
          <div class="event-date">
            ${escapeHTML(periodLabel)}
          </div>

          <div class="event-title">
            ${escapeHTML(item.title)}
          </div>

          <span
            class="event-category"
            style="--category-color:${escapeHTML(color)}"
          >${escapeHTML(item.category)}</span>

          ${
            item.description
              ? `<p class="event-description">${escapeHTML(item.description)}</p>`
              : ""
          }
        </div>

        <div class="event-actions">
          <button
            type="button"
            class="secondary-button"
            data-action="edit"
            data-key="${escapeHTML(item.key)}"
          >編集</button>

          <button
            type="button"
            class="danger-button"
            data-action="delete"
            data-key="${escapeHTML(item.key)}"
          >削除</button>
        </div>
      </article>
    `;
  }).join("");
}

/* ==================================================
   期間予定の編集・削除
================================================== */

$("eventList").addEventListener("click", async event => {
  const button = event.target.closest(
    "button[data-action]"
  );

  if (!button) return;

  const item = groupEventsByPeriod(events).find(
    entry => entry.key === button.dataset.key
  );

  if (!item) return;

  if (button.dataset.action === "edit") {
    // 期間に含まれるすべての行IDを保持
    $("editingEventId").value =
      JSON.stringify(item.ids);

    $("startDate").value = item.startDate;
    $("endDate").value = item.endDate;
    $("eventTitle").value = item.title;
    $("eventCategory").value = item.category;
    $("eventDescription").value =
      item.description || "";

    $("scheduleFormHeading").textContent = "期間を編集";
    $("saveEventButton").textContent = "変更を保存";
    $("cancelEditButton").hidden = false;

    updatePeriodPreview();

    $("scheduleFormHeading").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    showMessage("scheduleMessage", "");
    return;
  }

  if (button.dataset.action === "delete") {
    const periodLabel = item.startDate === item.endDate
      ? formatDate(item.startDate)
      : `${formatDate(item.startDate)}〜${formatDate(item.endDate)}`;

    const confirmed = confirm(
      `次の予定を期間ごと削除しますか？\n\n` +
      `${periodLabel}\n` +
      `${item.title}\n\n` +
      `期間内の${item.ids.length}日分が削除されます。`
    );

    if (!confirmed) return;

    try {
      await apiPost("deleteEvent", {
        ids: item.ids
      });

      showMessage(
        "scheduleMessage",
        "期間の予定をまとめて削除しました。"
      );

      await refreshAll();
    } catch (error) {
      showMessage(
        "scheduleMessage",
        error.message || "予定を削除できませんでした。",
        true
      );
    }
  }
});

/* ==================================================
   カテゴリ管理
================================================== */

$("categoryColor").addEventListener("input", () => {
  $("categoryColorCode").textContent =
    $("categoryColor").value.toUpperCase();
});

$("categoryForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("editingCategoryId").value;
  const name = $("categoryName").value.trim();
  const color = $("categoryColor").value.toUpperCase();

  try {
    if (!name) {
      throw new Error("カテゴリ名を入力してください。");
    }

    if (id) {
      await apiPost("updateCategory", {
        id,
        name,
        color
      });

      showMessage(
        "categoryMessage",
        "カテゴリを更新しました。"
      );
    } else {
      await apiPost("addCategory", {
        name,
        color
      });

      showMessage(
        "categoryMessage",
        "カテゴリを追加しました。"
      );
    }

    resetCategoryForm();
    await refreshAll();
  } catch (error) {
    showMessage(
      "categoryMessage",
      error.message || "カテゴリを保存できませんでした。",
      true
    );
  }
});

function resetCategoryForm() {
  $("categoryForm").reset();

  $("editingCategoryId").value = "";
  $("categoryColor").value = "#2774E6";
  $("categoryColorCode").textContent = "#2774E6";
  $("saveCategoryButton").textContent = "カテゴリを追加";
  $("cancelCategoryEditButton").hidden = true;
}

$("cancelCategoryEditButton").addEventListener(
  "click",
  () => {
    resetCategoryForm();
    showMessage("categoryMessage", "");
  }
);

function renderCategories() {
  const container = $("categoryList");

  if (!categories.length) {
    container.textContent = "カテゴリがありません。";
    return;
  }

  container.innerHTML = categories.map(category => `
    <article class="category-item">
      <div class="category-info">
        <span
          class="category-color-dot"
          style="background:${escapeHTML(category.color)}"
        ></span>

        <span>${escapeHTML(category.name)}</span>

        <code>${escapeHTML(category.color)}</code>
      </div>

      <div class="event-actions">
        <button
          type="button"
          class="secondary-button"
          data-category-action="edit"
          data-id="${escapeHTML(category.id)}"
        >編集</button>

        <button
          type="button"
          class="danger-button"
          data-category-action="delete"
          data-id="${escapeHTML(category.id)}"
        >削除</button>
      </div>
    </article>
  `).join("");
}

$("categoryList").addEventListener("click", async event => {
  const button = event.target.closest(
    "button[data-category-action]"
  );

  if (!button) return;

  const category = categories.find(
    item => item.id === button.dataset.id
  );

  if (!category) return;

  if (button.dataset.categoryAction === "edit") {
    $("editingCategoryId").value = category.id;
    $("categoryName").value = category.name;
    $("categoryColor").value = category.color;

    $("categoryColorCode").textContent =
      category.color.toUpperCase();

    $("saveCategoryButton").textContent = "カテゴリを更新";
    $("cancelCategoryEditButton").hidden = false;

    $("categoryForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    showMessage("categoryMessage", "");
    return;
  }

  if (button.dataset.categoryAction === "delete") {
    const confirmed = confirm(
      `カテゴリ「${category.name}」を削除しますか？`
    );

    if (!confirmed) return;

    try {
      await apiPost("deleteCategory", {
        id: category.id
      });

      showMessage(
        "categoryMessage",
        "カテゴリを削除しました。"
      );

      await refreshAll();
    } catch (error) {
      showMessage(
        "categoryMessage",
        error.message || "カテゴリを削除できませんでした。",
        true
      );
    }
  }
});

/* ==================================================
   初期表示
================================================== */

resetScheduleForm();
resetCategoryForm();
