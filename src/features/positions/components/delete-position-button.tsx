"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deletePosition } from "../actions";

type Props = {
  departmentId: string;
  positionId: string;
  positionName: string;
};

export function DeletePositionButton({ departmentId, positionId, positionName }: Props) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-red-700">Excluir {positionName}?</span>
        <button
          onClick={() => setIsConfirming(false)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          type="button"
        >
          Cancelar
        </button>
        <form action={deletePosition} className="contents">
          <input type="hidden" name="departmentId" value={departmentId} />
          <input type="hidden" name="positionId" value={positionId} />
          <button
            className="rounded-lg bg-red-600 px-2 py-1 text-sm font-semibold text-white hover:bg-red-700"
            type="submit"
          >
            Confirmar exclusão
          </button>
        </form>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="flex items-center gap-1 text-sm font-semibold text-red-700"
      type="button"
    >
      <Trash2 size={15} />
      Excluir função
    </button>
  );
}
