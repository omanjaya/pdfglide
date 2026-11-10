'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Copy text; `copied` is true for 2s afterwards. Works on non-secure origins via a textarea fallback. */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch {
          ok = false;
        }
      }
      setCopied(ok);
      setFailed(!ok);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        setFailed(false);
      }, resetMs);
      return ok;
    },
    [resetMs]
  );

  return { copy, copied, failed };
}
