// Freeze the complete submitted snapshot while its acknowledgement is pending.
// Restoring the previous disabled state preserves conditional-field rules.
export function lockFormForSave(form) {
  if (!form) return () => {};
  const controls = [...form.querySelectorAll('input,select,textarea,button')].map(control => ({ control, disabled: control.disabled }));
  const previousBusy = form.getAttribute('aria-busy');
  form.setAttribute('aria-busy', 'true');
  for (const { control } of controls) control.disabled = true;
  return () => {
    for (const { control, disabled } of controls) control.disabled = disabled;
    if (previousBusy === null) form.removeAttribute('aria-busy');
    else form.setAttribute('aria-busy', previousBusy);
  };
}
