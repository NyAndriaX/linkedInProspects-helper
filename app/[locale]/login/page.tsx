"use client";

import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Typography, Alert, Spin } from "antd";
import { LinkedinOutlined, LoadingOutlined } from "@ant-design/icons";
import { Logo } from "@/components/ui/Logo";
import { useRouter } from "@/i18n/routing";

const { Text, Paragraph } = Typography;

function LoginContent() {
  const t = useTranslations("login");
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (session) {
      router.push("/");
    }
  }, [session, router]);

  const handleLinkedInSignIn = () => {
    signIn("linkedin", { callbackUrl: "/" });
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm" style={{ borderRadius: 12 }}>
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo size="large" />
          </div>

          {/* Description */}
          <Text type="secondary" className="block mb-8">
            {t("tagline")}
          </Text>

          {/* Error */}
          {error && (
            <Alert
              message={t("error.title")}
              description={t("error.description")}
              type="error"
              showIcon
              className="mb-6 text-left"
            />
          )}

          {/* Sign In Button */}
          <Button
            type="default"
            size="large"
            icon={<LinkedinOutlined />}
            onClick={handleLinkedInSignIn}
            block
            className="h-12"
          >
            {t("continueWithLinkedIn")}
          </Button>

          {/* Terms */}
          <Paragraph type="secondary" className="text-xs mt-6 !mb-0">
            {t("terms")}
          </Paragraph>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
