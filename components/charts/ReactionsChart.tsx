"use client";

import { useMemo } from "react";
import { Card, Typography, Empty } from "antd";
import { Area } from "@ant-design/charts";
import { useTranslations } from "next-intl";
import { Post } from "@/types/post";

const { Title } = Typography;

interface ReactionsChartProps {
  posts: Post[];
  isMobile?: boolean;
}

interface ChartDataPoint {
  date: string;
  reactions: number;
}

/**
 * Chart component showing reactions evolution over time
 */
export function ReactionsChart({ posts, isMobile = false }: ReactionsChartProps) {
  const t = useTranslations("home.chart");

  // Transform posts data into chart format grouped by month
  const chartData = useMemo<ChartDataPoint[]>(() => {
    // Filter only published posts with a publishedAt date
    const publishedPosts = posts.filter(
      (p) => p.status === "published" && p.publishedAt
    );

    if (publishedPosts.length === 0) {
      return [];
    }

    // Group posts by month
    const monthlyData = new Map<string, number>();

    publishedPosts.forEach((post) => {
      const date = new Date(post.publishedAt!);
      // Format: "YYYY-MM" for sorting
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const existing = monthlyData.get(monthKey) || 0;
      monthlyData.set(monthKey, existing + (post.reactions || 0));
    });

    // Convert to array and sort by date
    const sortedMonths = Array.from(monthlyData.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );

    // Create data points
    return sortedMonths.map(([monthKey, reactions]) => {
      const [year, month] = monthKey.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      const displayDate = date.toLocaleDateString("fr-FR", {
        month: "short",
        year: "numeric",
      });

      return {
        date: displayDate,
        reactions,
      };
    });
  }, [posts]);

  // Chart configuration
  const config = {
    data: chartData,
    xField: "date",
    yField: "reactions",
    shapeField: "smooth",
    style: {
      fill: "linear-gradient(-90deg, white 0%, #52c41a 100%)",
      fillOpacity: 0.6,
    },
    line: {
      style: {
        stroke: "#52c41a",
        strokeWidth: 2,
      },
    },
    axis: {
      x: {
        title: false,
        labelAutoRotate: false,
      },
      y: {
        title: false,
        labelFormatter: (v: number) => {
          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
          if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
          return v.toString();
        },
      },
    },
    tooltip: {
      title: "date",
      items: [{ channel: "y", valueFormatter: (v: number) => v.toLocaleString() }],
    },
    height: isMobile ? 200 : 300,
  };

  return (
    <Card
      className="w-full"
      size={isMobile ? "small" : "default"}
      styles={{ body: { padding: isMobile ? 12 : 24 } }}
    >
      <Title level={isMobile ? 5 : 4} className="mb-4!">
        {t("title")}
      </Title>

      {chartData.length > 0 ? (
        <Area {...config} />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className="text-center">
              <div className="text-gray-500">{t("noData")}</div>
              <div className="text-gray-400 text-sm">{t("noDataDesc")}</div>
            </div>
          }
        />
      )}
    </Card>
  );
}
