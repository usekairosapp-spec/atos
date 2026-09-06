import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarDayDialog } from "./calendar-day-dialog";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("janela de equipes do calendário", () => {
  const open = () => render(<CalendarDayDialog title="06 de setembro" closeHref="/painel/calendario?mes=2026-09"><p>Jessika — Copy · Stories</p></CalendarDayDialog>);

  it("abre um diálogo nomeado, mostra funções e restaura a rolagem ao sair", () => {
    const { unmount } = open();
    expect(screen.getByRole("dialog", { name: "06 de setembro" })).toHaveAttribute("open");
    expect(screen.getByText("Jessika — Copy · Stories")).toBeVisible();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("fecha pelo botão preservando o mês e a rolagem", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Fechar escalas do dia" }));
    expect(replace).toHaveBeenCalledWith("/painel/calendario?mes=2026-09", { scroll: false });
  });

  it("fecha ao tocar fora da janela", () => {
    open();
    fireEvent.click(screen.getByRole("dialog"), { clientX: 100, clientY: 100 });
    expect(replace).toHaveBeenCalledOnce();
  });

  it("fecha por Escape e não fecha ao tocar no conteúdo", () => {
    open();
    fireEvent.click(screen.getByText("Jessika — Copy · Stories"));
    expect(replace).not.toHaveBeenCalled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(replace).toHaveBeenCalledOnce();
  });
});
