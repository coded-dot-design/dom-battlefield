/** Small, lifecycle-bound affordances for the three planning cards. Navigation keeps using the
 * client's data-open handlers, including its loadout budget and route-commit checks. */
export function bindPlanningCards(
  root: HTMLElement,
  signal: AbortSignal,
  onFold: () => void = () => {},
): { reset(): void } {
  const keys = [...root.querySelectorAll<HTMLButtonElement>(".bf-fold-key")];

  function setFolded(key: HTMLButtonElement, folded: boolean) {
    const card = key.closest<HTMLElement>(".bf-card");
    if (!card) return;
    card.classList.toggle("folded", folded);
    if (folded) card.classList.remove("hinting");
    key.setAttribute("aria-expanded", String(!folded));
    key.setAttribute("aria-label", `${folded ? "Expand" : "Shrink"} ${key.dataset.foldLabel || "planning"} card`);
    key.dataset.foldTip = folded ? "Click to expand" : "Click to shrink";
  }

  for (const key of keys) {
    // Native buttons provide one activation for mouse, touch, Enter and Space. Their pointer
    // presses are excluded from card dragging; the dedicated grips remain available.
    key.addEventListener("click", (event) => {
      event.stopPropagation();
      setFolded(key, !key.closest(".bf-card")?.classList.contains("folded"));
      onFold();
    }, { signal });
  }

  // Planning is still an active game session. Keep its global Enter/Space shortcuts from
  // cancelling native keyboard activation of these card controls.
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target instanceof Element && event.target.closest(".bf-fold-key, [data-card-step]")) event.stopPropagation();
  }, { signal });

  // Runs after the existing button's data-open handler. Move keyboard focus only when that
  // navigation actually succeeded; an over-budget loadout keeps focus on the current card.
  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-card-step]") : null;
    if (!target || !root.contains(target)) return;
    const name = target.dataset.open;
    const card = root.querySelector<HTMLElement>(name === "plan" ? "#bf-cmd" : `#bf-card-${name}`);
    const key = card?.querySelector<HTMLButtonElement>(".bf-fold-key");
    if (!card || card.hidden || !key) return;
    setFolded(key, false);
    if ((event as MouseEvent).detail === 0) key.focus({ preventScroll: true });
  }, { signal });

  return {
    reset() {
      for (const key of keys) {
        setFolded(key, false);
        key.closest(".bf-card")?.classList.remove("hinting");
      }
    },
  };
}
