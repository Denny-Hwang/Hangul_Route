/**
 * Native stub of `grown-up-tab.web.ts`: a native build has no browser tab, no `sessionStorage` and no console tabs
 * to tell, so ending the tab's grown-up state is a no-op ([OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.6). The
 * session itself (the ui-store times) is closed by `closeGrownUpSession` on every platform.
 */
export function endGrownUpTab(): void {
  // Nothing to clear or tell on native.
}
