'use strict';
(() => {
  const M = window.LessonModel;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const abbreviationMap = new Map(M.abbreviations.map(item => [item.term, item]));
  const abbreviationPattern = new RegExp('(?<![\\p{L}\\p{N}_])(?:' + M.abbreviations
    .map(item => item.term).sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\p{N}_])', 'gu');
  function annotateAbbreviations(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest('abbr,script,style,svg,canvas,code,.glossary')) nodes.push(node);
    }
    nodes.forEach(node => {
      const text = node.textContent;
      const matches = [...text.matchAll(abbreviationPattern)];
      if (!matches.length) return;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      matches.forEach(match => {
        fragment.append(text.slice(offset, match.index));
        const item = abbreviationMap.get(match[0]);
        const abbr = document.createElement('abbr');
        abbr.textContent = item.term;
        abbr.title = `${item.full} — ${item.meaning}`;
        fragment.append(abbr);
        offset = match.index + match[0].length;
      });
      fragment.append(text.slice(offset));
      node.replaceWith(fragment);
    });
  }
  const storageKey = 'opisis:lecture-01:v1';
  let state = M.restoreProgress(null);
  let storageAvailable = true;
  try {
    state = M.restoreProgress(JSON.parse(localStorage.getItem(storageKey) || 'null'));
  } catch { storageAvailable = false; }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { storageAvailable = false; }
    if (!storageAvailable) $('.side-progress p').textContent = 'Сохранение недоступно. Прогресс действует до закрытия страницы.';
  }
  function updateProgress() {
    const done = state.lessonComplete;
    $('#progress-text').textContent = done ? 'Пройдена' : 'Не пройдена';
    $('#progress-fill').style.width = done ? '100%' : '0%';
    const count = Number(done);
    $('.progress-track').setAttribute('aria-valuenow', String(count));
    const button = $('#lesson-complete');
    button.setAttribute('aria-pressed', String(done));
    button.setAttribute('aria-label', done ? 'Лекция пройдена. Нажмите, чтобы снять отметку' : 'Лекция пройдена');
    $('#completion-feedback').textContent = done ? 'Лекция отмечена как пройденная. Повторное нажатие снимет отметку.' : '';
    if (!storageAvailable) $('.side-progress p').textContent = 'Сохранение недоступно. Прогресс действует до закрытия страницы.';
  }
  $('#lesson-complete').addEventListener('click', () => {
    state.lessonComplete = !state.lessonComplete;
    updateProgress(); save();
  });
  $('#reset-progress').addEventListener('click', () => {
    if (!window.confirm('Сбросить отметку о прохождении лекции и ответы самопроверки в этом браузере?')) return;
    state = M.restoreProgress(null); save(); updateProgress(); renderQuiz();
  });
  updateProgress();

  const icons = {
    phone: '<rect x="7" y="2" width="12" height="22" rx="2"/><path d="M11 5h4M12 21h2"/>',
    laptop: '<path d="M4 5h18v13H4zM1 21h24M10 18v3M16 18v3"/>',
    wifi: '<path d="M3 8c6-6 14-6 20 0M6 12c4-4 10-4 14 0M9 16c2-2 6-2 8 0"/><circle cx="13" cy="21" r="1"/>',
    router: '<rect x="3" y="12" width="20" height="10" rx="2"/><path d="M7 12V3M19 12V3M7 17h2M12 17h2M17 17h2"/>',
    server: '<rect x="4" y="2" width="18" height="22" rx="2"/><path d="M4 9h18M4 16h18M8 6h1M8 13h1M8 20h1"/>',
    tower: '<path d="M13 8L6 24M13 8l7 16M8 19h10M10 14h6M8 4c-4 2-4 7 0 9M18 4c4 2 4 7 0 9"/><circle cx="13" cy="7" r="1"/>',
    channel: '<path d="M2 13c4-20 6 20 10 0s6 20 12 0"/>'
  };
  let route = 'wifi';
  let step = 0;
  function renderRoute() {
    const selected = M.routes[route];
    const current = selected.steps[step];
    $('#route-nodes').innerHTML = selected.nodes.map(([icon, title], index) => `<div class="route-node ${index === current.node ? 'active' : index < current.node ? 'visited' : ''}" ${index === current.node ? 'aria-current="step"' : ''}><span class="node-icon"><svg viewBox="0 0 26 26" aria-hidden="true">${icons[icon]}</svg></span><b>${title}</b></div>`).join('');
    $('#route-step-label').textContent = `ЭТАП ${String(step + 1).padStart(2, '0')}`;
    $('#route-step-title').textContent = current.title;
    $('#route-step-description').textContent = current.description;
    annotateAbbreviations($('#route-step-title'));
    annotateAbbreviations($('#route-step-description'));
    $('#route-counter').textContent = `${step + 1} / ${selected.steps.length}`;
    $('#route-prev').disabled = step === 0;
    $('#route-next').disabled = step === selected.steps.length - 1;
    $$('[data-route]').forEach(button => {
      button.classList.toggle('selected', button.dataset.route === route);
      button.setAttribute('aria-pressed', String(button.dataset.route === route));
    });
  }
  $$('[data-route]').forEach(button => button.addEventListener('click', () => { route = button.dataset.route; step = 0; renderRoute(); }));
  $('#route-next').addEventListener('click', () => { if (step < M.routes[route].steps.length - 1) step++; renderRoute(); });
  $('#route-prev').addEventListener('click', () => { if (step > 0) step--; renderRoute(); });
  renderRoute();

  let layer = 1;
  function renderLayer() {
    const current = M.layers.find(item => item.n === layer);
    $('#osi-stack').innerHTML = M.layers.map(item => `<button type="button" data-layer="${item.n}" class="${item.n === layer ? 'selected' : ''}" aria-pressed="${item.n === layer}"><span>${item.n}</span>${item.name}<small>${item.short}</small></button>`).join('');
    $('#osi-detail').innerHTML = `<span class="small-label">УРОВЕНЬ ${current.n} / OSI</span><h3>${current.name}</h3><p>${current.purpose}</p><div class="osi-example"><b>В НАШЕМ ПРИМЕРЕ</b><p>${current.example}</p></div><p><strong>Единица / представление:</strong> ${current.unit}</p><span class="tcpip-tag">TCP/IP → ${current.tcpip}</span>`;
    annotateAbbreviations($('#osi-detail'));
  }
  $('#osi-stack').addEventListener('click', event => {
    const button = event.target.closest('[data-layer]');
    if (!button) return;
    layer = Number(button.dataset.layer); renderLayer();
    $(`[data-layer="${layer}"]`).focus({ preventScroll: true });
  });
  renderLayer();

  const noiseSamples = M.makeNoise(600);
  function drawSignal() {
    const canvas = $('#signal-canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sigma = Number($('#noise').value), gain = Number($('#gain').value), echo = $('#echo').checked;
    $('#noise-value').value = sigma.toFixed(2).replace('.', ',');
    $('#gain-value').value = gain.toFixed(2).replace('.', ',');
    const width = Math.max(1, canvas.clientWidth), height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const pad = 33, right = width - 15, mid = height / 2, scale = (height - 55) / 6;
    ctx.lineWidth = 1; ctx.strokeStyle = '#d7e0ec';
    for (let i = -2; i <= 2; i++) {
      const y = mid - i * scale; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.font = '11px Consolas, monospace'; ctx.fillStyle = '#687d9b'; ctx.fillText(String(i), 12, y + 3);
    }
    for (let i = 0; i <= 10; i++) { const x = pad + (right - pad) * i / 10; ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, height - 22); ctx.stroke(); }
    ctx.fillStyle = '#687d9b'; ctx.fillText('ампл.', 9, 12); ctx.fillText('время, усл. ед.', Math.max(pad, width - 105), height - 5);
    const trace = (color, sample, lineWidth, dash = []) => {
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.setLineDash(dash); ctx.beginPath();
      noiseSamples.forEach((noise, i) => { const t = i / (noiseSamples.length - 1), x = pad + t * (right - pad), y = mid - sample(t, noise) * scale; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    const palette = getComputedStyle(document.documentElement);
    trace(palette.getPropertyValue('--signal-purple').trim(), (t, noise) => M.receivedAt(t, noise, sigma, gain, echo), 1.8);
    trace(palette.getPropertyValue('--signal-blue').trim(), t => M.signalAt(t), 2.4, [7, 4]);
    const notes = [];
    notes.push(sigma === 0 ? 'Добавленный шум отсутствует.' : `Шум: σ = ${sigma.toFixed(2).replace('.', ',')}.`);
    notes.push(gain === 1 ? 'Основной луч не ослаблен.' : `Амплитуда основного луча составляет ${Math.round(gain * 100)}% исходной.`);
    notes.push(echo ? 'Включена задержанная копия: форма сигнала меняется.' : sigma === 0 && gain === 1 ? 'Без искажений кривые совпадают.' : 'Отражённый луч отключён.');
    $('#signal-observation').textContent = notes.join(' ');
  }
  ['noise', 'gain', 'echo'].forEach(id => $(`#${id}`).addEventListener('input', drawSignal));
  $('#signal-reset').addEventListener('click', () => { $('#noise').value = 0.15; $('#gain').value = 1; $('#echo').checked = false; drawSignal(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(drawSignal).observe($('#signal-canvas'));
  else window.addEventListener('resize', drawSignal);
  drawSignal();

  const format = (value, digits = 2) => value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
  function updateCalculator() {
    const rate = Number($('#rate').value), overhead = Number($('#overhead').value), distance = Number($('#distance').value);
    const result = M.calculateLink(rate, overhead, distance);
    $('#rate-value').value = `${rate} Мбит/с`;
    $('#overhead-value').value = `${overhead}%`;
    $('#distance-value').value = `${distance} км`;
    $('#goodput-result').textContent = `${format(result.goodputMbps)} Мбит/с`;
    $('#transmit-result').textContent = `${format(result.transmitMs, 3)} мс`;
    $('#propagate-result').textContent = `${format(result.propagationMs)} мс`;
    $('#calculator-insight').textContent = `Последний бит достигнет конца участка через ${format(result.totalMs, 3)} мс. Увеличение скорости сокращает передачу пакета, но не время распространения сигнала. При этих параметрах ${result.propagationMs > result.transmitMs ? 'больше времени занимает распространение' : 'больше времени занимает передача битов в линию'}.`;
  }
  ['rate', 'overhead', 'distance'].forEach(id => $(`#${id}`).addEventListener('input', updateCalculator));
  updateCalculator();

  function technologyPicture(technology) {
    if (technology === 'ofdm') {
      const curves = [0, 1, 2, 3].map((_, i) => {
        const center = 40 + i * 45;
        return `<path d="M${center - 40} 125 Q${center - 25} 125 ${center - 17} 100 Q${center} 15 ${center + 17} 100 Q${center + 25} 125 ${center + 40} 125" fill="none" stroke="${i % 2 ? 'var(--signal-purple)' : 'var(--signal-blue)'}" stroke-width="2.5" stroke-dasharray="${i % 2 ? 'none' : '6 3'}"/>`;
      }).join('');
      return `<svg viewBox="0 0 230 160" role="img" aria-label="Схематичные перекрывающиеся спектры поднесущих"><path d="M10 125h205" stroke="#6c809d"/>${curves}<text x="16" y="149">поднесущие → частота</text></svg>`;
    }
    return '<svg viewBox="0 0 230 160" role="img" aria-label="Несколько антенн передатчика и приёмника, связанных разными путями"><g fill="none" stroke="#92a1b6" stroke-dasharray="4 4"><path d="M40 40L190 40M40 120L190 120M40 40L190 120M40 120L190 40"/></g><g fill="#e2e8f1" stroke="var(--signal-blue)" stroke-width="2"><circle cx="40" cy="40" r="13"/><circle cx="40" cy="120" r="13"/><circle cx="190" cy="40" r="13"/><circle cx="190" cy="120" r="13"/></g><path d="M54 40L176 40M54 120L176 120" stroke="var(--signal-purple)" stroke-width="2"/><text x="27" y="84">TX</text><text x="179" y="84">RX</text></svg>';
  }
  function renderTechnology(technology) {
    const ofdm = technology === 'ofdm';
    $('#technology-content').innerHTML = `<div class="tech-display"><div class="tech-picture">${technologyPicture(technology)}</div><div><h3>${ofdm ? 'OFDM: ортогональные поднесущие' : 'MIMO: пространственная обработка'}</h3><p>${ofdm ? 'OFDM распределяет данные между ортогональными поднесущими и передаёт их параллельно. В идеальных условиях приёмник разделяет поднесущие, даже когда их спектры перекрываются. В системах с циклическим префиксом он помогает обрабатывать многолучевой канал, если его длительности достаточно.' : 'MIMO использует несколько передающих и приёмных антенн. Это позволяет повысить надёжность за счёт разнесения, передавать разные пространственные потоки или формировать лучи. Возможный выигрыш зависит от канала: добавление антенн само по себе не гарантирует пропорционального роста скорости.'}</p><p class="tech-context">${ofdm ? 'Задача: передача в частотно-селективном канале. Подробнее — лекция 4.' : 'Задача: использование пространственных свойств канала. Подробнее — лекция 4.'}</p></div></div><p class="lab-note">${ofdm ? 'Спектры на рисунке схематичны: их форма не является расчётом ортогональности. OFDM — не способ адресации и не самостоятельная гарантия отсутствия помех.' : 'Линии условно показывают связи между антеннами. Это не рассчитанная диаграмма направленности. MIMO и OFDM могут использоваться совместно.'}</p>`;
    $$('[data-tech]').forEach(button => { button.classList.toggle('selected', button.dataset.tech === technology); button.setAttribute('aria-pressed', String(button.dataset.tech === technology)); });
    annotateAbbreviations($('#technology-content'));
  }
  $$('[data-tech]').forEach(button => button.addEventListener('click', () => renderTechnology(button.dataset.tech)));
  renderTechnology('ofdm');

  function renderQuiz() {
    $('#quiz-questions').innerHTML = M.quiz.map((item, index) => `<fieldset class="quiz-question"><legend><span class="question-number">${String(index + 1).padStart(2, '0')}</span>${item.question}</legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label><input type="radio" name="q${index}" value="${optionIndex}" ${state.answers[index] === optionIndex ? 'checked' : ''}><span>${option}</span></label>`).join('')}</div><p class="quiz-feedback" id="feedback-${index}" hidden></p></fieldset>`).join('');
    $('#quiz-result').hidden = true;
    if (state.submitted) showQuizResult(false);
    annotateAbbreviations($('#quiz-questions'));
  }
  $('#quiz').addEventListener('change', event => {
    if (!event.target.matches('input[type=radio]')) return;
    const index = Number(event.target.name.slice(1));
    state.answers[index] = Number(event.target.value); state.submitted = false;
    $$('.quiz-feedback').forEach(item => { item.hidden = true; });
    $$('.quiz-options label').forEach(item => item.classList.remove('correct', 'incorrect'));
    $('#quiz-result').hidden = true; save();
  });
  function showQuizResult(focus) {
    const result = $('#quiz-result'); result.hidden = false;
    const missing = M.quiz.map((_, i) => i).filter(i => !Number.isInteger(state.answers[i]));
    if (missing.length) {
      result.textContent = `Осталось ответить на ${missing.length} из ${M.quiz.length} вопросов. Начните с вопроса ${missing[0] + 1}.`;
      if (focus) $(`input[name="q${missing[0]}"]`).focus();
      return;
    }
    const score = M.scoreQuiz(state.answers);
    M.quiz.forEach((item, index) => {
      const correct = state.answers[index] === item.answer;
      const feedback = $(`#feedback-${index}`);
      feedback.hidden = false; feedback.classList.toggle('wrong', !correct);
      feedback.textContent = `${correct ? 'Верно.' : 'Нужно повторить.'} ${item.explanation}`;
      annotateAbbreviations(feedback);
      $$(`input[name="q${index}"]`).forEach(input => { input.closest('label').classList.toggle('correct', Number(input.value) === item.answer); input.closest('label').classList.toggle('incorrect', input.checked && !correct); });
    });
    result.innerHTML = `<strong>${score} из ${M.quiz.length} — ${score >= 8 ? 'основные понятия усвоены' : 'есть темы для повторения'}</strong><span>${score === M.quiz.length ? 'Все ответы верны. Объясните своими словами последовательность передачи сообщения.' : 'Изучите пояснения к ответам и повторите соответствующие разделы.'}</span>`;
    state.submitted = true; save();
    if (focus) result.focus();
  }
  $('#quiz').addEventListener('submit', event => { event.preventDefault(); showQuizResult(true); });
  $('#quiz-reset').addEventListener('click', () => { state.answers = {}; state.submitted = false; save(); renderQuiz(); });
  renderQuiz();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $$('.chapter-nav a').forEach(link => {
          const active = link.hash === `#${entry.target.id}`;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
    $$('.chapter').forEach(chapter => observer.observe(chapter));
  }
  // Include every layer in the printed lecture, not only the selected one.
  const printAppendix = document.createElement('div');
  printAppendix.className = 'print-appendix';
  printAppendix.innerHTML = M.layers.map(item => `<article><h3>${item.n}. ${item.name}</h3><p>${item.purpose}</p><p>Пример: ${item.example} TCP/IP: ${item.tcpip}.</p></article>`).join('');
  $('.osi-lab').append(printAppendix);
  const printTechnology = document.createElement('div');
  printTechnology.className = 'print-appendix';
  printTechnology.innerHTML = '<article><h3>OFDM</h3><p>Параллельная передача данных на ортогональных поднесущих. При выполнении условий ортогональности приёмник разделяет их, несмотря на перекрывающиеся спектры. Циклический префикс достаточной длительности помогает обрабатывать многолучевой канал.</p></article><article><h3>MIMO</h3><p>Несколько передающих и приёмных антенн позволяют применять разнесение, пространственное мультиплексирование и формирование лучей. Выигрыш зависит от свойств канала и выбранного метода.</p></article>';
  $('.technology-lab').append(printTechnology);
  let printOpenDetails = [];
  window.addEventListener('beforeprint', () => { printOpenDetails = $$('details:not([open])'); printOpenDetails.forEach(item => { item.open = true; }); });
  window.addEventListener('afterprint', () => { printOpenDetails.forEach(item => { item.open = false; }); });
  $('#print-button').addEventListener('click', () => window.print());
  annotateAbbreviations(document.body);
})();
