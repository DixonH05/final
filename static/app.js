// 存放從後端拿到的全部作業
let tasks = [];

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("task-form");
  const resetBtn = document.getElementById("reset-btn");
  const courseFilter = document.getElementById("course-filter");
  const sortBySelect = document.getElementById("sort-by");
  const hideDoneCheckbox = document.getElementById("hide-done");

  form.addEventListener("submit", handleFormSubmit);
  resetBtn.addEventListener("click", resetForm);
  courseFilter.addEventListener("change", renderTasks);
  sortBySelect.addEventListener("change", renderTasks);
  hideDoneCheckbox.addEventListener("change", renderTasks);

  fetchTasks();
});

// --------------------- 與後端溝通 ---------------------

async function fetchTasks() {
  try {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    tasks = data;
    updateCourseFilterOptions();
    renderTasks();
  } catch (error) {
    console.error("取得作業清單失敗：", error);
    alert("無法取得作業清單，請稍後再試。");
  }
}

async function createTask(data) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "新增作業失敗");
  }
  return res.json();
}

async function updateTask(id, data) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "更新作業失敗");
  }
  return res.json();
}

async function deleteTask(id) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "刪除作業失敗");
  }
  return res.json();
}

// --------------------- 表單處理 ---------------------

async function handleFormSubmit(event) {
  event.preventDefault();

  const idField = document.getElementById("task-id");
  const titleInput = document.getElementById("title");
  const courseInput = document.getElementById("course");
  const dueDateInput = document.getElementById("dueDate");
  const prioritySelect = document.getElementById("priority");
  const noteTextarea = document.getElementById("note");

  const title = titleInput.value.trim();
  const course = courseInput.value.trim();
  const dueDate = dueDateInput.value; // YYYY-MM-DD 或空字串
  const priority = prioritySelect.value;
  const note = noteTextarea.value.trim();

  if (!title) {
    alert("作業名稱是必填的！");
    return;
  }

  const id = idField.value;
  const isEditMode = !!id;

  const payload = {
    title,
    course: course || null,
    due_date: dueDate || null,
    priority,
    note: note || null,
  };

  try {
    if (isEditMode) {
      // 編輯時保留原本的 completed 狀態
      const original = tasks.find((t) => t.id === Number(id));
      if (original) {
        payload.completed = original.completed;
      }
      await updateTask(id, payload);
    } else {
      // 新增時預設未完成
      payload.completed = false;
      await createTask(payload);
    }

    resetForm();
    await fetchTasks();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

function resetForm() {
  document.getElementById("task-id").value = "";
  document.getElementById("title").value = "";
  document.getElementById("course").value = "";
  document.getElementById("dueDate").value = "";
  document.getElementById("priority").value = "medium";
  document.getElementById("note").value = "";
  document.getElementById("save-btn").textContent = "儲存作業";
}

// --------------------- 清單呈現 / 排序 / 篩選 ---------------------

function renderTasks() {
  const listEl = document.getElementById("task-list");
  listEl.innerHTML = "";

  const courseFilter = document.getElementById("course-filter").value;
  const sortBy = document.getElementById("sort-by").value;
  const hideDone = document.getElementById("hide-done").checked;

  let filtered = [...tasks];

  if (courseFilter !== "all") {
    filtered = filtered.filter((t) => t.course === courseFilter);
  }

  if (hideDone) {
    filtered = filtered.filter((t) => !t.completed);
  }

  // 排序邏輯
  if (sortBy === "dueDate") {
    filtered.sort((a, b) => {
      const da = parseDate(a.due_date);
      const db = parseDate(b.due_date);

      if (!da && !db) return 0;
      if (!da) return 1; // 沒有截止日排後面
      if (!db) return -1;
      return da - db; // 越近的排前面
    });
  } else if (sortBy === "priority") {
    const weight = { high: 0, medium: 1, low: 2 };
    filtered.sort(
      (a, b) =>
        (weight[a.priority] ?? 99) - (weight[b.priority] ?? 99)
    );
  } else if (sortBy === "createdAt") {
    filtered.sort((a, b) => {
      const ca = a.created_at ? new Date(a.created_at) : 0;
      const cb = b.created_at ? new Date(b.created_at) : 0;
      return cb - ca; // 新的在前
    });
  }

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "目前沒有符合條件的作業。";
    empty.className = "empty-text";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach((task) => {
    const itemEl = createTaskElement(task);
    listEl.appendChild(itemEl);
  });
}

function updateCourseFilterOptions() {
  const courseFilter = document.getElementById("course-filter");
  const currentValue = courseFilter.value;

  const courses = Array.from(
    new Set(
      tasks
        .map((t) => t.course)
        .filter((c) => c && c.trim() !== "")
    )
  );

  courseFilter.innerHTML = '<option value="all">全部課程</option>';

  courses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course;
    option.textContent = course;
    courseFilter.appendChild(option);
  });

  if (courses.includes(currentValue)) {
    courseFilter.value = currentValue;
  } else {
    courseFilter.value = "all";
  }
}

