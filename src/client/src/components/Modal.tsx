import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

/** 모달 내부에서 포커스 가능한 요소 목록을 반환한다. */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex >= 0);
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 모달이 열리기 전 포커스를 가지고 있던 요소 — 닫힐 때 복원한다.
  const prevFocusRef = useRef<Element | null>(null);

  // 포커스 저장/복원·초기 포커스는 open 토글에만 의존한다. onClose 가 인라인(매 렌더 새 함수)
  // 이어도 이 effect가 재실행되어 포커스가 튀지 않도록 keydown 등록과 분리한다.
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = getFocusableElements(dialog);
      (focusable[0] ?? dialog).focus();
    }
    return () => {
      // 모달이 닫힐 때 이전 포커스 복원
      if (prevFocusRef.current instanceof HTMLElement) prevFocusRef.current.focus();
    };
  }, [open]);

  // Esc 닫기 + Tab 포커스 트랩 — onClose 를 참조하므로 별도 effect(리스너만 재등록).
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialog) {
        const focusable = getFocusableElements(dialog);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[85vh] overflow-y-auto rounded-2xl border border-hairline bg-canvas p-6 shadow-md ${
          wide ? "w-full max-w-3xl" : "w-full max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-soft hover:text-ink"
            aria-label="닫기"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
