"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Typography,
  Spin,
  Tag,
  message,
  Tooltip,
  Empty,
} from "antd";
import {
  BulbOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  CalendarOutlined,
  LoadingOutlined,
  FileTextOutlined,
  PictureOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  UnorderedListOutlined,
  FireOutlined,
  FundProjectionScreenOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";

const { Title, Text, Paragraph } = Typography;

// ── Types ──

interface PostIdea {
  hook: string;
  description: string;
  type: string;
  hashtags: string[];
}

// ── Type config ──

const TYPE_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: React.ReactNode; gradient: string }
> = {
  text: {
    color: "#0a66c2",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: <FileTextOutlined />,
    gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
  },
  carousel: {
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    icon: <PictureOutlined />,
    gradient: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
  },
  question: {
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    icon: <QuestionCircleOutlined />,
    gradient: "linear-gradient(135deg, #fff7ed, #ffedd5)",
  },
  story: {
    color: "#0d9488",
    bg: "#f0fdfa",
    border: "#99f6e4",
    icon: <UserOutlined />,
    gradient: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
  },
  tips: {
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: <UnorderedListOutlined />,
    gradient: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
  },
  hot_take: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: <FireOutlined />,
    gradient: "linear-gradient(135deg, #fef2f2, #fee2e2)",
  },
  case_study: {
    color: "#ca8a04",
    bg: "#fefce8",
    border: "#fef08a",
    icon: <FundProjectionScreenOutlined />,
    gradient: "linear-gradient(135deg, #fefce8, #fef9c3)",
  },
};

// ── Page ──

