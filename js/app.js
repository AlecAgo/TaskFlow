/* FocusFlow — Tasks + Calendar
   Everything persists in localStorage. No external libraries.
*/

(() => {
  'use strict';

  // -------- Utilities --------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };
  const safeJSON = {
    parse(str, fallback) {
      try { return JSON.parse(str); } catch { return fallback; }
    },
    stringify(obj) {
      try { return JSON.stringify(obj); } catch { return 'null'; }
    }
  };
  const uid = () => (crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const fmt = {
    niceDate(iso) {
      if (!iso) return 'No due date';
      const [y,m,d] = iso.split('-').map(Number);
      const dt = new Date(y, m-1, d);
      return dt.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    },
    monthTitle(year, monthIndex){
      const dt = new Date(year, monthIndex, 1);
      return dt.toLocaleDateString(undefined, { month:'long', year:'numeric' });
    },
    dayTitle(iso){
      const [y,m,d] = iso.split('-').map(Number);
      const dt = new Date(y, m-1, d);
      return dt.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
    },
    timeRange(start,end){
      const s = start ? start : '';
      const e = end ? end : '';
      if (s && e) return `${s}–${e}`;
      if (s) return `Starts ${s}`;
      if (e) return `Ends ${e}`;
      return '';
    }
  };

  // -------- Storage --------
  const STORE = {
    tasks: 'focusflow.tasks',
    events: 'focusflow.events',
    categories: 'focusflow.categories',
    ui: 'focusflow.ui'
  };

  const defaults = {
    categories: ['Personal','Work','Health'],
    tasks: [],
    events: [],
    ui: { page: 0, taskFilter: 'all', calendar: { year: new Date().getFullYear(), month: new Date().getMonth(), selectedDate: todayISO(), drawerOpen: true } }
  };

  const load = () => {
    const categories = safeJSON.parse(localStorage.getItem(STORE.categories), defaults.categories);
    const tasks = safeJSON.parse(localStorage.getItem(STORE.tasks), defaults.tasks);
    const events = safeJSON.parse(localStorage.getItem(STORE.events), defaults.events);
    const ui = safeJSON.parse(localStorage.getItem(STORE.ui), defaults.ui);

    // Sanity & migrations
    const cleanCats = Array.from(new Set((categories || []).map(x => String(x || '').trim()).filter(Boolean)));
    if (!cleanCats.length) cleanCats.push(...defaults.categories);

    const cleanTasks = (tasks || []).filter(Boolean).map(t => ({
      id: String(t.id || uid()),
      title: String(t.title || '').trim(),
      category: String(t.category || cleanCats[0]),
      priority: ['low','medium','high'].includes(t.priority) ? t.priority : 'medium',
      dueDate: t.dueDate ? String(t.dueDate) : '',
      notes: String(t.notes || ''),
      completed: !!t.completed,
      createdAt: t.createdAt || Date.now(),
      updatedAt: t.updatedAt || Date.now()
    })).filter(t => t.title);

    const cleanEvents = (events || []).filter(Boolean).map(e => ({
      id: String(e.id || uid()),
      title: String(e.title || '').trim(),
      date: e.date ? String(e.date) : todayISO(),
      startTime: e.startTime ? String(e.startTime) : '',
      endTime: e.endTime ? String(e.endTime) : '',
      location: String(e.location || ''),
      notes: String(e.notes || ''),
      color: ['blue','pink','green','orange','purple'].includes(e.color) ? e.color : 'blue',
      createdAt: e.createdAt || Date.now(),
      updatedAt: e.updatedAt || Date.now()
    })).filter(e => e.title);

    const uiFixed = {
      page: clamp(Number(ui?.page ?? defaults.ui.page), 0, 1),
      taskFilter: ['all','active','completed'].includes(ui?.taskFilter) ? ui.taskFilter : 'all',
      calendar: {
        year: Number(ui?.calendar?.year ?? defaults.ui.calendar.year),
        month: clamp(Number(ui?.calendar?.month ?? defaults.ui.calendar.month), 0, 11),
        selectedDate: String(ui?.calendar?.selectedDate ?? defaults.ui.calendar.selectedDate),
        drawerOpen: ui?.calendar?.drawerOpen !== false
      }
    };

    return { categories: cleanCats, tasks: cleanTasks, events: cleanEvents, ui: uiFixed };
  };

  const persist = (state) => {
    localStorage.setItem(STORE.categories, safeJSON.stringify(state.categories));
    localStorage.setItem(STORE.tasks, safeJSON.stringify(state.tasks));
    localStorage.setItem(STORE.events, safeJSON.stringify(state.events));
    localStorage.setItem(STORE.ui, safeJSON.stringify(state.ui));
  };

  // -------- State --------
  const state = load();

  // -------- DOM refs --------
  const viewport = $('#viewport');
  const pages = $$('.page');
  const pageTitle = $('#pageTitle');
  const pageSubtitle = $('#pageSubtitle');
  const pagerDots = $$('.pager__dot');

  // Task
  const taskList = $('#taskList');
  const taskEmpty = $('#taskEmpty');
  const taskStats = $('#taskStats');
  const addTaskBtn = $('#addTaskBtn');
  const manageCategoriesBtn = $('#manageCategoriesBtn');
  const filterBtns = $$('.seg__btn');

  // Calendar
  const monthTitle = $('#monthTitle');
  const calendarGrid = $('#calendarGrid');
  const monthPrev = $('#monthPrev');
  const monthNext = $('#monthNext');
  const monthToday = $('#monthToday');
  const addEventBtn = $('#addEventBtn');

  const dayDrawer = $('#dayDrawer');
  const drawerDate = $('#drawerDate');
  const drawerHint = $('#drawerHint');
  const drawerClose = $('#drawerClose');
  const drawerEvents = $('#drawerEvents');
  const drawerTasks = $('#drawerTasks');
  const drawerEventsEmpty = $('#drawerEventsEmpty');
  const drawerTasksEmpty = $('#drawerTasksEmpty');

  // Nav
  const navPrev = $('#navPrev');
  const navNext = $('#navNext');

  // Modals
  const taskModal = $('#taskModal');
  const taskForm = $('#taskForm');
  const taskModalTitle = $('#taskModalTitle');
  const taskDeleteBtn = $('#taskDeleteBtn');
  const taskId = $('#taskId');
  const taskTitle = $('#taskTitle');
  const taskCategory = $('#taskCategory');
  const taskPriority = $('#taskPriority');
  const taskDueDate = $('#taskDueDate');
  const taskNotes = $('#taskNotes');

  const catModal = $('#catModal');
  const catNew = $('#catNew');
  const catAddBtn = $('#catAddBtn');
  const catList = $('#catList');

  const eventModal = $('#eventModal');
  const eventForm = $('#eventForm');
  const eventModalTitle = $('#eventModalTitle');
  const eventDeleteBtn = $('#eventDeleteBtn');
  const eventId = $('#eventId');
  const eventTitle = $('#eventTitle');
  const eventDate = $('#eventDate');
  const eventStart = $('#eventStart');
  const eventEnd = $('#eventEnd');
  const eventLocation = $('#eventLocation');
  const eventNotes = $('#eventNotes');
  const eventColor = $('#eventColor');

  // Import/Export
  const exportBtn = $('#exportBtn');
  const importBtn = $('#importBtn');
  const importFile = $('#importFile');

  // Toast
  const toastEl = $('#toast');
  let toastTimer = null;

  // -------- Toast --------
  const toast = (msg) => {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove('is-show');
    // Force reflow so animation restarts
    void toastEl.offsetWidth;
    toastEl.classList.add('is-show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-show');
      toastEl.hidden = true;
    }, 2700);
  };

  // -------- Page Navigation --------
  const setPage = (pageIndex) => {
    state.ui.page = clamp(pageIndex, 0, 1);
    pages.forEach(p => p.classList.remove('is-left','is-right'));
    pages.forEach(p => {
      const idx = Number(p.dataset.page);
      if (idx < state.ui.page) p.classList.add('is-left');
      if (idx > state.ui.page) p.classList.add('is-right');
    });

    pagerDots.forEach(d => d.classList.toggle('is-active', Number(d.dataset.page) === state.ui.page));

    if (state.ui.page === 0) {
      pageTitle.textContent = 'Tasks';
      pageSubtitle.textContent = 'Stay in flow. Tap + to add.';
    } else {
      pageTitle.textContent = 'Calendar';
      pageSubtitle.textContent = 'Events + due tasks, side by side.';
    }

    persist(state);
  };

  const initPager = () => {
    navPrev.addEventListener('click', () => setPage(state.ui.page - 1));
    navNext.addEventListener('click', () => setPage(state.ui.page + 1));
    pagerDots.forEach(d => d.addEventListener('click', () => setPage(Number(d.dataset.page))));

    // Swipe (pointer-based) on viewport
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    };
    const onUp = (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // Horizontal swipe threshold; ignore if vertical scroll dominates.
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) setPage(state.ui.page + 1);
      else setPage(state.ui.page - 1);
    };

    viewport.addEventListener('pointerdown', onDown, { passive: true });
    viewport.addEventListener('pointerup', onUp, { passive: true });
    viewport.addEventListener('pointercancel', () => tracking = false, { passive: true });
  };

  // -------- Tasks --------
  const prioRank = { high: 3, medium: 2, low: 1 };

  const visibleTasks = () => {
    const filter = state.ui.taskFilter;
    let arr = [...state.tasks];
    if (filter === 'active') arr = arr.filter(t => !t.completed);
    if (filter === 'completed') arr = arr.filter(t => t.completed);

    // Sort: incomplete first, then due soon, then priority high, then newest
    arr.sort((a,b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const ad = a.dueDate || '9999-12-31';
      const bd = b.dueDate || '9999-12-31';
      if (ad !== bd) return ad.localeCompare(bd);
      if (prioRank[a.priority] !== prioRank[b.priority]) return prioRank[b.priority] - prioRank[a.priority];
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return arr;
  };

  const setFilter = (filter) => {
    state.ui.taskFilter = filter;
    filterBtns.forEach(btn => {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    persist(state);
    renderTasks();
  };

  const renderCategoryOptions = () => {
    taskCategory.innerHTML = '';
    for (const c of state.categories) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      taskCategory.appendChild(opt);
    }
  };

  const prioBadgeClass = (p) => ({ high: 'badge--prio-high', medium: 'badge--prio-medium', low: 'badge--prio-low' }[p] || 'badge--prio-medium');

  const renderTasks = () => {
    const list = visibleTasks();

    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.completed).length;
    const active = total - done;
    taskStats.textContent = `${active} active • ${done} completed • ${total} total`;

    taskList.innerHTML = '';
    taskEmpty.hidden = list.length !== 0;

    for (const t of list) {
      const card = document.createElement('div');
      card.className = `card task ${t.completed ? 'is-completed' : ''}`;
      card.dataset.id = t.id;

      const check = document.createElement('button');
      check.className = `check ${t.completed ? 'is-done' : ''}`;
      check.setAttribute('aria-label', t.completed ? 'Mark incomplete' : 'Mark complete');
      check.innerHTML = t.completed ? '✓' : '';
      check.addEventListener('click', () => toggleTaskComplete(t.id));

      const body = document.createElement('div');
      body.className = 'task__body';

      const title = document.createElement('div');
      title.className = 'task__title';
      title.textContent = t.title;

      const meta = document.createElement('div');
      meta.className = 'task__meta';
      meta.appendChild(badge(`📁 ${t.category}`));
      meta.appendChild(badge(`⚡ ${t.priority.toUpperCase()}`, prioBadgeClass(t.priority)));
      if (t.dueDate) meta.appendChild(badge(`⏰ ${fmt.niceDate(t.dueDate)}`));
      if (t.notes) meta.appendChild(badge(`📝 ${t.notes}`));

      body.appendChild(title);
      body.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const edit = actionBtn('Edit', '✎', () => openTaskModal('edit', t.id));
      const del = actionBtn('Delete', '🗑', () => deleteTask(t.id));
      actions.appendChild(edit);
      actions.appendChild(del);

      card.appendChild(check);
      card.appendChild(body);
      card.appendChild(actions);

      taskList.appendChild(card);
    }
  };

  const badge = (text, extraClass = '') => {
    const b = document.createElement('span');
    b.className = `badge ${extraClass}`.trim();
    b.textContent = text;
    return b;
  };

  const actionBtn = (label, icon, onClick) => {
    const btn = document.createElement('button');
    btn.className = 'action';
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.textContent = icon;
    btn.addEventListener('click', onClick);
    return btn;
  };

  const toggleTaskComplete = (id) => {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    t.updatedAt = Date.now();
    persist(state);
    renderTasks();
    renderCalendar();
    renderDrawer();
    toast(t.completed ? 'Task completed' : 'Marked active');
  };

  const deleteTask = (id) => {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    // Small confirmation, but not blocking with confirm — use a toast with undo pattern.
    const idx = state.tasks.findIndex(x => x.id === id);
    const removed = state.tasks.splice(idx, 1)[0];
    persist(state);
    renderTasks();
    renderCalendar();
    renderDrawer();

    let undone = false;
    toast('Task deleted. Press Ctrl/Cmd+Z to undo');

    const onUndo = (e) => {
      const z = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
      if (!z || undone) return;
      undone = true;
      state.tasks.splice(idx, 0, removed);
      persist(state);
      renderTasks();
      renderCalendar();
      renderDrawer();
      toast('Undo: task restored');
      window.removeEventListener('keydown', onUndo);
    };
    window.addEventListener('keydown', onUndo);
    // Auto detach after a bit
    setTimeout(() => window.removeEventListener('keydown', onUndo), 5500);
  };

  // -------- Task Modal --------
  const openModal = (el) => {
    el.hidden = false;
    // Focus first input
    const first = el.querySelector('input,select,button,textarea');
    first?.focus?.();
  };
  const closeModal = (el) => {
    el.hidden = true;
  };

  const openTaskModal = (mode = 'new', id = '') => {
    renderCategoryOptions();

    const editing = (mode === 'edit');
    taskModalTitle.textContent = editing ? 'Edit Task' : 'New Task';
    taskDeleteBtn.hidden = !editing;

    if (editing) {
      const t = state.tasks.find(x => x.id === id);
      if (!t) return;
      taskId.value = t.id;
      taskTitle.value = t.title;
      taskCategory.value = state.categories.includes(t.category) ? t.category : state.categories[0];
      taskPriority.value = t.priority;
      taskDueDate.value = t.dueDate || '';
      taskNotes.value = t.notes || '';
      taskDeleteBtn.onclick = () => { closeModal(taskModal); deleteTask(t.id); };
    } else {
      taskId.value = '';
      taskTitle.value = '';
      taskCategory.value = state.categories[0];
      taskPriority.value = 'medium';
      taskDueDate.value = '';
      taskNotes.value = '';
      taskDeleteBtn.onclick = null;
    }

    openModal(taskModal);
  };

  const upsertTaskFromForm = (formData) => {
    const id = String(formData.get('id') || '').trim();
    const title = String(formData.get('title') || '').trim();
    if (!title) return { ok:false, reason:'Title is required' };

    const category = String(formData.get('category') || state.categories[0]);
    const priority = String(formData.get('priority') || 'medium');
    const dueDate = String(formData.get('dueDate') || '');
    const notes = String(formData.get('notes') || '').trim();

    if (!state.categories.includes(category)) {
      // fallback to first
      toast('Category not found; using default');
    }

    if (id) {
      const t = state.tasks.find(x => x.id === id);
      if (!t) return { ok:false, reason:'Task not found' };
      t.title = title;
      t.category = state.categories.includes(category) ? category : state.categories[0];
      t.priority = ['low','medium','high'].includes(priority) ? priority : 'medium';
      t.dueDate = dueDate;
      t.notes = notes;
      t.updatedAt = Date.now();
      persist(state);
      return { ok:true, mode:'updated' };
    }

    const task = {
      id: uid(),
      title,
      category: state.categories.includes(category) ? category : state.categories[0],
      priority: ['low','medium','high'].includes(priority) ? priority : 'medium',
      dueDate,
      notes,
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.tasks.push(task);
    persist(state);
    return { ok:true, mode:'created' };
  };

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(taskForm);
    const res = upsertTaskFromForm(fd);
    if (!res.ok) {
      toast(res.reason || 'Could not save task');
      taskTitle.focus();
      return;
    }
    closeModal(taskModal);
    renderTasks();
    renderCalendar();
    renderDrawer();
    toast(res.mode === 'created' ? 'Task added' : 'Task updated');
  });

  addTaskBtn.addEventListener('click', () => openTaskModal('new'));

  // -------- Categories --------
  const openCategoriesModal = () => {
    catNew.value = '';
    renderCategoriesList();
    openModal(catModal);
  };

  const renderCategoriesList = () => {
    catList.innerHTML = '';
    state.categories.forEach((c, idx) => {
      const row = document.createElement('div');
      row.className = 'catrow';

      const input = document.createElement('input');
      input.className = 'input';
      input.value = c;
      input.maxLength = 30;
      input.setAttribute('aria-label', `Category ${idx+1}`);

      const btns = document.createElement('div');
      btns.className = 'actions';

      const save = actionBtn('Save', '✓', () => {
        const next = String(input.value || '').trim();
        if (!next) return toast('Category name cannot be empty');
        if (state.categories.includes(next) && next !== c) return toast('That category already exists');
        renameCategory(c, next);
      });

      const del = actionBtn('Delete', '🗑', () => {
        if (state.categories.length <= 1) return toast('Keep at least one category');
        removeCategory(c);
      });

      btns.appendChild(save);
      btns.appendChild(del);

      row.appendChild(input);
      row.appendChild(btns);
      catList.appendChild(row);
    });
  };

  const addCategory = (name) => {
    const n = String(name || '').trim();
    if (!n) return toast('Enter a category name');
    if (state.categories.includes(n)) return toast('That category already exists');
    state.categories.push(n);
    persist(state);
    renderCategoriesList();
    renderCategoryOptions();
    renderTasks();
    toast('Category added');
  };

  const renameCategory = (from, to) => {
    if (from === to) return toast('No changes');
    const i = state.categories.indexOf(from);
    if (i === -1) return;
    state.categories[i] = to;
    // Update tasks
    state.tasks.forEach(t => { if (t.category === from) t.category = to; });
    persist(state);
    renderCategoriesList();
    renderCategoryOptions();
    renderTasks();
    renderCalendar();
    renderDrawer();
    toast('Category renamed');
  };

  const removeCategory = (name) => {
    const i = state.categories.indexOf(name);
    if (i === -1) return;
    // Reassign tasks to first remaining category
    const remaining = state.categories.filter(c => c !== name);
    const fallback = remaining[0];
    state.tasks.forEach(t => { if (t.category === name) t.category = fallback; });
    state.categories = remaining;
    persist(state);
    renderCategoriesList();
    renderCategoryOptions();
    renderTasks();
    renderCalendar();
    renderDrawer();
    toast('Category deleted');
  };

  manageCategoriesBtn.addEventListener('click', openCategoriesModal);
  catAddBtn.addEventListener('click', () => addCategory(catNew.value));
  catNew.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCategory(catNew.value); }
  });

  // -------- Calendar --------
  const isoFromParts = (y, mIndex, d) => `${y}-${pad2(mIndex+1)}-${pad2(d)}`;
  const daysInMonth = (y, mIndex) => new Date(y, mIndex+1, 0).getDate();

  const setMonth = (year, monthIndex) => {
    state.ui.calendar.year = year;
    state.ui.calendar.month = monthIndex;
    persist(state);
    renderCalendar();
  };

  const setSelectedDate = (iso) => {
    state.ui.calendar.selectedDate = iso;
    state.ui.calendar.drawerOpen = true;
    persist(state);
    renderCalendar();
    renderDrawer();
  };

  const renderCalendar = () => {
    const { year, month } = state.ui.calendar;
    monthTitle.textContent = fmt.monthTitle(year, month);

    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday=0
    const dim = daysInMonth(year, month);

    // Determine previous month
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dimPrev = daysInMonth(prevYear, prevMonth);

    const totalCells = 42; // 6 weeks
    calendarGrid.innerHTML = '';

    // Weekday labels (Monday-first to match grid)
    const weekdayBase = new Date(2024, 0, 1); // 2024-01-01 is a Monday
    for (let i = 0; i < 7; i++) {
      const dt = new Date(weekdayBase.getFullYear(), weekdayBase.getMonth(), weekdayBase.getDate() + i);
      const lab = document.createElement('div');
      lab.className = 'dow';
      lab.textContent = dt.toLocaleDateString(undefined, { weekday: 'short' });
      calendarGrid.appendChild(lab);
    }


    const selected = state.ui.calendar.selectedDate;
    const today = todayISO();

    // Pre-compute counts
    const eventByDate = new Map();
    for (const e of state.events) {
      const list = eventByDate.get(e.date) || [];
      list.push(e);
      eventByDate.set(e.date, list);
    }

    const dueTasksByDate = new Map();
    for (const t of state.tasks) {
      if (!t.dueDate) continue;
      const list = dueTasksByDate.get(t.dueDate) || [];
      list.push(t);
      dueTasksByDate.set(t.dueDate, list);
    }

    for (let i = 0; i < totalCells; i++) {
      let dayNum = i - startWeekday + 1;
      let cellYear = year;
      let cellMonth = month;
      let isOther = false;

      if (dayNum < 1) {
        isOther = true;
        cellMonth = prevMonth;
        cellYear = prevYear;
        dayNum = dimPrev + dayNum;
      } else if (dayNum > dim) {
        isOther = true;
        cellMonth = (month === 11 ? 0 : month + 1);
        cellYear = (month === 11 ? year + 1 : year);
        dayNum = dayNum - dim;
      }

      const iso = isoFromParts(cellYear, cellMonth, dayNum);
      const cell = document.createElement('button');
      cell.className = `day ${isOther ? 'is-other' : ''} ${iso === today ? 'is-today' : ''} ${iso === selected ? 'is-selected' : ''}`.trim();
      cell.type = 'button';
      cell.setAttribute('aria-label', `Day ${iso}`);
      cell.dataset.date = iso;

      const num = document.createElement('div');
      num.className = 'day__num';
      num.textContent = String(dayNum);

      const badges = document.createElement('div');
      badges.className = 'day__badges';

      // Event dots (up to 3)
      const evs = (eventByDate.get(iso) || []).slice().sort((a,b) => (a.startTime||'99:99').localeCompare(b.startTime||'99:99'));
      const dotsToShow = evs.slice(0,3);
      dotsToShow.forEach(ev => {
        const d = document.createElement('span');
        d.className = `dot ${ev.color || 'blue'}`.trim();
        d.title = ev.title;
        badges.appendChild(d);
      });

      // Due tasks indicator
      const due = dueTasksByDate.get(iso) || [];
      const highDue = due.some(t => !t.completed && t.priority === 'high');
      const dueCount = due.filter(t => !t.completed).length;
      if (dueCount) {
        const pip = document.createElement('span');
        pip.className = `pip ${highDue ? 'pip--high' : ''}`.trim();
        pip.textContent = `${dueCount} due`;
        badges.appendChild(pip);
      }

      cell.appendChild(num);
      cell.appendChild(badges);

      cell.addEventListener('click', () => {
        setSelectedDate(iso);
        // If clicking an other-month day, switch month to that day
        if (isOther) {
          state.ui.calendar.year = cellYear;
          state.ui.calendar.month = cellMonth;
          persist(state);
          renderCalendar();
        }
      });

      calendarGrid.appendChild(cell);
    }

    // Drawer state
    dayDrawer.classList.toggle('is-hidden', !state.ui.calendar.drawerOpen);
  };

  const renderDrawer = () => {
    const iso = state.ui.calendar.selectedDate || todayISO();
    drawerDate.textContent = fmt.dayTitle(iso);

    const evs = state.events.filter(e => e.date === iso).slice().sort((a,b) => (a.startTime||'99:99').localeCompare(b.startTime||'99:99'));
    const dueTasks = state.tasks.filter(t => t.dueDate === iso).slice().sort((a,b) => {
      // active first, high priority first
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return prioRank[b.priority] - prioRank[a.priority];
    });

    drawerEvents.innerHTML = '';
    drawerTasks.innerHTML = '';

    drawerEventsEmpty.hidden = evs.length !== 0;
    drawerTasksEmpty.hidden = dueTasks.length !== 0;

    evs.forEach(e => drawerEvents.appendChild(renderEventItem(e)));
    dueTasks.forEach(t => drawerTasks.appendChild(renderTaskDueItem(t)));

    const activeCount = dueTasks.filter(t => !t.completed).length;
    const evCount = evs.length;
    drawerHint.textContent = `${evCount} event${evCount===1?'':'s'} • ${activeCount} due task${activeCount===1?'':'s'} active`;
  };

  const renderEventItem = (e) => {
    const item = document.createElement('div');
    item.className = 'item';

    const left = document.createElement('div');
    left.className = 'item__left';

    const title = document.createElement('div');
    title.className = 'item__title';
    title.textContent = e.title;

    const sub = document.createElement('div');
    sub.className = 'item__sub';

    const tr = fmt.timeRange(e.startTime, e.endTime);
    if (tr) sub.appendChild(badge(`⏱ ${tr}`));
    if (e.location) sub.appendChild(badge(`📍 ${e.location}`));
    if (e.notes) sub.appendChild(badge(`📝 ${e.notes}`));

    left.appendChild(title);
    left.appendChild(sub);

    const btns = document.createElement('div');
    btns.className = 'actions';
    btns.appendChild(actionBtn('Edit event', '✎', () => openEventModal('edit', e.id)));
    btns.appendChild(actionBtn('Delete event', '🗑', () => deleteEvent(e.id)));

    item.appendChild(left);
    item.appendChild(btns);

    item.style.borderColor = colorBorder(e.color);
    return item;
  };

  const colorBorder = (color) => {
    const m = {
      blue: 'rgba(10,132,255,.38)',
      pink: 'rgba(255,45,85,.34)',
      green: 'rgba(52,199,89,.30)',
      orange: 'rgba(255,159,10,.30)',
      purple: 'rgba(191,90,242,.32)'
    };
    return m[color] || m.blue;
  };

  const renderTaskDueItem = (t) => {
    const item = document.createElement('div');
    item.className = 'item';

    const left = document.createElement('div');
    left.className = 'item__left';

    const title = document.createElement('div');
    title.className = 'item__title';
    title.textContent = t.title;

    const sub = document.createElement('div');
    sub.className = 'item__sub';
    sub.appendChild(badge(`📁 ${t.category}`));
    sub.appendChild(badge(`⚡ ${t.priority.toUpperCase()}`, prioBadgeClass(t.priority)));
    if (t.completed) sub.appendChild(badge('✓ Completed'));

    left.appendChild(title);
    left.appendChild(sub);

    const btns = document.createElement('div');
    btns.className = 'actions';
    btns.appendChild(actionBtn(t.completed ? 'Mark active' : 'Complete', t.completed ? '↺' : '✓', () => toggleTaskComplete(t.id)));
    btns.appendChild(actionBtn('Edit task', '✎', () => openTaskModal('edit', t.id)));

    item.appendChild(left);
    item.appendChild(btns);

    return item;
  };

  // Calendar controls
  monthPrev.addEventListener('click', () => {
    let { year, month } = state.ui.calendar;
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
    setMonth(year, month);
  });
  monthNext.addEventListener('click', () => {
    let { year, month } = state.ui.calendar;
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    setMonth(year, month);
  });
  monthToday.addEventListener('click', () => {
    const d = new Date();
    state.ui.calendar.year = d.getFullYear();
    state.ui.calendar.month = d.getMonth();
    setSelectedDate(todayISO());
    persist(state);
    renderCalendar();
    renderDrawer();
  });

  drawerClose.addEventListener('click', () => {
    state.ui.calendar.drawerOpen = false;
    persist(state);
    renderCalendar();
  });

  // -------- Event Modal --------
  const openEventModal = (mode = 'new', id = '', defaultDate = '') => {
    const editing = (mode === 'edit');
    eventModalTitle.textContent = editing ? 'Edit Event' : 'New Event';
    eventDeleteBtn.hidden = !editing;

    if (editing) {
      const e = state.events.find(x => x.id === id);
      if (!e) return;
      eventId.value = e.id;
      eventTitle.value = e.title;
      eventDate.value = e.date;
      eventStart.value = e.startTime || '';
      eventEnd.value = e.endTime || '';
      eventLocation.value = e.location || '';
      eventNotes.value = e.notes || '';
      eventColor.value = e.color || 'blue';
      eventDeleteBtn.onclick = () => { closeModal(eventModal); deleteEvent(e.id); };
    } else {
      eventId.value = '';
      eventTitle.value = '';
      eventDate.value = defaultDate || state.ui.calendar.selectedDate || todayISO();
      eventStart.value = '';
      eventEnd.value = '';
      eventLocation.value = '';
      eventNotes.value = '';
      eventColor.value = 'blue';
      eventDeleteBtn.onclick = null;
    }

    openModal(eventModal);
  };

  const upsertEventFromForm = (formData) => {
    const id = String(formData.get('id') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const date = String(formData.get('date') || '').trim();
    if (!title) return { ok:false, reason:'Title is required' };
    if (!date) return { ok:false, reason:'Date is required' };

    const startTime = String(formData.get('startTime') || '').trim();
    const endTime = String(formData.get('endTime') || '').trim();
    // Basic time sanity: if both set, ensure start<=end
    if (startTime && endTime && startTime > endTime) {
      return { ok:false, reason:'End time must be after start time' };
    }

    const location = String(formData.get('location') || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const color = String(formData.get('color') || 'blue').trim();

    if (id) {
      const e = state.events.find(x => x.id === id);
      if (!e) return { ok:false, reason:'Event not found' };
      e.title = title;
      e.date = date;
      e.startTime = startTime;
      e.endTime = endTime;
      e.location = location;
      e.notes = notes;
      e.color = ['blue','pink','green','orange','purple'].includes(color) ? color : 'blue';
      e.updatedAt = Date.now();
      persist(state);
      return { ok:true, mode:'updated' };
    }

    const ev = {
      id: uid(),
      title,
      date,
      startTime,
      endTime,
      location,
      notes,
      color: ['blue','pink','green','orange','purple'].includes(color) ? color : 'blue',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    state.events.push(ev);
    persist(state);
    return { ok:true, mode:'created' };
  };

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(eventForm);
    const res = upsertEventFromForm(fd);
    if (!res.ok) {
      toast(res.reason || 'Could not save event');
      eventTitle.focus();
      return;
    }
    closeModal(eventModal);
    // Jump to event month if needed
    const [y,m] = (eventDate.value || todayISO()).split('-').map(Number);
    state.ui.calendar.year = y;
    state.ui.calendar.month = m - 1;
    state.ui.calendar.selectedDate = eventDate.value;
    state.ui.calendar.drawerOpen = true;
    persist(state);

    renderCalendar();
    renderDrawer();
    toast(res.mode === 'created' ? 'Event added' : 'Event updated');
  });

  const deleteEvent = (id) => {
    const idx = state.events.findIndex(x => x.id === id);
    if (idx === -1) return;
    const removed = state.events.splice(idx, 1)[0];
    persist(state);
    renderCalendar();
    renderDrawer();

    let undone = false;
    toast('Event deleted. Press Ctrl/Cmd+Z to undo');

    const onUndo = (e) => {
      const z = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
      if (!z || undone) return;
      undone = true;
      state.events.splice(idx, 0, removed);
      persist(state);
      renderCalendar();
      renderDrawer();
      toast('Undo: event restored');
      window.removeEventListener('keydown', onUndo);
    };
    window.addEventListener('keydown', onUndo);
    setTimeout(() => window.removeEventListener('keydown', onUndo), 5500);
  };

  addEventBtn.addEventListener('click', () => openEventModal('new', '', state.ui.calendar.selectedDate));

  // -------- Modal close behavior --------
  const wireModal = (modalEl) => {
    modalEl.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close === 'true') closeModal(modalEl);
      if (t && t.classList && t.classList.contains('modal__backdrop')) closeModal(modalEl);
    });
  };
  [taskModal, catModal, eventModal].forEach(wireModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!taskModal.hidden) closeModal(taskModal);
      if (!catModal.hidden) closeModal(catModal);
      if (!eventModal.hidden) closeModal(eventModal);
    }
  });

  // -------- Import / Export --------
  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      categories: state.categories,
      tasks: state.tasks,
      events: state.events
    };
    const blob = new Blob([safeJSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focusflow-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Exported JSON');
  };

  const importData = async (file) => {
    const text = await file.text();
    const obj = safeJSON.parse(text, null);
    if (!obj || typeof obj !== 'object') return toast('Invalid JSON');
    const categories = Array.isArray(obj.categories) ? obj.categories : null;
    const tasks = Array.isArray(obj.tasks) ? obj.tasks : null;
    const events = Array.isArray(obj.events) ? obj.events : null;
    if (!categories || !tasks || !events) return toast('Import missing fields');

    // Merge carefully (replace all) while cleaning via load-style sanitizer.
    localStorage.setItem(STORE.categories, safeJSON.stringify(categories));
    localStorage.setItem(STORE.tasks, safeJSON.stringify(tasks));
    localStorage.setItem(STORE.events, safeJSON.stringify(events));

    // Reload into state
    const fresh = load();
    state.categories = fresh.categories;
    state.tasks = fresh.tasks;
    state.events = fresh.events;

    persist(state);
    renderAll();
    toast('Imported successfully');
  };

  exportBtn.addEventListener('click', exportData);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importData(file);
    importFile.value = '';
  });

  // -------- Init --------
  const renderAll = () => {
    renderCategoryOptions();
    renderTasks();
    renderCalendar();
    renderDrawer();
    setFilter(state.ui.taskFilter);
    setPage(state.ui.page);
  };

  filterBtns.forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));

  // Ensure selected date is valid ISO-like
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.ui.calendar.selectedDate)) {
    state.ui.calendar.selectedDate = todayISO();
  }

  initPager();
  renderAll();

})();
