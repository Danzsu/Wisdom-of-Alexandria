import { ProfileScreen } from "@/components/profile/profile-screen";

/**
 * Author profile route (DESIGN-C). User-level — it lives at the top of the
 * `(app)` group (not under `konyv/[bookId]`), so the shell renders it with no
 * book icon rail, like `/projekt`. The identity meta is static copy; the three
 * stat cards bind real aggregates inside the client {@link ProfileScreen}.
 */
export default function ProfilePage() {
  return <ProfileScreen />;
}
