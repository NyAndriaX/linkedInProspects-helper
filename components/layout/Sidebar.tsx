"use client";

import { useTranslations } from "next-intl";
import { Layout, Menu, theme } from "antd";
import { HomeOutlined, FileTextOutlined, SettingOutlined, ClockCircleOutlined, SendOutlined, TeamOutlined, BulbOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Logo } from "@/components/ui/Logo";
import { Link, usePathname } from "@/i18n/routing";

const { Sider } = Layout;

interface SidebarProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  isMobile?: boolean;
}

export function Sidebar({
  collapsed = false,
  onCollapse,
  isMobile = false,
}: SidebarProps) {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const { token } = theme.useToken();

  const menuItems: MenuProps["items"] = [
    {
      key: "/",
      icon: <HomeOutlined />,
      label: <Link href="/">{t("dashboard")}</Link>,
    },
    {
      key: "/posts",
      icon: <FileTextOutlined />,
      label: <Link href="/posts">{t("posts")}</Link>,
    },
    {
      key: "/schedule",
      icon: <ClockCircleOutlined />,
      label: <Link href="/schedule">{t("schedule")}</Link>,
    },
    {
      key: "/outreach",
      icon: <SendOutlined />,
      label: <Link href="/outreach">{t("outreach")}</Link>,
    },
    {
      key: "/crm",
      icon: <TeamOutlined />,
      label: <Link href="/crm">{t("crm")}</Link>,
    },
    {
      key: "/ideas",
      icon: <BulbOutlined />,
      label: <Link href="/ideas">{t("ideas")}</Link>,
    },
    {
      key: "/settings",
      icon: <SettingOutlined />,
      label: <Link href="/settings">{t("settings")}</Link>,
    },
  ];

  // Mobile: rendered inside Drawer, no Sider wrapper needed
  if (isMobile) {
    return (
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        onClick={() => onCollapse?.(true)}
        style={{
          border: "none",
          padding: "12px 8px",
        }}
      />
    );
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      collapsedWidth={80}
      style={{
        background: token.colorBgContainer,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        height: "100vh",
        position: "sticky",
        top: 0,
        left: 0,
      }}
      width={220}
    >
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? 0 : "0 20px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Link href="/" className="no-underline">
          <Logo size="small" showText={!collapsed} />
        </Link>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        style={{
          border: "none",
          padding: "12px 8px",
        }}
      />
    </Sider>
  );
}
