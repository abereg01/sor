export function isTypingTarget(el: EventTarget | null): boolean {
  const a = el as HTMLElement | null;
  if (!a) return false;

  const tag = (a.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;

  const role = a.getAttribute("role") || "";
  if (role === "textbox" || role === "combobox") return true;

  const editable = a.getAttribute("contenteditable");
  if (editable === "" || editable === "true") return true;

  return false;
}
