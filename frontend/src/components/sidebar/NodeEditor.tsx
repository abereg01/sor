import { useState } from "react";
import { updateNode } from "@/api/nodes";
import { ConcurrencyError } from "@/components/errors/ConcurrencyError";
import type { ApiError } from "@/api/http";

export function NodeEditor({ node }: { node: any }) {
  const [name, setName] = useState(node.name);
  const [error, setError] = useState<ApiError | null>(null);

  async function save() {
    try {
      await updateNode(node.id, { name });
      setError(null);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409 || err.status === 428) {
        setError(err);
      } else {
        throw e;
      }
    }
  }

  if (error) {
    return (
      <ConcurrencyError
        message={error.message}
        onReload={() => window.location.reload()}
      />
    );
  }

  return (
    <>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input"
      />
      <button onClick={save} className="btn-primary">
        Spara
      </button>
    </>
  );
}