export default function IdeasPage() {
  const t = useTranslations("ideas");
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [generatingPostIndex, setGeneratingPostIndex] = useState<number | null>(
    null
  );

  // Load cached ideas from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem("linkedin-ideas-cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.ideas?.length > 0) {
          setIdeas(parsed.ideas);
          setGeneratedAt(parsed.generatedAt || null);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/suggest-ideas");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          messageApi.warning(t("errors.rateLimited"));
        } else {
          messageApi.error(data.error || t("errors.failed"));
        }
        return;
      }

      setIdeas(data.ideas || []);
      setGeneratedAt(data.generatedAt || new Date().toISOString());

      // Cache in localStorage
      localStorage.setItem(
        "linkedin-ideas-cache",
        JSON.stringify({
          ideas: data.ideas,
          generatedAt: data.generatedAt,
        })
      );
    } catch {
      messageApi.error(t("errors.failed"));
    } finally {
      setIsGenerating(false);
    }
  }, [messageApi, t]);

  const handleGeneratePost = useCallback(
    async (idea: PostIdea, index: number) => {
      setGeneratingPostIndex(index);
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            count: 1,
            topic: `${idea.hook}\n\n${idea.description}`,
            style: idea.type === "tips" ? "tips_list" :
                   idea.type === "story" ? "personal_story" :
                   idea.type === "hot_take" ? "contrarian" :
                   idea.type === "case_study" ? "case_study" :
                   idea.type === "question" ? "question_driven" :
                   undefined,
            preview: false,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Generation failed");
        }

        messageApi.success("Post généré et sauvegardé ! Retrouvez-le dans Publications.");
        router.push("/posts");
      } catch (err) {
        messageApi.error(
          err instanceof Error ? err.message : t("errors.failed")
        );
      } finally {
        setGeneratingPostIndex(null);
      }
    },
    [messageApi, router, t]
  );

  const getTypeConfig = (type: string) =>
    TYPE_CONFIG[type] || TYPE_CONFIG.text;

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <MainLayout>
      {contextHolder}
      <div className="space-y-5">
        {/* ━━━ Page Header ━━━ */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 40,
                height: 40,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
              }}
            >
              <BulbOutlined style={{ color: "#fff", fontSize: 18 }} />
            </div>
            <div>
              <Title level={3} className="mb-0!" style={{ lineHeight: 1.2 }}>
                {t("title")}
              </Title>
              <Text type="secondary" className="text-sm">
                {t("subtitle")}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {generatedAt && (
              <Tooltip title={t("refreshTip")}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined className="mr-1" />
                  {t("lastGenerated")}: {formatDate(generatedAt)}
                </Text>
              </Tooltip>
            )}
            <Button
              type="primary"
              icon={isGenerating ? <LoadingOutlined spin /> : <ReloadOutlined />}
              onClick={handleGenerate}
              loading={isGenerating}
              size="large"
              style={{
                borderRadius: 10,
                fontWeight: 600,
                background: isGenerating
                  ? undefined
                  : "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none",
                height: 44,
              }}
            >
              {isGenerating ? t("generating") : t("generate")}
            </Button>
          </div>
        </div>

        {/* ━━━ Loading State ━━━ */}
        {isGenerating && (
          <div
            className="rounded-xl py-20 text-center"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <Spin
              size="large"
              indicator={
                <LoadingOutlined
                  style={{ fontSize: 44, color: "#f59e0b" }}
                  spin
                />
              }
            />
            <div className="mt-5">
              <Text strong className="text-base block">
                {t("generating")}
              </Text>
              <Text type="secondary" className="text-sm mt-1 block">
                {t("generatingTip")}
              </Text>
            </div>
          </div>
        )}

        {/* ━━━ Ideas Grid ━━━ */}
        {!isGenerating && ideas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ideas.map((idea, index) => {
              const config = getTypeConfig(idea.type);
              const isGeneratingThis = generatingPostIndex === index;

              return (
                <div
                  key={index}
                  className="rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md"
                  style={{
                    border: `1px solid ${config.border}`,
                    background: "#fff",
                    opacity: isGeneratingThis ? 0.7 : 1,
                  }}
                >
                  {/* Card header with type badge */}
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{
                      background: config.gradient,
                      borderBottom: `1px solid ${config.border}`,
                    }}
                  >
                    <Tag
                      style={{
                        background: `${config.color}15`,
                        color: config.color,
                        border: `1px solid ${config.border}`,
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        margin: 0,
                      }}
                    >
                      {config.icon}{" "}
                      {t(`postTypes.${idea.type}` as Parameters<typeof t>[0])}
                    </Tag>
                    <Text
                      type="secondary"
                      style={{ fontSize: 11, fontWeight: 500 }}
                    >
                      #{index + 1}
                    </Text>
                  </div>

                  {/* Content */}
                  <div className="px-4 py-4 flex-1 flex flex-col">
                    {/* Hook */}
                    <Text
                      strong
                      style={{
                        fontSize: 15,
                        lineHeight: 1.4,
                        color: "#111827",
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      {idea.hook}
                    </Text>

                    {/* Description */}
                    <Paragraph
                      type="secondary"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        marginBottom: 12,
                        flex: 1,
                      }}
                      ellipsis={{ rows: 3, expandable: true, symbol: "voir plus" }}
                    >
                      {idea.description}
                    </Paragraph>

                    {/* Hashtags */}
                    {idea.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {idea.hashtags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-xs font-medium"
                            style={{ color: config.color }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action footer */}
                  <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{
                      borderTop: "1px solid #f3f4f6",
                      background: "#fafbfc",
                    }}
                  >
                    <Button
                      type="primary"
                      size="small"
                      icon={
                        isGeneratingThis ? (
                          <LoadingOutlined spin />
                        ) : (
                          <ThunderboltOutlined />
                        )
                      }
                      onClick={() => handleGeneratePost(idea, index)}
                      loading={isGeneratingThis}
                      disabled={generatingPostIndex !== null && !isGeneratingThis}
                      style={{
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 12,
                        background: isGeneratingThis
                          ? undefined
                          : "linear-gradient(135deg, #f59e0b, #d97706)",
                        border: "none",
                        flex: 1,
                      }}
                    >
                      {t("generatePost")}
                    </Button>
                    <Tooltip title={t("addToSchedule")}>
                      <Button
                        size="small"
                        icon={<CalendarOutlined />}
                        onClick={() => {
                          handleGeneratePost(idea, index);
                        }}
                        disabled={generatingPostIndex !== null}
                        style={{
                          borderRadius: 8,
                          color: "#6366f1",
                          borderColor: "#6366f1",
                        }}
                      >
                        <ArrowRightOutlined style={{ fontSize: 10 }} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ━━━ Empty State ━━━ */}
        {!isGenerating && ideas.length === 0 && (
          <div
            className="rounded-xl py-20 text-center"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <div
              className="inline-flex items-center justify-center rounded-full mb-5"
              style={{
                width: 72,
                height: 72,
                background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
              }}
            >
              <BulbOutlined style={{ fontSize: 32, color: "#f59e0b" }} />
            </div>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              imageStyle={{ display: "none" }}
              description={
                <div className="text-center">
                  <Text
                    strong
                    style={{
                      fontSize: 16,
                      color: "#374151",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    {t("empty.title")}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ fontSize: 14, maxWidth: 400, display: "inline-block" }}
                  >
                    {t("empty.description")}
                  </Text>
                </div>
              }
            />
            <Button
              type="primary"
              icon={<BulbOutlined />}
              onClick={handleGenerate}
              size="large"
              className="mt-6"
              style={{
                borderRadius: 10,
                fontWeight: 600,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none",
                height: 48,
                paddingInline: 32,
              }}
            >
              {t("generate")}
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
