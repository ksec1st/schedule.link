const API_URL =
  "https://script.google.com/macros/s/AKfycbyXkUUA8TlCjqENs2PD2tP2xK__lZo07jBFO8S4tYfaz8hmsTFvy8LBpcb0RDGWCvKw4g/exec";


let currentDate = new Date();

let events = [];

let pendingAction = null;


/* =========================
初期化
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadEvents();

  }
);


/* =========================
予定取得
========================= */

async function loadEvents() {

  showLoading(true);


  try {

    const response =
      await fetch(
        API_URL +
        "?action=getEvents"
      );


    const data =
      await response.json();


    events =
      Array.isArray(data)
        ? data
        : [];


    renderCalendar();


  } catch (error) {

    console.error(error);

    alert(
      "予定の読み込みに失敗しました。"
    );

  }


  showLoading(false);

}


/* =========================
カレンダー
========================= */

function renderCalendar() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  document.getElementById(
    "monthTitle"
  ).textContent =
    `${year}年${month + 1}月`;


  const calendarDays =
    document.getElementById(
      "calendarDays"
    );


  calendarDays.innerHTML = "";


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();


  const lastDate =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const previousLastDate =
    new Date(
      year,
      month,
      0
    ).getDate();


  const totalCells =
    Math.ceil(
      (firstDay + lastDate) / 7
    ) * 7;


  for (
    let i = 0;
    i < totalCells;
    i++
  ) {


    let day;

    let cellMonth =
      month;

    let cellYear =
      year;

    let otherMonth =
      false;


    if (i < firstDay) {

      day =
        previousLastDate -
        firstDay +
        i +
        1;


      cellMonth--;


      if (cellMonth < 0) {

        cellMonth = 11;

        cellYear--;

      }


      otherMonth = true;


    } else if (
      i >=
      firstDay +
      lastDate
    ) {

      day =
        i -
        firstDay -
        lastDate +
        1;


      cellMonth++;


      if (cellMonth > 11) {

        cellMonth = 0;

        cellYear++;

      }


      otherMonth = true;


    } else {

      day =
        i -
        firstDay +
        1;

    }


    const date =
      createDateString(
        cellYear,
        cellMonth,
        day
      );


    const cell =
      document.createElement(
        "div"
      );


    cell.className =
      "calendar-day";


    if (otherMonth) {

      cell.classList.add(
        "other-month"
      );

    }


    if (
      date ===
      getTodayString()
    ) {

      cell.classList.add(
        "today"
      );

    }


    /*
      日付クリック
      ↓
      パスワード
      ↓
      予定追加
    */

    cell.onclick =
      () => {

        requestAddEvent(
          date
        );

      };


    const dayNumber =
      document.createElement(
        "div"
      );


    dayNumber.className =
      "day-number";


    dayNumber.textContent =
      day;


    cell.appendChild(
      dayNumber
    );


    const dayEvents =
      events.filter(
        event =>
          event.date === date
      );


    dayEvents.forEach(
      event => {


        const eventElement =
          document.createElement(
            "div"
          );


        eventElement.className =
          "event " +
          getCategoryClass(
            event.category
          );


        const time =
          event.startTime
            ? `<span class="event-time">${event.startTime}</span>`
            : "";


        eventElement.innerHTML =
          time +
          escapeHTML(
            event.title
          );


        eventElement.onclick =
          (e) => {

            e.stopPropagation();


            requestEditEvent(
              event
            );

          };


        cell.appendChild(
          eventElement
        );

      }
    );


    calendarDays.appendChild(
      cell
    );

  }

}


/* =========================
月変更
========================= */

function changeMonth(
  amount
) {

  currentDate.setMonth(
    currentDate.getMonth() +
    amount
  );


  renderCalendar();

}


function goToday() {

  currentDate =
    new Date();


  renderCalendar();

}


/* =========================
追加要求
========================= */

function requestAddEvent(
  selectedDate = null
) {

  pendingAction = {

    type:
      "add",

    date:
      selectedDate

  };


  openPasswordModal();

}


/* =========================
編集要求
========================= */

function requestEditEvent(
  event
) {

  pendingAction = {

    type:
      "edit",

    event:
      event

  };


  openPasswordModal();

}


/* =========================
削除要求
========================= */

