import { deleteEdge } from "@/api/edges";

type Props = {
  edgeId: string;
  updatedAt: string;
  onDeleted: () => void;
  onError: (msg: string) => void;
};

export function DeleteEdgeButton({
  edgeId,
  updatedAt,
  onDeleted,
  onError,
}: Props) {
  async function submit() {
    try {
      await deleteEdge(edgeId, updatedAt);
      onDeleted();
    } catch (e: any) {
      onError(e?.message ?? String(e));
    }
  }

  return (
    <button
      className="mt-3 rounded border px-3 py-1 text-sm"
      onClick={submit}
      title="Tar bort relationen permanent"
    >
      Ta bort relation
    </button>
  );
}
