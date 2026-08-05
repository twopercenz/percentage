"use client";

import { useEffect } from "react";

const SEARCH_INPUT_ID = "site-search-input";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
  );
}

// GitHub 등 개발 도구에서 흔한 "/" 검색 포커스 단축키. 입력 중일 땐 가로채지 않는다.
export function SearchShortcut() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || isTypingTarget(event.target)) return;
      event.preventDefault();
      document.getElementById(SEARCH_INPUT_ID)?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}

export { SEARCH_INPUT_ID };
