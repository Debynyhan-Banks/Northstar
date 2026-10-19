export function focusWorkspaceTarget(targetId, documentRoot = globalThis.document) {
  const target = targetId ? documentRoot?.getElementById?.(targetId) : null;
  if (!target) return false;
  for (let element = target; element; element = element.parentElement) {
    if (element.tagName === 'DETAILS') element.open = true;
  }
  if (!target.hasAttribute?.('tabindex')) target.setAttribute?.('tabindex', '-1');
  target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  target.focus?.({ preventScroll: true });
  return true;
}

export function scheduleWorkspaceTarget(targetId, { documentRoot = globalThis.document, scheduleFrame = globalThis.requestAnimationFrame } = {}) {
  if (!targetId || typeof scheduleFrame !== 'function') return false;
  scheduleFrame(() => scheduleFrame(() => focusWorkspaceTarget(targetId, documentRoot)));
  return true;
}
