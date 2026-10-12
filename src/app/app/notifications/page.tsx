import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { NotificationList } from "@/components/notification-list";
import { requireOwner } from "@/lib/auth/session";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";

export default async function NotificationsPage() {
  const owner = await requireOwner();
  const [notifications, unread] = await Promise.all([
    getNotifications(owner.userId),
    getUnreadNotificationCount(owner.userId),
  ]);

  return (
    <AppShell workspaceName={owner.workspaceName}>
      <PageHeading
        eyebrow="Your account"
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread · ownership and recall updates for products you own.`
            : "Ownership and recall updates for products you own."
        }
      />
      <NotificationList
        items={notifications.map((row) => ({
          id: row.id,
          kind: row.kind,
          severity: row.severity,
          title: row.title,
          body: row.body,
          recall_id: row.recall_id,
          unit_id: row.unit_id,
          read_at: row.read_at,
          created_at: row.created_at,
        }))}
        demo={owner.demo}
      />
    </AppShell>
  );
}
