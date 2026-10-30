// src/announce.ts: one polite region per document, rate-limited and coalesced (the contract of
// Fizlet's fizlet/announce brick). A tiny fake document stands in for the DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { announcer } from "../src/announce.ts";

function fakeDoc() {
  const body = { children: [], append(n) { n.parent = body; this.children.push(n); } };
  const doc = {
    body,
    writes: [],
    createElement(tag) {
      const attrs = new Map();
      let text = "";
      const n = {
        tag, style: {}, parent: null,
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => attrs.get(k) ?? null,
        hasAttribute: (k) => attrs.has(k),
        get isConnected() { return n.parent !== null; },
        get textContent() { return text; },
        set textContent(v) { text = v; doc.writes.push(v); },
        remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; },
      };
      return n;
    },
    querySelector(sel) {
      assert.equal(sel, "[data-fz-announce]");
      return body.children.find((n) => n.hasAttribute("data-fz-announce")) ?? null;
    },
  };
  return doc;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("the region: lazy, shared, polite, atomic, visually hidden, removed by its creator", () => {
  const doc = fakeDoc(), a = announcer({ doc }), b = announcer({ doc });
  assert.equal(doc.body.children.length, 0, "nothing until the first write");
  a.say("turn", "Battle on");
  b.say("turn", "Paused");
  const [r] = doc.body.children;
  assert.equal(doc.body.children.length, 1, "one region per document");
  assert.equal(r.getAttribute("role"), "status");
  assert.equal(r.getAttribute("aria-live"), "polite");
  assert.equal(r.getAttribute("aria-atomic"), "true");
  assert.match(r.style.cssText, /clip-path:inset\(50%\)/);
  assert.match(r.style.cssText, /width:1px/);
  assert.doesNotMatch(r.style.cssText, /display:\s*none/);
  b.destroy();
  assert.equal(doc.body.children.length, 1, "a borrower leaves the region");
  a.destroy();
  assert.equal(doc.body.children.length, 0, "its creator removes it");
});

test("coalescing: a newer text replaces the pending one; pending keys join in first-queued order", async () => {
  const doc = fakeDoc(), a = announcer({ doc, gap: 0.08 });
  a.say("turn", "Planning");
  assert.deepEqual(doc.writes, ["Planning"], "the first write goes out at once");
  a.say("units", "Friendly 4 of 4");
  a.say("turn", "Battle on");
  a.say("units", "Friendly 3 of 4");
  a.say("status", "Game over");
  assert.equal(doc.writes.length, 1, "held for the gap");
  await wait(120);
  assert.deepEqual(doc.writes, ["Planning", "Friendly 3 of 4. Battle on. Game over"]);
  a.destroy();
});

test("rate limit: at most one write per gap; flush writes now; destroy clears the timer", async () => {
  const doc = fakeDoc(), a = announcer({ doc, gap: 0.1 });
  a.say("k", "one");
  for (let i = 0; i < 20; i++) a.say("k", `n${i}`);
  await wait(50);
  assert.equal(doc.writes.length, 1);
  await wait(80);
  assert.deepEqual(doc.writes, ["one", "n19"]);
  a.say("status", "You win");
  a.flush();
  assert.equal(doc.writes.at(-1), "You win", "flush is prompt");
  a.say("k", "later");
  a.destroy();
  await wait(150);
  assert.equal(doc.writes.at(-1), "You win", "no write after destroy");
});

test("the same text again is announced again (a trailing space toggles)", async () => {
  const doc = fakeDoc(), a = announcer({ doc, gap: 0.03 });
  a.say("k", "Paused");
  await wait(40);
  a.say("k", "Paused");
  await wait(40);
  a.say("k", "Paused");
  await wait(40);
  assert.deepEqual(doc.writes, ["Paused", "Paused ", "Paused"]);
  a.destroy();
});
