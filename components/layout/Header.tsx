"use client";

import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Layout, Avatar, Dropdown, Button, Space, theme } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const { Header: AntHeader } = Layout;

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const t = useTranslations("navigation");
  const { data: session } = useSession();
  const { token } = theme.useToken();

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  const userMenuItems: MenuProps["items"] = [
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: <Link href="/settings">{t("settings")}</Link>,
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: t("signOut"),
      onClick: handleSignOut,
    },
  ];

  return (
    <AntHeader
      style={{
        background: token.colorBgContainer,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 64,
      }}
    >
      {/* Mobile menu button (only on mobile) */}
      {showMenuButton ? (
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onMenuClick}
        />
      ) : (
        <div />
      )}

      <Space size="middle">
        <LanguageSwitcher />
        {session?.user && (
          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <Avatar
              src={session.user.image}
              icon={<UserOutlined />}
              size={40}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Dropdown>
        )}
      </Space>
    </AntHeader>
  );
}
