"use client";

import { useLocale } from "next-intl";
import { Select } from "antd";
import { GlobalOutlined } from "@ant-design/icons";
import { useRouter, usePathname } from "@/i18n/routing";
import { locales, localeNames, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  const options = locales.map((loc) => ({
    value: loc,
    label: (
      <span className="flex items-center gap-2">
        <span className="text-xs">{loc === "fr" ? "🇫🇷" : "🇬🇧"}</span>
        <span>{localeNames[loc]}</span>
      </span>
    ),
  }));

  return (
    <Select
      value={locale}
      onChange={handleChange}
      options={options}
      className={className}
      suffixIcon={<GlobalOutlined />}
      style={{ width: 130 }}
      size="small"
      variant="borderless"
    />
  );
}
