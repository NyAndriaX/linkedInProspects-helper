"use client";

import { useTranslations } from "next-intl";
import { Layout, Menu, Badge, theme } from "antd";
import { HomeOutlined, FileTextOutlined, SettingOutlined, ClockCircleOutlined, SendOutlined, TeamOutlined, BulbOutlined, SearchOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Logo } from "@/components/ui/Logo";
import { Link, usePathname } from "@/i18n/routing";

const { Sider } = Layout;

interface SidebarProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  isMobile?: boolean;
}

/**
 * Animated "NEW" badge component for highlighting new features.
 * Uses a pulse animation to catch the user's eye.
 */
function NewFeatureBadge({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <span
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #ff6b6b, #ee5a24)",
          boxShadow: "0 0 6px rgba(238, 90, 36, 0.6)",
          animation: "pulse-dot 2s ease-in-out infinite",
        }}
      />
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginLeft: 8,
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: "16px",
        letterSpacing: "0.5px",
        color: "#fff",
        background: "linear-gradient(135deg, #ff6b6b, #ee5a24)",
        borderRadius: 4,
        textTransform: "uppercase",
        boxShadow: "0 1px 4px rgba(238, 90, 36, 0.4)",
        animation: "pulse-badge 2s ease-in-out infinite",
      }}
    >
      NEW
    </span>
  );
}

/**
 * CSS keyframes injected once for the pulse animations.
 * Uses dangerouslySetInnerHTML to inject global keyframes reliably in client components.
 */
const PULSE_KEYFRAMES = `
  @keyframes pulse-badge {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.05); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(238, 90, 36, 0.6); }
    50% { opacity: 0.7; box-shadow: 0 0 12px rgba(238, 90, 36, 0.9); }
  }
`;

function PulseAnimationStyle() {
  return <style dangerouslySetInnerHTML={{ __html: PULSE_KEYFRAMES }} />;
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
      key: "/jobs",
      icon: (
        <Badge dot offset={[-2, 2]} color="#ee5a24" style={{ boxShadow: "0 0 4px rgba(238,90,36,0.5)" }}>
          <SearchOutlined />
        </Badge>
      ),
      label: (
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <Link href="/jobs">{t("jobs")}</Link>
          <NewFeatureBadge collapsed={collapsed} />
        </span>
      ),
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
      <>
        <PulseAnimationStyle />
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
      </>
    );
  }

  return (
    <>
      <PulseAnimationStyle />
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
    </>
  );
}
