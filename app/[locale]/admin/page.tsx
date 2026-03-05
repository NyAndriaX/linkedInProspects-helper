import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { authOptions } from "@/lib/auth";
import { isAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  if (!isAdminSession(session)) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations("admin");
  const [totalUsers, totalPosts, totalSchedules, totalProspects, users] =
    await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.schedule.count(),
      prisma.prospect.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          linkedInId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              posts: true,
              schedules: true,
              prospects: true,
              jobAlerts: true,
            },
          },
        },
      }),
    ]);

  const averagePostsPerUser =
    totalUsers === 0 ? 0 : Number((totalPosts / totalUsers).toFixed(1));

  const averageSchedulesPerUser =
    totalUsers === 0 ? 0 : Number((totalSchedules / totalUsers).toFixed(1));

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label={t("totalUsers")} value={totalUsers} accent="#0a66c2" />
          <StatCard label={t("totalPosts")} value={totalPosts} accent="#7c3aed" />
          <StatCard
            label={t("totalSchedules")}
            value={totalSchedules}
            accent="#f59e0b"
          />
          <StatCard
            label={t("totalProspects")}
            value={totalProspects}
            accent="#2563eb"
          />
          <StatCard
            label={t("avgPostsPerUser")}
            value={averagePostsPerUser}
            accent="#0891b2"
          />
          <StatCard
            label={t("avgSchedulesPerUser")}
            value={averageSchedulesPerUser}
            accent="#059669"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">{t("usersListTitle")}</h2>
          <p className="mb-4 text-sm text-gray-500">{t("usersListSubtitle")}</p>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {t("columns.user")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {t("columns.email")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">
                    {t("columns.posts")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">
                    {t("columns.schedules")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">
                    {t("columns.prospects")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">
                    {t("columns.alerts")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {t("columns.createdAt")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {t("columns.lastActivity")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">
                        {user.name || t("unknownUser")}
                      </p>
                      {user.linkedInId ? (
                        <p className="text-xs text-gray-500">
                          LinkedIn ID: {user.linkedInId}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          {t("noLinkedInId")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {user.email || t("noEmail")}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-[#7c3aed]">
                      {user._count.posts}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-[#f59e0b]">
                      {user._count.schedules}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-[#0a66c2]">
                      {user._count.prospects}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-[#059669]">
                      {user._count.jobAlerts}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatDate(user.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              {t("noUsers")}
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
