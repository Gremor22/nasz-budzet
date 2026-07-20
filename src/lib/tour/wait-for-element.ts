export function tourSelector(target: string): string {
  return `[data-tour="${target}"]`;
}

export function waitForElement(
  target: string,
  timeoutMs = 4000,
): Promise<HTMLElement | null> {
  const selector = tourSelector(target);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const started = Date.now();
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