function requestDeleteEvent() {

  const id =
    document.getElementById(
      "eventId"
    ).value;


  if (!id) {
    return;
  }


  const event =
    events.find(
      item =>
        item.id === id
    );


  pendingAction = {

    type:
      "delete",

    event:
      event

  };


  closeModal();

  openPasswordModal();

}


/* =========================
パスワード
========================= */

function openPasswordModal() {

  document.getElementById(
    "passwordInput"
  ).value = "";


  document.getElementById(
    "passwordError"
  ).style.display =
    "none";


  document.getElementById(
    "passwordModal"
  ).classList.add(
    "active"
  );


  setTimeout(
    () => {

      document.getElementById(
        "passwordInput"
      ).focus();

    },
    100
  );

}


function closePasswordModal() {

  document.getElementById(
    "passwordModal"
  ).classList.remove(
    "active"
  );


  pendingAction =
    null;

}


/* =========================
パスワード認証
========================= */

async function verifyPassword() {

  const password =
    document.getElementById(
      "passwordInput"
    ).value;


  if (!password) {

    showPasswordError(
      "パスワードを入力してください。"
    );

    return;

  }


  if (!pendingAction) {

    return;

  }


  showLoading(true);


  try {

    /*
     * Apps Scriptに
     * 本当に正しいパスワードか確認する
     */

    const response =
      await fetch(
        API_URL,
        {

          method: "POST",

          body:
            JSON.stringify({

              action:
                "verifyPassword",

              password:
                password

            })

        }
      );


    const result =
      await response.json();


    /*
     * パスワードが間違っていた場合
     */

    if (
      !result.success
    ) {

      showPasswordError(
        "パスワードが正しくありません。"
      );

      showLoading(false);

      return;

    }


    /*
     * ここまで来たら
     * 本当に認証成功
     */

    const action =
      pendingAction;


    closePasswordModal();


    /* =========================
       予定追加
    ========================= */

    if (
      action.type === "add"
    ) {

      openAddModal(
        action.date
      );


      /*
       * 認証済みパスワードを
       * 保存処理用に一時保存
       */

      document
        .getElementById(
          "eventForm"
        )
        .dataset.password =
          password;


    }


    /* =========================
       予定編集
    ========================= */

    if (
      action.type === "edit"
    ) {

      openEditModal(
        action.event
      );


      document
        .getElementById(
          "eventForm"
        )
        .dataset.password =
          password;

    }


    /* =========================
       予定削除
    ========================= */

    if (
      action.type === "delete"
    ) {

      await executeDelete(

        action.event.id,

        password

      );

    }


    pendingAction =
      null;


  } catch (error) {

    console.error(error);

    showPasswordError(
      "認証に失敗しました。もう一度お試しください。"
    );

  }


  showLoading(false);

}


/* =========================
パスワードエラー
========================= */

function showPasswordError(
  message
) {

  const error =
    document.getElementById(
      "passwordError"
    );


  error.textContent =
    message ||
    "パスワードが正しくありません。";


  error.style.display =
    "block";

}


/* =========================
予定追加画面
========================= */

function openAddModal(
  selectedDate = null
) {

  document.getElementById(
    "modalTitle"
  ).textContent =
    "予定を追加";


  document.getElementById(
    "eventForm"
  ).reset();


  document.getElementById(
    "eventId"
  ).value = "";


  document.getElementById(
    "deleteBtn"
  ).style.display =
    "none";


  document.getElementById(
    "eventDate"
  ).value =
    selectedDate ||
    createDateString(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    );


  document.getElementById(
    "category"
  ).value =
    "部活動";


  document.getElementById(
    "eventModal"
  ).classList.add(
    "active"
  );

}


/* =========================
編集画面
========================= */

function openEditModal(
  event
) {

  document.getElementById(
    "modalTitle"
  ).textContent =
    "予定を編集";


  document.getElementById(
    "eventId"
  ).value =
    event.id;


  document.getElementById(
    "eventDate"
  ).value =
    event.date;


  document.getElementById(
    "startTime"
  ).value =
    event.startTime;


  document.getElementById(
    "endTime"
  ).value =
    event.endTime;


  document.getElementById(
    "eventTitle"
  ).value =
    event.title;


  document.getElementById(
    "location"
  ).value =
    event.location;


  document.getElementById(
    "category"
  ).value =
    event.category ||
    "その他";


  document.getElementById(
    "description"
  ).value =
    event.description;


  document.getElementById(
    "author"
  ).value =
    event.author;


  document.getElementById(
    "deleteBtn"
  ).style.display =
    "block";


  document.getElementById(
    "eventModal"
  ).classList.add(
    "active"
  );

}


