"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { removeDepartmentMember } from "../actions";

type Props = {
  departmentId: string;
  userId: string;
  memberName: string;
};

export function RemoveMemberButton({ departmentId, userId, memberName }: Props) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-red-700">Remover {memberName}?</span>
        <button
          onClick={() => setIsConfirming(false)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <form action={removeDepartmentMember} className="contents">
          <input type="hidden" name="departmentId" value={departmentId} />
          <input type="hidden" name="userId" value={userId} />
          <button
            className="rounded-lg bg-red-600 px-2 py-1 text-sm font-semibold text-white hover:bg-red-700"
            type="submit"
          >
            Confirmar
          </button>
        </form>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="rounded-lg border border-red-300 bg-red-50 p-2 text-red-700 hover:bg-red-100"
      type="button"
    >
      <X size={18} />
    </button>
  );
}
