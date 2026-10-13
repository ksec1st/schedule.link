
const API_URL = "ここにApps ScriptのウェブアプリURL";

let password = "";
let events = [];
let categories = [];
let selectedDates = [];

const $ = id => document.getElementById(id);

$("loginForm").addEventListener("submit", login);
$("logoutBtn").addEventListener("click", logout);
$("addDateBtn").addEventListener("click", addSelectedDate);
$("resetFormBtn").addEventListener("click", resetEventForm);
$("resetCategoryBtn").addEventListener("click", resetCategoryForm);
$("eventForm").addEventListener("submit", saveEvent);
$("categoryForm").addEventListener("submit", saveCategory);
$("categoryColor").addEventListener("input", () => {
  $("colorCode").textContent = $("categoryColor").value.toUpperCase();
});

async function request(action, data = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, password, ...data })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.message || "処理に失敗しました。");
  return result.data;
}

async function getData(action) {
  const response = await fetch(API_URL + "?action=" + action);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(data.message || "読み込みに失敗しました。");
  return data;
}

async function login(e) {
  e.preventDefault();
  const input = $("loginPassword").value;
  $("loginError").textContent = "";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "verifyPassword", password: input })
    });
    const result = await response.json();

    if (!result.success) {
      $("loginError").textContent = "パスワードが正しくありません。";
      return;
    }

    password = input;
    $("loginPanel").hidden = true;
    $("adminApp").hidden = false;
    await refreshAll();
  } catch (err) {
    $("loginError").textContent = "認証できませんでした。URLやデプロイ設定を確認してください。";
    console.error(err);
  }
}

function logout() {
  password = "";
  $("loginPassword").value = "";
  $("adminApp").hidden = true;
  $("loginPanel").hidden = false;
  resetEventForm();
  resetCategoryForm();
}

async function refreshAll() {
  try {
    [events, categories] = await Promise.all([
      getData("getEvents"), getData("getCategories")
    ]);
    renderEvents();
    renderCategories();
    renderCategoryOptions();
  } catch (err) {
    showStatus(err.message, true);
  }
}

function addSelectedDate() {
  const date = $("dateInput").value;
  if (!date) return showStatus("日程を選択してください。", true);
  if (!selectedDates.includes(date)) selectedDates.push(date);
  selectedDates.sort();
  renderDateChips();
  $("dateInput").value = "";
}

function renderDateChips() {
  const root = $("selectedDates");
  root.replaceChildren();

  selectedDates.forEach(date => {
    const chip = document.createElement("span");
    chip.className = "chip";
    const label = document.createElement("span");
    label.textContent = formatDate(date);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", formatDate(date) + "を選択解除");
    remove.onclick = () => {
      selectedDates = selectedDates.filter(d => d !== date);
      renderDateChips();
    };

    chip.append(label, remove);
    root.appendChild(chip);
  });
}

function renderCategoryOptions() {
  const select = $("eventCategory");
  select.replaceChildren();

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.name;
    option.textContent = category.name;
    select.appendChild(option);
  });
}

async function saveEvent(e) {
  e.preventDefault();

  const id = $("editId").value;
  const data = {
    date: selectedDates[0] || "",
    dates: selectedDates,
    title: $("eventTitle").value.trim(),
    category: $("eventCategory").value,
    description: $("eventDescription").value
  };

  if (!data.title || !data.category) {
    return showStatus("予定名とカテゴリを入力してください。", true);
  }

  if (id) {
    if (selectedDates.length !== 1) {
      return showStatus("編集中の予定は日程を1日だけ指定してください。", true);
    }
    await runAction("updateEvent", { ...data, id });
  } else {
    if (!selectedDates.length) {
      return showStatus("日程を1日以上追加してください。", true);
    }
    await runAction("addEvents", data);
  }
}

async function runAction(action, data) {
  try {
    await request(action, data);
    showStatus("保存しました。");
    resetEventForm();
    resetCategoryForm();
    await refreshAll();
  } catch (err) {
    showStatus(err.message, true);
  }
}

function renderEvents() {
  const root = $("eventList");
  root.replaceChildren();

  [...events].sort((a, b) => a.date.localeCompare(b.date)).forEach(event => {
    const item = document.createElement("div");
    item.className = "item";

    const main = document.createElement("div");
    main.className = "item-main";
    const title = document.createElement("strong");
    title.textContent = event.title;
    const detail = document.createElement("small");
    detail.textContent = `${formatDate(event.date)} ・ ${event.category}`;
    main.append(title, detail);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const edit = document.createElement("button");
    edit.className = "secondary";
    edit.textContent = "編集";
    edit.onclick = () => editEvent(event);

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "削除";
    del.onclick = async () => {
      if (confirm(`「${event.title}」(${formatDate(event.date)}) を削除しますか？`)) {
        await runAction("deleteEvent", { id: event.id });
      }
    };

    actions.append(edit, del);
    item.append(main, actions);
    root.appendChild(item);
  });

  if (!events.length) root.textContent = "登録された予定はありません。";
}

function editEvent(event) {
  $("formTitle").textContent = "予定を編集";
  $("editId").value = event.id;
  $("eventTitle").value = event.title;
  $("eventCategory").value = event.category;
  $("eventDescription").value = event.description || "";
  selectedDates = [event.date];
  renderDateChips();
  $("dateInput").value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetEventForm() {
  $("eventForm").reset();
  $("editId").value = "";
  $("formTitle").textContent = "予定を追加";
  selectedDates = [];
  renderDateChips();
}

function renderCategories() {
  const root = $("categoryList");
  root.replaceChildren();

  categories.forEach(category => {
    const item = document.createElement("div");
    item.className = "item";

    const main = document.createElement("div");
    main.className = "item-main";
    const title = document.createElement("strong");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.backgroundColor = category.color;
    title.append(swatch, document.createTextNode(category.name));

    const detail = document.createElement("small");
    detail.textContent = category.color;
    main.append(title, detail);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const edit = document.createElement("button");
    edit.className = "secondary";
    edit.textContent = "編集";
    edit.onclick = () => {
      $("categoryEditId").value = category.id;
      $("categoryName").value = category.name;
      $("categoryColor").value = category.color;
      $("colorCode").textContent = category.color;
      $("categoryName").focus();
    };

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "削除";
    del.onclick = async () => {
      if (confirm(`カテゴリ「${category.name}」を削除しますか？`)) {
        await runAction("deleteCategory", { id: category.id });
      }
    };

    actions.append(edit, del);
    item.append(main, actions);
    root.appendChild(item);
  });
}

async function saveCategory(e) {
  e.preventDefault();
  const id = $("categoryEditId").value;
  const data = {
    name: $("categoryName").value.trim(),
    color: $("categoryColor").value.toUpperCase()
  };

  if (!data.name) return showStatus("カテゴリ名を入力してください。", true);

  await runAction(id ? "updateCategory" : "addCategory", { ...data, id });
}

function resetCategoryForm() {
  $("categoryForm").reset();
  $("categoryEditId").value = "";
  $("categoryColor").value = "#2774E6";
  $("colorCode").textContent = "#2774E6";
}

function formatDate(value) {
  const [y, m, d] = value.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function showStatus(message, error = false) {
  $("statusMessage").textContent = message;
  $("statusMessage").style.color = error ? "#c22c3a" : "#167647";
}
