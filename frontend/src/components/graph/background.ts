export function graphBackgroundCss(): string {
  return (
    "linear-gradient(180deg, var(--panel-bg-2), var(--panel-bg)), " +
    "repeating-linear-gradient(0deg, var(--graph-grid-line-a) 0, var(--graph-grid-line-a) 1px, var(--graph-grid-line-off) 1px, var(--graph-grid-line-off) 28px), " +
    "repeating-linear-gradient(90deg, var(--graph-grid-line-b) 0, var(--graph-grid-line-b) 1px, var(--graph-grid-line-off) 1px, var(--graph-grid-line-off) 28px), " +
    "radial-gradient(900px 600px at 18% 18%, var(--graph-radial-a), var(--graph-grid-line-off) 58%), " +
    "radial-gradient(900px 700px at 82% 82%, var(--graph-radial-b), var(--graph-grid-line-off) 58%)"
  );
}
