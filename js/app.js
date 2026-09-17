(function () {
  "use strict";

  var STORAGE_KEY = "englishup_state_v1";
  var LEVELS = ["beginner", "intermediate", "advanced"];
  var LEVEL_LABEL = { beginner: "초급", intermediate: "중급", advanced: "고급" };

  var words = WORD_DATA.map(function (w, i) {
    return Object.assign({ id: i }, w);
  });

  // ---------- State ----------
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { learned: {}, todayDate: todayStr(), todayWords: [], streak: 0, lastStudyDate: null };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  var state = loadState();
  if (!state.learned) state.learned = {};
  if (state.todayDate !== todayStr()) {
    state.todayDate = todayStr();
    state.todayWords = [];
  }
  if (!state.todayWords) state.todayWords = [];

  function recordActivity(word) {
    var today = todayStr();
    if (state.lastStudyDate !== today) {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (state.lastStudyDate === yesterday) {
        state.streak = (state.streak || 0) + 1;
      } else {
        state.streak = 1;
      }
      state.lastStudyDate = today;
      state.todayDate = today;
      state.todayWords = [];
    }
    if (state.todayWords.indexOf(word) === -1) state.todayWords.push(word);
    saveState();
  }

  function markLearned(word) {
    state.learned[word] = true;
    recordActivity(word);
    refreshStatsEverywhere();
  }

  function markUnlearned(word) {
    delete state.learned[word];
    recordActivity(word);
    refreshStatsEverywhere();
  }

  function toggleLearned(word) {
    if (state.learned[word]) markUnlearned(word);
    else markLearned(word);
  }

  // ---------- Utilities ----------
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function byLevel(level) {
    if (level === "all") return words;
    return words.filter(function (w) { return w.level === level; });
  }

  // ---------- View switching ----------
  var tabBtns = document.querySelectorAll(".tab-btn");
  var views = document.querySelectorAll(".view");

  function showView(name) {
    views.forEach(function (v) { v.classList.toggle("active", v.id === "view-" + name); });
    tabBtns.forEach(function (b) { b.classList.toggle("active", b.dataset.view === name); });
    if (name === "home") renderHome();
    if (name === "flashcard") renderFlashcardView();
    if (name === "wordlist") renderWordList();
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { showView(btn.dataset.view); });
  });

  function refreshStatsEverywhere() {
    if (document.getElementById("view-home").classList.contains("active")) renderHome();
    if (document.getElementById("view-wordlist").classList.contains("active")) renderWordList();
  }

  // ---------- HOME ----------
  function renderHome() {
    var total = words.length;
    var learnedCount = Object.keys(state.learned).filter(function (w) {
      return words.some(function (x) { return x.word === w; });
    }).length;
    var todayCount = state.todayDate === todayStr() ? state.todayWords.length : 0;

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-learned").textContent = learnedCount;
    document.getElementById("stat-today").textContent = todayCount;
    document.getElementById("stat-streak").textContent = (state.streak || 0) + "일";

    var pct = total ? Math.round((learnedCount / total) * 100) : 0;
    document.getElementById("progress-percent").textContent = pct + "%";
    document.getElementById("home-progress-bar").style.width = pct + "%";

    LEVELS.forEach(function (lvl) {
      var levelWords = byLevel(lvl);
      var learnedInLevel = levelWords.filter(function (w) { return state.learned[w.word]; }).length;
      document.getElementById("count-" + lvl).textContent = learnedInLevel + "/" + levelWords.length;
    });
  }

  document.querySelectorAll(".level-card").forEach(function (card) {
    card.addEventListener("click", function () {
      flashcardState.level = card.dataset.level;
      showView("flashcard");
      setFilterActive("flashcard-level-filter", card.dataset.level);
    });
  });

  document.getElementById("home-start-flashcard").addEventListener("click", function () {
    showView("flashcard");
  });
  document.getElementById("home-start-quiz").addEventListener("click", function () {
    showView("quiz");
  });

  function setFilterActive(groupId, level) {
    var group = document.getElementById(groupId);
    group.querySelectorAll(".filter-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.level === level);
    });
  }

  // ---------- FLASHCARD ----------
  var flashcardState = { level: "all", unlearnedOnly: false, pool: [], index: 0 };

  function computeFlashcardPool() {
    var pool = byLevel(flashcardState.level);
    if (flashcardState.unlearnedOnly) {
      pool = pool.filter(function (w) { return !state.learned[w.word]; });
    }
    return pool;
  }

  function renderFlashcardView() {
    flashcardState.pool = computeFlashcardPool();
    if (flashcardState.index >= flashcardState.pool.length) flashcardState.index = 0;
    renderFlashcard();
  }

  function renderFlashcard() {
    var pool = flashcardState.pool;
    var card = document.getElementById("flashcard");
    var empty = document.getElementById("flashcard-empty");
    var controls = document.querySelector(".flashcard-controls");

    if (!pool.length) {
      card.style.display = "none";
      controls.style.display = "none";
      empty.hidden = false;
      document.getElementById("flashcard-position").textContent = "0 / 0";
      document.getElementById("flashcard-progress-bar").style.width = "0%";
      return;
    }
    card.style.display = "";
    controls.style.display = "";
    empty.hidden = true;

    card.classList.remove("flipped");
    var w = pool[flashcardState.index];
    document.getElementById("fc-level-badge").textContent = LEVEL_LABEL[w.level];
    document.getElementById("fc-word").textContent = w.word;
    document.getElementById("fc-pos").textContent = w.pos;
    document.getElementById("fc-meaning").textContent = w.meaning;
    document.getElementById("fc-example").textContent = w.example;
    document.getElementById("fc-example-ko").textContent = w.exampleKo;

    document.getElementById("flashcard-position").textContent =
      (flashcardState.index + 1) + " / " + pool.length;
    var pct = Math.round(((flashcardState.index + 1) / pool.length) * 100);
    document.getElementById("flashcard-progress-bar").style.width = pct + "%";
  }

  document.getElementById("flashcard").addEventListener("click", function () {
    this.classList.toggle("flipped");
  });

  document.getElementById("fc-prev").addEventListener("click", function () {
    if (!flashcardState.pool.length) return;
    flashcardState.index = (flashcardState.index - 1 + flashcardState.pool.length) % flashcardState.pool.length;
    renderFlashcard();
  });

  document.getElementById("fc-next").addEventListener("click", function () {
    if (!flashcardState.pool.length) return;
    flashcardState.index = (flashcardState.index + 1) % flashcardState.pool.length;
    renderFlashcard();
  });

  function advanceAfterAnswer() {
    var pool = computeFlashcardPool();
    flashcardState.pool = pool;
    if (!pool.length) { renderFlashcard(); return; }
    if (flashcardState.index >= pool.length) flashcardState.index = 0;
    renderFlashcard();
  }

  document.getElementById("fc-know").addEventListener("click", function () {
    var pool = flashcardState.pool;
    if (!pool.length) return;
    var w = pool[flashcardState.index];
    markLearned(w.word);
    if (!flashcardState.unlearnedOnly) {
      flashcardState.index = (flashcardState.index + 1) % Math.max(pool.length, 1);
    }
    advanceAfterAnswer();
  });

  document.getElementById("fc-dontknow").addEventListener("click", function () {
    var pool = flashcardState.pool;
    if (!pool.length) return;
    var w = pool[flashcardState.index];
    markUnlearned(w.word);
    flashcardState.index = flashcardState.pool.length ? (flashcardState.index + 1) % flashcardState.pool.length : 0;
    advanceAfterAnswer();
  });

  document.getElementById("flashcard-level-filter").addEventListener("click", function (e) {
    var btn = e.target.closest(".filter-btn");
    if (!btn) return;
    flashcardState.level = btn.dataset.level;
    flashcardState.index = 0;
    setFilterActive("flashcard-level-filter", btn.dataset.level);
    renderFlashcardView();
  });

  document.getElementById("flashcard-unlearned-only").addEventListener("change", function (e) {
    flashcardState.unlearnedOnly = e.target.checked;
    flashcardState.index = 0;
    renderFlashcardView();
  });

  // ---------- QUIZ ----------
  var quizState = { level: "all", count: 10, questions: [], index: 0, score: 0 };

  document.getElementById("quiz-level-filter").addEventListener("click", function (e) {
    var btn = e.target.closest(".filter-btn");
    if (!btn) return;
    quizState.level = btn.dataset.level;
    setFilterActive("quiz-level-filter", btn.dataset.level);
  });

  document.getElementById("quiz-count").addEventListener("change", function (e) {
    quizState.count = parseInt(e.target.value, 10);
  });

  function buildQuestions() {
    var pool = byLevel(quizState.level);
    if (pool.length < 4) pool = words; // not enough for distractors
    var count = Math.min(quizState.count, pool.length);
    var picked = shuffle(pool).slice(0, count);
    return picked.map(function (w) {
      var distractorSource = words.filter(function (x) { return x.word !== w.word && x.meaning !== w.meaning; });
      var distractors = shuffle(distractorSource).slice(0, 3).map(function (x) { return x.meaning; });
      var options = shuffle([w.meaning].concat(distractors));
      return { word: w, options: options, answer: w.meaning };
    });
  }

  document.getElementById("quiz-start-btn").addEventListener("click", function () {
    quizState.questions = buildQuestions();
    quizState.index = 0;
    quizState.score = 0;
    document.getElementById("quiz-setup").hidden = true;
    document.getElementById("quiz-result").hidden = true;
    document.getElementById("quiz-play").hidden = false;
    renderQuizQuestion();
  });

  function renderQuizQuestion() {
    var qs = quizState.questions;
    var q = qs[quizState.index];
    document.getElementById("quiz-position").textContent =
      "문제 " + (quizState.index + 1) + " / " + qs.length;
    document.getElementById("quiz-score").textContent = "정답 " + quizState.score;
    var pct = Math.round((quizState.index / qs.length) * 100);
    document.getElementById("quiz-progress-bar").style.width = pct + "%";
    document.getElementById("quiz-word").textContent = q.word.word;

    var optsEl = document.getElementById("quiz-options");
    optsEl.innerHTML = "";
    document.getElementById("quiz-next-btn").hidden = true;

    q.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.className = "quiz-option-btn";
      btn.textContent = opt;
      btn.addEventListener("click", function () { handleQuizAnswer(opt, btn); });
      optsEl.appendChild(btn);
    });
  }

  function handleQuizAnswer(selected, btnEl) {
    var q = quizState.questions[quizState.index];
    var correct = selected === q.answer;
    var allBtns = document.querySelectorAll("#quiz-options .quiz-option-btn");
    allBtns.forEach(function (b) {
      b.disabled = true;
      if (b.textContent === q.answer) b.classList.add("correct");
      else if (b === btnEl) b.classList.add("wrong");
    });

    if (correct) {
      quizState.score++;
      markLearned(q.word.word);
    } else {
      recordActivity(q.word.word);
    }
    document.getElementById("quiz-score").textContent = "정답 " + quizState.score;
    document.getElementById("quiz-next-btn").hidden = false;
  }

  document.getElementById("quiz-next-btn").addEventListener("click", function () {
    quizState.index++;
    if (quizState.index >= quizState.questions.length) {
      showQuizResult();
    } else {
      renderQuizQuestion();
    }
  });

  function showQuizResult() {
    document.getElementById("quiz-play").hidden = true;
    document.getElementById("quiz-result").hidden = false;
    var total = quizState.questions.length;
    var score = quizState.score;
    document.getElementById("result-score").textContent = score + " / " + total;
    var pct = total ? Math.round((score / total) * 100) : 0;
    var msg;
    if (pct === 100) msg = "완벽해요! 모든 문제를 맞혔어요 🎉";
    else if (pct >= 70) msg = "훌륭해요! 조금만 더 연습하면 완벽해요 👍";
    else if (pct >= 40) msg = "잘 하고 있어요. 계속 연습해봐요 💪";
    else msg = "괜찮아요, 플래시카드로 더 복습해봐요 📚";
    document.getElementById("result-message").textContent = msg;
  }

  document.getElementById("quiz-retry-btn").addEventListener("click", function () {
    document.getElementById("quiz-result").hidden = true;
    document.getElementById("quiz-setup").hidden = false;
  });
  document.getElementById("quiz-home-btn").addEventListener("click", function () {
    document.getElementById("quiz-result").hidden = true;
    document.getElementById("quiz-setup").hidden = false;
    showView("home");
  });

  // ---------- WORD LIST ----------
  var wordlistState = { level: "all", search: "" };

  document.getElementById("wordlist-level-filter").addEventListener("click", function (e) {
    var btn = e.target.closest(".filter-btn");
    if (!btn) return;
    wordlistState.level = btn.dataset.level;
    setFilterActive("wordlist-level-filter", btn.dataset.level);
    renderWordList();
  });

  document.getElementById("wordlist-search").addEventListener("input", function (e) {
    wordlistState.search = e.target.value.trim().toLowerCase();
    renderWordList();
  });

  function renderWordList() {
    var pool = byLevel(wordlistState.level);
    if (wordlistState.search) {
      pool = pool.filter(function (w) {
        return w.word.toLowerCase().indexOf(wordlistState.search) !== -1 ||
          w.meaning.indexOf(wordlistState.search) !== -1;
      });
    }
    var container = document.getElementById("wordlist-table");
    container.innerHTML = "";

    if (!pool.length) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "검색 결과가 없어요.";
      container.appendChild(empty);
      return;
    }

    pool.forEach(function (w) {
      var row = document.createElement("div");
      row.className = "wordlist-row";

      var main = document.createElement("div");
      main.className = "wl-main";
      main.innerHTML =
        '<span class="wl-word">' + escapeHtml(w.word) + '</span>' +
        '<span class="wl-pos">' + escapeHtml(w.pos) + '</span>' +
        '<div class="wl-meaning">' + escapeHtml(w.meaning) + '</div>';

      var learned = !!state.learned[w.word];
      var badge = document.createElement("button");
      badge.className = "wl-badge " + (learned ? "learned" : "unlearned");
      badge.textContent = learned ? "학습완료" : "미학습";
      badge.addEventListener("click", function () {
        toggleLearned(w.word);
        renderWordList();
      });

      row.appendChild(main);
      row.appendChild(badge);
      container.appendChild(row);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Init ----------
  renderHome();
  renderFlashcardView();
})();