/* =========================
モーダル
========================= */

function closeModal() {

  document.getElementById(
    "eventModal"
  ).classList.remove(
    "active"
  );

}


/* =========================
保存
========================= */

async function saveEvent(
  e
) {

  e.preventDefault();


  const form =
    document.getElementById(
      "eventForm"
    );


  const password =
    form.dataset.password;


  if (!password) {

    closeModal();

    requestAddEvent();

    return;

  }


  const id =
    document.getElementById(
      "eventId"
    ).value;


  const data = {

    action:
      id
        ? "update"
        : "add",

    id:
      id,

    password:
      password,

    date:
      document.getElementById(
        "eventDate"
      ).value,

    startTime:
      document.getElementById(
        "startTime"
      ).value,

    endTime:
      document.getElementById(
        "endTime"
      ).value,

    title:
      document.getElementById(
        "eventTitle"
      ).value,

    location:
      document.getElementById(
        "location"
      ).value,

    category:
      document.getElementById(
        "category"
      ).value,

    description:
      document.getElementById(
        "description"
      ).value,

    author:
      document.getElementById(
        "author"
      ).value

  };


  showLoading(true);


  try {

    const response =
      await fetch(
        API_URL,
        {

          method:
            "POST",

          body:
            JSON.stringify(
              data
            )

        }
      );


    const result =
      await response.json();


    if (
      !result.success
    ) {

      throw new Error(
        result.message
      );

    }


    delete form.dataset.password;


    closeModal();


    await loadEvents();


  } catch (error) {

    alert(
      "保存に失敗しました。\n" +
      error.message
    );

  }


  showLoading(false);

}


/* =========================
削除
========================= */

async function executeDelete(
  id,
  password
) {

  if (!id) {
    return;
  }


  if (
    !confirm(
      "この予定を削除しますか？"
    )
  ) {

    return;

  }


  showLoading(true);


  try {

    const response =
      await fetch(
        API_URL,
        {

          method:
            "POST",

          body:
            JSON.stringify({

              action:
                "delete",

              id:
                id,

              password:
                password

            })

        }
      );


    const result =
      await response.json();


    if (
      !result.success
    ) {

      throw new Error(
        result.message
      );

    }


    await loadEvents();


  } catch (error) {

    alert(
      "削除に失敗しました。\n" +
      error.message
    );

  }


  showLoading(false);

}


/* =========================
カテゴリ
========================= */

function getCategoryClass(
  category
) {

  switch (
    category
  ) {

    case "部活動":

      return "club";


    case "大会・イベント":

      return "tournament";


    case "遠征":

      return "trip";

    case "休日":

      return "holiday";

    default:

      return "other";

  }

}


/* =========================
日付
========================= */

function createDateString(
  year,
  month,
  day
) {

  return (

    year +

    "-" +

    String(
      month + 1
    ).padStart(
      2,
      "0"
    ) +

    "-" +

    String(
      day
    ).padStart(
      2,
      "0"
    )

  );

}


function getTodayString() {

  const today =
    new Date();


  return createDateString(

    today.getFullYear(),

    today.getMonth(),

    today.getDate()

  );

}


/* =========================
HTMLエスケープ
========================= */

function escapeHTML(
  text
) {

  return String(
    text
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================
ローディング
========================= */

function showLoading(
  show
) {

  document
    .getElementById(
      "loading"
    )
    .classList.toggle(
      "active",
      show
    );

}


/* =========================
モーダル外クリック
========================= */

document
  .getElementById(
    "eventModal"
  )
  .addEventListener(
    "click",
    (e) => {

      if (
        e.target.id ===
        "eventModal"
      ) {

        closeModal();

      }

    }
  );


document
  .getElementById(
    "passwordModal"
  )
  .addEventListener(
    "click",
    (e) => {

      if (
        e.target.id ===
        "passwordModal"
      ) {

        closePasswordModal();

      }

    }
  );


/* =========================
Enterキー
========================= */

document
  .getElementById(
    "passwordInput"
  )
  .addEventListener(
    "keydown",
    (e) => {

      if (
        e.key ===
        "Enter"
      ) {

        verifyPassword();

      }

    }
  );
