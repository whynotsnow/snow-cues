import { useCallback, useEffect, useRef, useState } from "react";
import type { GuidanceAction, UserGuidance } from "../guidance";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { GuidancePanel } from "./GuidancePanel";

const STORAGE_KEY_COLLAPSED = "sc-guidance-collapsed";
const STORAGE_KEY_TOP = "sc-guidance-toggle-top";

function getInitialCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COLLAPSED);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage unavailable
  }
  return false;
}

function getInitialToggleTop(): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TOP);
    if (stored !== null) {
      const n = Number(stored);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

type GuidanceDrawerProps = {
  guidance: UserGuidance;
  onAction: (action: GuidanceAction) => void;
};

export function GuidanceDrawer({ guidance, onAction }: GuidanceDrawerProps) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [toggleTop, setToggleTop] = useState<number | null>(
    getInitialToggleTop
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartTop = useRef(0);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  const saveToggleTop = useCallback((top: number) => {
    try {
      localStorage.setItem(STORAGE_KEY_TOP, String(Math.round(top)));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!collapsed) return;
      e.preventDefault();
      hasMovedRef.current = false;
      draggingRef.current = true;
      dragStartY.current = e.clientY;
      dragStartTop.current = toggleTop ?? window.innerHeight / 2 - 40;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = ev.clientY - dragStartY.current;
        if (Math.abs(delta) > 4) {
          hasMovedRef.current = true;
        }
        const next = Math.max(
          0,
          Math.min(window.innerHeight - 80, dragStartTop.current + delta)
        );
        setToggleTop(next);
      };

      const handleMouseUp = () => {
        draggingRef.current = false;
        if (hasMovedRef.current) {
          const btn = buttonRef.current;
          if (btn) {
            const rect = btn.getBoundingClientRect();
            saveToggleTop(rect.top);
          }
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [collapsed, toggleTop, saveToggleTop]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (hasMovedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      toggleCollapsed();
    },
    [toggleCollapsed]
  );

  // reset drag position when window resizes to avoid off-screen
  useEffect(() => {
    const handleResize = () => {
      if (toggleTop !== null && toggleTop > window.innerHeight - 80) {
        setToggleTop(Math.max(0, window.innerHeight - 80));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [toggleTop]);

  const toggleStyle: React.CSSProperties | undefined =
    collapsed && toggleTop !== null
      ? { top: `${toggleTop}px`, transform: "none" }
      : undefined;

  return (
    <aside
      className={`guidance-drawer${collapsed ? "" : " expanded"}`}
      aria-label="操作指引面板"
      aria-expanded={!collapsed}
    >
      <button
        ref={buttonRef}
        className={`guidance-drawer-toggle${collapsed ? " guidance-drawer-toggle-fixed" : ""}`}
        style={toggleStyle}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        type="button"
        aria-label={collapsed ? "展开操作指引" : "收起操作指引"}
      >
        <span className="guidance-drawer-toggle-label">
          {collapsed ? "操作指引" : "收起指引"}
        </span>
        <span className="guidance-drawer-toggle-icon">
          {collapsed ? (
            <ChevronLeftIcon size={16} />
          ) : (
            <ChevronRightIcon size={16} />
          )}
        </span>
      </button>
      {!collapsed && (
        <div className="guidance-drawer-body">
          <GuidancePanel guidance={guidance} onAction={onAction} />
        </div>
      )}
    </aside>
  );
}
