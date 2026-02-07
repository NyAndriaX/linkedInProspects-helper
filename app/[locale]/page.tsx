"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Card, Typography, Button, Alert, Row, Col } from "antd";
import {
  FileTextOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { Link } from "@/i18n/routing";

const { Title, Text } = Typography;

export default function Home() {
  const t = useTranslations("home");
  const { data: session } = useSession();
  const { isProfileComplete } = useProfile();
  const { stats } = usePosts();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const statCards = [
    {
      key: "total",
      label: t("stats.total"),
      value: stats.total,
      icon: <FileTextOutlined />,
      bgColor: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
    {
      key: "drafts",
      label: t("stats.drafts"),
      value: stats.draft,
      icon: <EditOutlined />,
      bgColor: "bg-gray-100",
      iconColor: "text-gray-600",
    },
    {
      key: "ready",
      label: t("stats.ready"),
      value: stats.ready,
      icon: <ClockCircleOutlined />,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      key: "published",
      label: t("stats.published"),
      value: stats.published,
      icon: <CheckCircleOutlined />,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Welcome */}
        <div>
          <Title level={isMobile ? 3 : 2} className="mb-1!">
            {t("hello", { name: session?.user?.name?.split(" ")[0] || "" })}
          </Title>
          <Text type="secondary" className={isMobile ? "text-sm" : ""}>
            {t("subtitle")}
          </Text>
        </div>

        {/* Profile Alert */}
        {!isProfileComplete && (
          <Alert
            type="warning"
            showIcon
            message={t("completeProfile")}
            description={isMobile ? t("completeProfileDescShort") : t("completeProfileDescLong")}
            action={
              <Link href="/settings">
                <Button size="small" icon={isMobile ? <ArrowRightOutlined /> : undefined}>
                  {isMobile ? "" : t("setup")}
                </Button>
              </Link>
            }
          />
        )}

        {/* Stats */}
        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
          {statCards.map((stat) => (
            <Col xs={12} sm={12} lg={6} key={stat.key}>
              <Card 
                className="h-full" 
                size={isMobile ? "small" : "default"}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
              >
                <div className={`flex items-center ${isMobile ? "gap-2" : "gap-4"}`}>
                  <div className={`flex items-center justify-center ${isMobile ? "w-9 h-9" : "w-12 h-12"} rounded-xl ${stat.bgColor}`}>
                    <span className={`${isMobile ? "text-base" : "text-xl"} ${stat.iconColor}`}>
                      {stat.icon}
                    </span>
                  </div>
                  <div>
                    <Text type="secondary" className={isMobile ? "text-xs" : "text-sm"}>
                      {stat.label}
                    </Text>
                    <div className={`${isMobile ? "text-lg" : "text-2xl"} font-semibold`}>
                      {stat.value}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </MainLayout>
  );
}
