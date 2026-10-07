const API_URL =
  "ここにApps ScriptのウェブアプリURL";


let currentDate = new Date();

let events = [];


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
        API_URL + "?action=getEvents"
      );

    const data =
      await response.json();

    events = Array.isArray(data)
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
   カレンダー表示
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
    let date;
    let cellMonth = month;
    let cellYear = year;
    let otherMonth = false;


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
      i >= firstDay + lastDate
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


    date =
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


    cell.onclick =
      () => openAddModal(date);


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

            openEditModal(event);

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
   月移動
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
   予定追加
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
   予定編集
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
   モーダル閉じる
========================= */

function closeModal() {

  document.getElementById(
    "eventModal"
  ).classList.remove(
    "active"
  );

}


/* =========================
   予定保存
========================= */

async function saveEvent(
  e
) {

  e.preventDefault();

  const id =
    document.getElementById(
      "eventId"
    ).value;


  const data = {

    action:
      id
        ? "update"
        : "add",

    id: id,

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
          method: "POST",

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
        result.message ||
        "保存に失敗しました。"
      );

    }


    closeModal();

    await loadEvents();


  } catch (error) {

    console.error(error);

    alert(
      "保存に失敗しました。\n" +
      error.message
    );

  }


  showLoading(false);

}


/* =========================
   予定削除
========================= */

async function deleteEvent() {

  const id =
    document.getElementById(
      "eventId"
    ).value;


  if (!id) return;


  const confirmed =
    confirm(
      "この予定を削除しますか？"
    );


  if (!confirmed) return;


  showLoading(true);


  try {

    const response =
      await fetch(
        API_URL,
        {
          method: "POST",

          body:
            JSON.stringify({
              action:
                "delete",

              id:
                id
            })
        }
      );


    const result =
      await response.json();


    if (
      !result.success
    ) {

      throw new Error(
        result.message ||
        "削除に失敗しました。"
      );

    }


    closeModal();

    await loadEvents();


  } catch (error) {

    console.error(error);

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

  switch (category) {

    case "部活動":
      return "club";

    case "大会・イベント":
      return "tournament";

    case "遠征":
      return "trip";

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
    ).padStart(2, "0") +
    "-" +
    String(
      day
    ).padStart(2, "0")
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

  return String(text)
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

  const loading =
    document.getElementById(
      "loading"
    );

  loading.classList.toggle(
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
