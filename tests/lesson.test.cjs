const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../lesson-model.js');

test('100 Мбит/с, 20% служебных битов, 1000 км: единицы и ожидаемые значения', () => {
  const result = M.calculateLink(100, 20, 1000);
  assert.equal(result.goodputMbps, 80);
  assert.ok(Math.abs(result.transmitMs - 0.12) < 1e-12);
  assert.equal(result.propagationMs, 5);
  assert.equal(result.totalMs, 5.12);
});
test('рост скорости сокращает сериализацию, но сохраняет распространение', () => {
  const a = M.calculateLink(100, 0, 1000), b = M.calculateLink(1000, 0, 1000);
  assert.equal(a.transmitMs / b.transmitMs, 10);
  assert.equal(a.propagationMs, b.propagationMs);
  assert.equal(M.calculateLink(10, 50, 0).goodputMbps, 5);
  assert.throws(() => M.calculateLink(0, 20, 1000), RangeError);
  assert.throws(() => M.calculateLink(100, 101, 1000), RangeError);
});
test('нулевой шум, единичный коэффициент и отсутствие отражения сохраняют сигнал', () => {
  for (let i = 0; i <= 100; i++) assert.equal(M.receivedAt(i / 100, 2, 0, 1, false), M.signalAt(i / 100));
});
test('отражение причинно: копии до задержки нет; затухание масштабирует сигнал', () => {
  assert.equal(M.receivedAt(0.05, 0, 0, 1, true), M.signalAt(0.05));
  assert.equal(M.receivedAt(0.2, 0, 0, 0.5, false), 0.5 * M.signalAt(0.2));
  assert.equal(M.receivedAt(0.2, 0, 0, 1, true), M.signalAt(0.2) + 0.4 * M.signalAt(0.1));
});
test('шум воспроизводим, конечен и близок к единичной дисперсии', () => {
  assert.deepEqual(M.makeNoise(20), M.makeNoise(20));
  const samples = M.makeNoise(10000);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
  assert.ok(samples.every(Number.isFinite));
  assert.ok(Math.abs(mean) < 0.04);
  assert.ok(Math.abs(variance - 1) < 0.07);
});
test('каждый сценарий заканчивается получателем и содержит допустимые узлы', () => {
  for (const route of Object.values(M.routes)) {
    assert.equal(route.steps.at(-1).node, route.nodes.length - 1);
    assert.ok(route.steps.every(step => step.node >= 0 && step.node < route.nodes.length));
  }
  assert.deepEqual(M.layers.map(layer => layer.n), [7, 6, 5, 4, 3, 2, 1]);
});
test('самопроверка оценивает ответы, допускает неполный набор без ложного успеха', () => {
  assert.equal(M.scoreQuiz({}), 0);
  assert.equal(M.scoreQuiz(M.quiz.map(item => item.answer)), 10);
  assert.equal(M.scoreQuiz(M.quiz.map(item => (item.answer + 1) % item.options.length)), 0);
  for (const item of M.quiz) assert.ok(item.answer >= 0 && item.answer < item.options.length && item.explanation);
});
test('внутренние якоря, идентификаторы разделов и локальные ресурсы существуют', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'идентификаторы должны быть уникальны');
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `Отсутствует якорь ${match[1]}`);
  for (const chapter of M.chapters) assert.ok(ids.includes(chapter));
  for (const match of html.matchAll(/(?:src|href)="([^"#][^"]+)"/g)) {
    if (/^https?:/.test(match[1])) continue;
    assert.ok(fs.existsSync(path.join(__dirname, '..', match[1].split(/[?#]/)[0])), `Отсутствует ресурс ${match[1]}`);
  }
});

test('переход от отметок разделов к статусу лекции сохраняет ответы', () => {
  const answers = Object.fromEntries(M.quiz.map((item, i) => [i, item.answer]));
  const partial = M.restoreProgress({ completed: ['basics'], answers, submitted: true });
  assert.equal(partial.lessonComplete, false);
  assert.deepEqual(partial.answers, answers);
  assert.equal(partial.submitted, true);
  assert.equal(M.restoreProgress({ completed: M.chapters }).lessonComplete, true);
  assert.equal(M.restoreProgress({ lessonComplete: false, completed: M.chapters }).lessonComplete, false);
  assert.equal(M.restoreProgress({ lessonComplete: true }).lessonComplete, true);
  assert.deepEqual(M.restoreProgress(null), { lessonComplete: false, answers: {}, submitted: false });
});

test('в лекции одна финальная отметка и краткий словарь из восьми статей', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.equal((html.match(/id="lesson-complete"/g) || []).length, 1);
  assert.equal(html.includes('data-complete='), false);
  assert.equal(html.includes('Отметить раздел изученным'), false);
  assert.equal((html.match(/<dt>/g) || []).length, 8);
  assert.equal(html.includes('class="glossary abbreviations"'), false);
  for (const term of ['Бит', 'Символ', 'Кадр / пакет', 'Протокол', 'MAC / IP', 'DL / UL', 'Модуляция', 'Эквализация'])
    assert.ok(html.includes(`<dt>${term}</dt>`), `Отсутствует статья ${term}`);
});