// --------------------- 單一 task DOM ---------------------

function createTaskElement(task) {
  const wrapper = document.createElement("div");
  wrapper.className = "task-item";
  if (task.completed) {
    wrapper.classList.add("completed");
  }

  const dueInfo = getDueStatusInfo(task);

  wrapper.innerHTML = `
    <div class="task-main">
      <div class="task-left">
        <input type="checkbox" class="task-complete-toggle" ${
          task.completed ? "checked" : ""
        }>
      </div>
      <div class="task-content">
        <div class="task-title-row">
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${
            task.course
              ? `<span class="tag task-course">${escapeHtml(task.course)}</span>`
              : ""
          }
        </div>
        <div class="task-meta">
          ${
            task.due_date
              ? `<span class="badge ${dueInfo.className}">${dueInfo.label}</span>`
              : '<span class="badge badge-muted">未設定截止日</span>'
          }
          <span class="badge priority-${task.priority || "medium"}">
            優先：${priorityLabel(task.priority)}
          </span>
        </div>
        ${
          task.note
            ? `<p class="task-note">${escapeHtml(task.note)}</p>`
            : ""
        }
      </div>
    </div>
    <div class="task-actions">
      <button class="btn btn-small btn-ghost edit-btn">編輯</button>
      <button class="btn btn-small btn-danger delete-btn">刪除</button>
    </div>
  `;

  const checkbox = wrapper.querySelector(".task-complete-toggle");
  checkbox.addEventListener("change", (e) => {
    toggleTaskCompleted(task.id, e.target.checked);
  });

  const editBtn = wrapper.querySelector(".edit-btn");
  editBtn.addEventListener("click", () => {
    onEditTask(task.id);
  });

  const deleteBtn = wrapper.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", () => {
    onDeleteTask(task.id);
  });

  return wrapper;
}

// --------------------- 期限提醒邏輯 ---------------------

function getDueStatusInfo(task) {
  if (!task.due_date) {
    return { label: "未設定截止日", className: "badge-muted" };
  }

  const dueDate = parseDate(task.due_date);
  if (!dueDate) {
    return { label: "日期格式錯誤", className: "badge-muted" };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = dueDate - today;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `已過期（截止日：${task.due_date}）`,
      className: "badge-overdue",
    };
  } else if (diffDays <= 3) {
    return {
      label: `三天內截止（${task.due_date}）`,
      className: "badge-danger",
    };
  } else if (diffDays >= 4 && diffDays <= 7) {
    return {
      label: `一週內截止（${task.due_date}）`,
      className: "badge-warning",
    };
  } else {
    return {
      label: `截止日：${task.due_date}`,
      className: "badge-normal",
    };
  }
}

// --------------------- 編輯 / 刪除 / 完成 ---------------------

function onEditTask(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  document.getElementById("task-id").value = task.id;
  document.getElementById("title").value = task.title || "";
  document.getElementById("course").value = task.course || "";
  document.getElementById("dueDate").value = task.due_date || "";
  document.getElementById("priority").value = task.priority || "medium";
  document.getElementById("note").value = task.note || "";

  document.getElementById("save-btn").textContent = "更新作業";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function onDeleteTask(taskId) {
  if (!confirm("確定要刪除這筆作業嗎？")) return;

  try {
    await deleteTask(taskId);
    await fetchTasks();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

async function toggleTaskCompleted(taskId, completed) {
  try {
    await updateTask(taskId, { completed });
    await fetchTasks();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

// --------------------- 小工具函式 ---------------------

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day);
}

function priorityLabel(value) {
  if (value === "high") return "高";
  if (value === "low") return "低";
  return "中";
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
