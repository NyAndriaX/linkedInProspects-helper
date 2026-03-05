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
  const totalUsers = await prisma.user.count();

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">{t("totalUsers")}</p>
          <p className="mt-2 text-4xl font-bold text-[#0a66c2]">{totalUsers}</p>
        </div>
      </div>
    </MainLayout>
  );
}
