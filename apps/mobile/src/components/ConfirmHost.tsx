import { ConfirmSheet } from '@hangul-route/design-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { setConfirmPresenter, type ConfirmOptions } from '../platform/dialog';
import { useHistorySheet } from '../platform/history-bridge';

interface Request {
  opts: ConfirmOptions;
  resolve: (yes: boolean) => void;
}

/**
 * The web's confirm step (AMENDMENTS-DISPLAY-NAV section 8, row DN-4): `App` and `BrowseApp` mount
 * one host, and `platform/dialog`'s `confirm()` draws its question here as the design-system
 * `ConfirmSheet`, in the UI language, with the caller's labels. One question at a time; a second
 * waits for the first. While a sheet is open the history bridge holds one entry, so the browser or
 * phone back answers Cancel. On native the host registers nothing (the platform `Alert` stays).
 */
export function ConfirmHost(): React.ReactElement {
  const [current, setCurrent] = useState<Request | null>(null);
  const waiting = useRef<Request[]>([]);
  const showing = useRef<Request | null>(null);

  useEffect(() => {
    const release = setConfirmPresenter(
      (opts) =>
        new Promise<boolean>((resolve) => {
          const request: Request = { opts, resolve };
          if (showing.current === null) {
            showing.current = request;
            setCurrent(request);
          } else {
            waiting.current.push(request);
          }
        }),
    );
    return () => {
      release();
      // A host that goes away answers every open question with the safe choice.
      showing.current?.resolve(false);
      for (const request of waiting.current) request.resolve(false);
      showing.current = null;
      waiting.current = [];
    };
  }, []);

  const answer = useCallback((yes: boolean): void => {
    const request = showing.current;
    if (request === null) return;
    const next = waiting.current.shift() ?? null;
    showing.current = next;
    setCurrent(next);
    request.resolve(yes);
  }, []);
  const cancel = useCallback(() => answer(false), [answer]);
  const accept = useCallback(() => answer(true), [answer]);

  useHistorySheet(current !== null, cancel);

  return (
    <ConfirmSheet
      visible={current !== null}
      title={current?.opts.title ?? ''}
      message={current?.opts.message}
      cancelLabel={current?.opts.cancelLabel ?? ''}
      confirmLabel={current?.opts.confirmLabel ?? ''}
      onCancel={cancel}
      onConfirm={accept}
    />
  );
}
