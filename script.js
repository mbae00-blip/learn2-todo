const SUPABASE_URL = 'https://ffbdvmckfeexlxpmtjxr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYmR2bWNrZmVleGx4cG10anhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NzQ3NjMsImV4cCI6MjA5MjE1MDc2M30.9PfAfou54kYatF9OrTLiVllG8HBi5zIlEvUQZCL-B-I';
const MAX_LENGTH = 100;

let todos = [];

// ── Supabase API 헬퍼 ─────────────────────────────────────────

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── 입력값 검증 ───────────────────────────────────────────────

function validateTodoInput(text) {
  if (!text || text.trim().length === 0) return { ok: false, reason: 'empty' };
  if (text.length > MAX_LENGTH) return { ok: false, reason: 'tooLong' };
  return { ok: true };
}

// ── 데이터 관리 ───────────────────────────────────────────────

async function initializeTodos() {
  todos = await loadTodosFromDB();
}

async function loadTodosFromDB() {
  try {
    const data = await supabaseFetch('todo_items?order=created_at.asc');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Failed to load todos from Supabase:', error);
    return [];
  }
}

function generateId() {
  let id = Date.now();
  while (todos.some((t) => t.id === id)) id++;
  return id;
}

async function addTodo(text) {
  const newTodo = { id: generateId(), text, completed: false, created_at: new Date().toISOString() };
  try {
    const [saved] = await supabaseFetch('todo_items', {
      method: 'POST',
      body: JSON.stringify(newTodo),
    });
    todos.push(saved);
  } catch (error) {
    console.error('Failed to add todo:', error);
    showInputError('저장에 실패했습니다.');
  }
}

async function deleteTodo(id) {
  try {
    await supabaseFetch(`todo_items?id=eq.${id}`, { method: 'DELETE' });
    todos = todos.filter((t) => t.id !== id);
  } catch (error) {
    console.error('Failed to delete todo:', error);
  }
}

async function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  const updated = !todo.completed;
  try {
    await supabaseFetch(`todo_items?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: updated }),
    });
    todo.completed = updated;
  } catch (error) {
    console.error('Failed to toggle todo:', error);
  }
}

function getTodoStats() {
  return {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
  };
}

// ── 렌더링 ────────────────────────────────────────────────────

function renderTodos() {
  const list = document.getElementById('todoList');
  list.innerHTML = '';

  if (todos.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = '할 일을 추가해 보세요!';
    list.appendChild(li);
    return;
  }

  const fragment = document.createDocumentFragment();

  todos.forEach((todo) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' completed' : '');
    li.dataset.id = todo.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `완료 표시: ${todo.text}`);

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', `삭제: ${todo.text}`);
    deleteBtn.innerHTML = '&#10005;';

    li.append(checkbox, span, deleteBtn);
    fragment.appendChild(li);
  });

  list.appendChild(fragment);
}

function updateStats() {
  const completedEl = document.getElementById('completedCount');
  const totalEl = document.getElementById('totalCount');
  if (!completedEl || !totalEl) return;

  const { total, completed } = getTodoStats();
  completedEl.textContent = completed;
  totalEl.textContent = total;
}

function showInputError(message) {
  const input = document.getElementById('todoInput');
  if (!input) return;

  input.classList.add('input-error');
  input.setAttribute('placeholder', message);

  setTimeout(() => {
    input.classList.remove('input-error');
    input.setAttribute('placeholder', '새 할 일을 입력하세요...');
  }, 2000);
}

// ── 이벤트 핸들러 ─────────────────────────────────────────────

async function handleAddTodo() {
  const input = document.getElementById('todoInput');
  const raw = input.value;

  const { ok, reason } = validateTodoInput(raw);
  if (!ok) {
    if (reason === 'tooLong') showInputError(`100자 이하로 입력해 주세요. (현재 ${raw.length}자)`);
    return;
  }

  await addTodo(raw.trim());
  renderTodos();
  updateStats();
  input.value = '';
  input.focus();
}

function handleListClick(event) {
  const item = event.target.closest('[data-id]');
  if (!item) return;
  const id = Number(item.dataset.id);

  if (event.target.classList.contains('delete-btn')) {
    deleteTodo(id).then(() => {
      renderTodos();
      updateStats();
    });
  }
}

function handleListChange(event) {
  if (!event.target.classList.contains('todo-checkbox')) return;
  const item = event.target.closest('[data-id]');
  if (!item) return;

  toggleTodo(Number(item.dataset.id)).then(() => {
    renderTodos();
    updateStats();
  });
}

// ── 초기화 ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const todoInput = document.getElementById('todoInput');
    const addBtn = document.getElementById('addBtn');
    const todoList = document.getElementById('todoList');

    if (!todoInput || !addBtn || !todoList) {
      throw new Error('필수 DOM 요소를 찾을 수 없습니다. HTML 구조를 확인해 주세요.');
    }

    await initializeTodos();
    renderTodos();
    updateStats();

    addBtn.addEventListener('click', handleAddTodo);
    todoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) handleAddTodo();
    });

    todoList.addEventListener('click', handleListClick);
    todoList.addEventListener('change', handleListChange);
  } catch (error) {
    console.error('앱 초기화 실패:', error);
  }
});