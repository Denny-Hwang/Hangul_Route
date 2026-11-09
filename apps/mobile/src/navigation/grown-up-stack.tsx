import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';

/**
 * F-AUTH-004 section 6.1 (row NS-2): the root stack's `ParentDashboard` route on the web (and in the tests): the
 * dashboard itself, exactly as before. The web's grown-up account is the console (F-APP-001), so no Clerk provider and
 * no nested navigator exist here. iOS and Android resolve `grown-up-stack.native.tsx`.
 */
export const GrownUpArea = ParentDashboardScreen;
