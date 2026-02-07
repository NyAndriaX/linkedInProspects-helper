"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Typography, Button, Alert, Tag, Spin, message } from "antd";
import {
  PlusOutlined,
  SendOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  MailOutlined,
  NodeIndexOutlined,
  BulbOutlined,
  CalendarOutlined,
  LinkOutlined,
  PhoneOutlined,
  MessageOutlined,
  FileTextOutlined,
  LoadingOutlined,
  SearchOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProfile } from "@/hooks/useProfile";
import { Link } from "@/i18n/routing";

const { Title, Text } = Typography;

// ── Types ──

interface DueStep {
  id: string;
  order: number;
  actionType: string;
  dueDate: string | null;
  sequenceId: string;
  sequenceName: string;
  prospect: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    status: string;
  };
}

interface DashboardData {
  urgencies: {
    overdue: DueStep[];
    today: DueStep[];
    upcoming: DueStep[];
    totalDue: number;
  };
  pipeline: {
    withoutEmail: number;
    withoutSequence: number;
    staleContacted: { id: string; name: string; company: string | null }[];
    staleContactedCount: number;
  };
  posts: {
    total: number;
    draft: number;
    ready: number;
    published: number;
  };
  prospects: {
    total: number;
  };
  hunter: {
    used: number;
    remaining: number;
    limit: number;
  };
}

interface PostIdea {
  hook: string;
  description: string;
  type: string;
  hashtags: string[];
}

// ── Action type display config ──
const ACTION_ICONS: Record<string, React.ReactNode> = {
  connection: <LinkOutlined />,
  message: <MessageOutlined />,
  email: <MailOutlined />,
  call: <PhoneOutlined />,
  note: <FileTextOutlined />,
};

const ACTION_COLORS: Record<string, string> = {
  connection: "#0a66c2",
  message: "#6366f1",
  email: "#f59e0b",
  call: "#10b981",
  note: "#6b7280",
};

// ── Page ──

export default function Home() {
  const t = useTranslations("home");
  const tCrm = useTranslations("crm");
  const { data: session } = useSession();
  const { isProfileComplete } = useProfile();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const [data, setData] = useState<DashboardData | null>(null);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStepId, setUpdatingStepId] = useState<string | null>(null);

  // ── Fetch dashboard data ──
  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (response.ok) {
        const d = await response.json();
        setData(d);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // Load cached ideas from localStorage
    try {
      const cached = localStorage.getItem("linkedin_ideas_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.ideas && Array.isArray(parsed.ideas)) {
          setIdeas(parsed.ideas.slice(0, 3));
        }
      }
    } catch {
      // ignore
    }
  }, [fetchDashboard]);

  // ── Mark step as sent/responded ──
  const handleMarkStep = async (stepId: string, status: "sent" | "responded") => {
    setUpdatingStepId(stepId);
    try {
      const response = await fetch(`/api/sequence-steps/${stepId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Update failed");
      messageApi.success(tCrm("sequence.stepUpdated"));
      fetchDashboard();
    } catch {
      messageApi.error(tCrm("sequence.stepUpdateFailed"));
    } finally {
      setUpdatingStepId(null);
    }
  };

  // ── Due date display ──
  const getDueLabel = (dateStr: string | null) => {
    if (!dateStr) return "";
    const due = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diff = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return t("urgencies.daysOverdue", { days: Math.abs(diff) });
    if (diff === 0) return t("urgencies.dueToday");
    return t("urgencies.inDays", { days: diff });
  };

  // ── Hunter credit color ──
  const getHunterColor = (remaining: number) => {
    if (remaining <= 2) return "#dc2626";
    if (remaining <= 5) return "#f59e0b";
    return "#10b981";
  };

  const todayStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hasUrgencies = data && data.urgencies.totalDue > 0;
  const hasPipelineIssues =
    data &&
    (data.pipeline.withoutEmail > 0 ||
      data.pipeline.withoutSequence > 0 ||
      data.pipeline.staleContactedCount > 0);

  return (
    <MainLayout>
      {contextHolder}
      <div className="space-y-5">
        {/* ━━━ Header ━━━ */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <Title level={3} className="mb-0!" style={{ lineHeight: 1.2 }}>
              {t("hello", { name: session?.user?.name?.split(" ")[0] || "" })}
            </Title>
            <Text type="secondary" className="text-sm">
              {t("subtitle")} — {todayStr}
            </Text>
          </div>
          {data && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: "#0a66c2" }}>
                  {data.prospects.total}
                </div>
                <Text type="secondary" className="text-xs">{t("stats.prospects")}</Text>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: "#6366f1" }}>
                  {data.posts.total}
                </div>
                <Text type="secondary" className="text-xs">{t("stats.posts")}</Text>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                style={{ background: `${getHunterColor(data.hunter.remaining)}10`, border: `1px solid ${getHunterColor(data.hunter.remaining)}30` }}
              >
                <SearchOutlined style={{ color: getHunterColor(data.hunter.remaining), fontSize: 13 }} />
                <Text style={{ fontSize: 12, fontWeight: 600, color: getHunterColor(data.hunter.remaining) }}>
                  {t("hunter.remaining", { remaining: data.hunter.remaining, limit: data.hunter.limit })}
                </Text>
              </div>
            </div>
          )}
        </div>

        {/* Profile Alert */}
        {!isProfileComplete && (
          <Alert
            type="warning"
            showIcon
            message={t("completeProfile")}
            description={t("completeProfileDescLong")}
            action={
              <Link href="/settings">
                <Button size="small" icon={<ArrowRightOutlined />}>{t("setup")}</Button>
              </Link>
            }
          />
        )}

        {/* ━━━ Quick Actions ━━━ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: t("quickActions.newProspect"),
              icon: <PlusOutlined />,
              href: "/crm",
              bg: "linear-gradient(135deg, #0a66c2, #004182)",
            },
            {
              label: t("quickActions.outreach"),
              icon: <SendOutlined />,
              href: "/outreach",
              bg: "linear-gradient(135deg, #6366f1, #4f46e5)",
            },
            {
              label: t("quickActions.createPost"),
              icon: <ThunderboltOutlined />,
              href: "/posts",
              bg: "linear-gradient(135deg, #f59e0b, #d97706)",
            },
            {
              label: t("quickActions.openCrm"),
              icon: <TeamOutlined />,
              href: "/crm",
              bg: "linear-gradient(135deg, #10b981, #059669)",
            },
          ].map((action) => (
            <Link key={action.href + action.label} href={action.href}>
              <div
                className="flex items-center gap-2.5 rounded-xl px-4 py-3 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                style={{ background: action.bg, color: "#fff" }}
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm font-semibold">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* ━━━ Loading ━━━ */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: "#0a66c2" }} spin />} />
          </div>
        )}

        {data && !isLoading && (
          <>
            {/* ━━━ URGENCIES ━━━ */}
            {hasUrgencies ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ExclamationCircleOutlined style={{ color: "#dc2626", fontSize: 16 }} />
                  <Text strong style={{ fontSize: 15 }}>{t("urgencies.title")}</Text>
                  <Tag color="error" style={{ borderRadius: 10, fontWeight: 700, fontSize: 12 }}>
                    {data.urgencies.totalDue}
                  </Tag>
                </div>

                {/* Overdue */}
                {data.urgencies.overdue.length > 0 && (
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <ExclamationCircleOutlined style={{ color: "#dc2626" }} />
                      <Text strong style={{ color: "#991b1b", fontSize: 13 }}>
                        {t("urgencies.overdueTitle")} ({data.urgencies.overdue.length})
                      </Text>
                    </div>
                    <div className="space-y-2">
                      {data.urgencies.overdue.slice(0, 8).map((step) => (
                        <StepRow
                          key={step.id}
                          step={step}
                          dueLabel={getDueLabel(step.dueDate)}
                          tagColor="error"
                          updatingId={updatingStepId}
                          onMarkSent={() => handleMarkStep(step.id, "sent")}
                          onMarkResponded={() => handleMarkStep(step.id, "responded")}
                          onView={() => router.push(`/en/crm`)}
                          tMarkSent={t("urgencies.markSent")}
                          tMarkResponded={t("urgencies.markResponded")}
                          tView={t("urgencies.viewProspect")}
                          tActionType={tCrm(`sequence.actionTypes.${step.actionType}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Due today */}
                {data.urgencies.today.length > 0 && (
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <ClockCircleOutlined style={{ color: "#d97706" }} />
                      <Text strong style={{ color: "#92400e", fontSize: 13 }}>
                        {t("urgencies.todayTitle")} ({data.urgencies.today.length})
                      </Text>
                    </div>
                    <div className="space-y-2">
                      {data.urgencies.today.slice(0, 8).map((step) => (
                        <StepRow
                          key={step.id}
                          step={step}
                          dueLabel={getDueLabel(step.dueDate)}
                          tagColor="warning"
                          updatingId={updatingStepId}
                          onMarkSent={() => handleMarkStep(step.id, "sent")}
                          onMarkResponded={() => handleMarkStep(step.id, "responded")}
                          onView={() => router.push(`/en/crm`)}
                          tMarkSent={t("urgencies.markSent")}
                          tMarkResponded={t("urgencies.markResponded")}
                          tView={t("urgencies.viewProspect")}
                          tActionType={tCrm(`sequence.actionTypes.${step.actionType}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming */}
                {data.urgencies.upcoming.length > 0 && (
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarOutlined style={{ color: "#0284c7" }} />
                      <Text strong style={{ color: "#075985", fontSize: 13 }}>
                        {t("urgencies.upcomingTitle")} ({data.urgencies.upcoming.length})
                      </Text>
                    </div>
                    <div className="space-y-2">
                      {data.urgencies.upcoming.slice(0, 5).map((step) => (
                        <StepRow
                          key={step.id}
                          step={step}
                          dueLabel={getDueLabel(step.dueDate)}
                          tagColor="blue"
                          updatingId={updatingStepId}
                          onMarkSent={() => handleMarkStep(step.id, "sent")}
                          onMarkResponded={() => handleMarkStep(step.id, "responded")}
                          onView={() => router.push(`/en/crm`)}
                          tMarkSent={t("urgencies.markSent")}
                          tMarkResponded={t("urgencies.markResponded")}
                          tView={t("urgencies.viewProspect")}
                          tActionType={tCrm(`sequence.actionTypes.${step.actionType}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="rounded-xl p-5 text-center"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
              >
                <CheckCircleOutlined style={{ color: "#16a34a", fontSize: 28 }} />
                <div className="mt-2">
                  <Text strong style={{ color: "#166534", fontSize: 14 }}>
                    {t("urgencies.allClear")}
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t("urgencies.allClearDesc")}
                </Text>
              </div>
            )}

            {/* ━━━ PIPELINE BLOCKERS ━━━ */}
            {hasPipelineIssues && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <RocketOutlined style={{ color: "#6366f1", fontSize: 16 }} />
                  <Text strong style={{ fontSize: 15 }}>{t("pipeline.title")}</Text>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {data.pipeline.withoutEmail > 0 && (
                    <div
                      className="rounded-xl p-4"
                      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MailOutlined style={{ color: "#f59e0b" }} />
                        <Text strong style={{ fontSize: 13 }}>{t("pipeline.withoutEmail")}</Text>
                      </div>
                      <div className="text-2xl font-bold mb-1" style={{ color: "#f59e0b" }}>
                        {data.pipeline.withoutEmail}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {t("pipeline.withoutEmailDesc")}
                      </Text>
                      <div className="mt-3">
                        <Link href="/outreach">
                          <Button
                            size="small"
                            icon={<SearchOutlined />}
                            style={{ borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#f59e0b", borderColor: "#fde68a" }}
                          >
                            {t("pipeline.findEmails")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  {data.pipeline.withoutSequence > 0 && (
                    <div
                      className="rounded-xl p-4"
                      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <NodeIndexOutlined style={{ color: "#8b5cf6" }} />
                        <Text strong style={{ fontSize: 13 }}>{t("pipeline.withoutSequence")}</Text>
                      </div>
                      <div className="text-2xl font-bold mb-1" style={{ color: "#8b5cf6" }}>
                        {data.pipeline.withoutSequence}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {t("pipeline.withoutSequenceDesc")}
                      </Text>
                      <div className="mt-3">
                        <Link href="/crm">
                          <Button
                            size="small"
                            icon={<NodeIndexOutlined />}
                            style={{ borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#8b5cf6", borderColor: "#ddd6fe" }}
                          >
                            {t("pipeline.planFollowups")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  {data.pipeline.staleContactedCount > 0 && (
                    <div
                      className="rounded-xl p-4"
                      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <ClockCircleOutlined style={{ color: "#dc2626" }} />
                        <Text strong style={{ fontSize: 13 }}>{t("pipeline.staleContacted")}</Text>
                      </div>
                      <div className="text-2xl font-bold mb-1" style={{ color: "#dc2626" }}>
                        {data.pipeline.staleContactedCount}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {t("pipeline.staleContactedDesc")}
                      </Text>
                      <div className="mt-3">
                        <Link href="/outreach">
                          <Button
                            size="small"
                            icon={<SendOutlined />}
                            style={{ borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#dc2626", borderColor: "#fecaca" }}
                          >
                            {t("pipeline.relaunchNow")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ━━━ IDEAS + STATS ROW ━━━ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Ideas section — 2 columns */}
              <div
                className="lg:col-span-2 rounded-xl p-4"
                style={{ background: "#fff", border: "1px solid #e5e7eb" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BulbOutlined style={{ color: "#f59e0b", fontSize: 16 }} />
                    <Text strong style={{ fontSize: 14 }}>{t("ideas.title")}</Text>
                  </div>
                  <Link href="/ideas">
                    <Button type="text" size="small" icon={<ArrowRightOutlined />} style={{ fontSize: 12 }}>
                      {t("ideas.generateIdeas")}
                    </Button>
                  </Link>
                </div>

                {ideas.length > 0 ? (
                  <div className="space-y-2.5">
                    {ideas.map((idea, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg p-3 hover:shadow-sm transition-shadow"
                        style={{ background: "#fafafa", border: "1px solid #f0f0f0" }}
                      >
                        <Text strong style={{ fontSize: 13, display: "block", lineHeight: 1.3 }}>
                          {idea.hook}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                          {idea.description.length > 100
                            ? idea.description.slice(0, 100) + "…"
                            : idea.description}
                        </Text>
                        {idea.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {idea.hashtags.slice(0, 4).map((tag, i) => (
                              <span key={i} className="text-[10px] font-medium" style={{ color: "#0a66c2" }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Link href="/posts">
                            <Button
                              size="small"
                              type="primary"
                              icon={<ThunderboltOutlined />}
                              style={{
                                fontSize: 11,
                                borderRadius: 6,
                                height: 26,
                                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                border: "none",
                              }}
                            >
                              {t("ideas.generatePost")}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <BulbOutlined style={{ fontSize: 28, color: "#d1d5db" }} />
                    <div className="mt-2">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t("ideas.noIdeasDesc")}
                      </Text>
                    </div>
                    <Link href="/ideas">
                      <Button
                        type="primary"
                        icon={<BulbOutlined />}
                        className="mt-3"
                        style={{
                          background: "linear-gradient(135deg, #f59e0b, #d97706)",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 600,
                        }}
                      >
                        {t("ideas.generateIdeas")}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Stats column */}
              <div className="space-y-3">
                {/* Post stats */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                >
                  <Text strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>
                    {t("stats.posts")}
                  </Text>
                  <div className="space-y-2">
                    {[
                      { label: t("stats.drafts"), value: data.posts.draft, color: "#6b7280" },
                      { label: t("stats.ready"), value: data.posts.ready, color: "#0a66c2" },
                      { label: t("stats.published"), value: data.posts.published, color: "#16a34a" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between">
                        <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
                        <div className="flex items-center gap-2">
                          <div
                            className="rounded-full"
                            style={{
                              height: 6,
                              width: Math.max(12, Math.min(80, (s.value / Math.max(data.posts.total, 1)) * 80)),
                              background: s.color,
                              borderRadius: 3,
                            }}
                          />
                          <Text strong style={{ fontSize: 13, color: s.color, minWidth: 20, textAlign: "right" }}>
                            {s.value}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hunter credits detail */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <SearchOutlined style={{ color: getHunterColor(data.hunter.remaining), fontSize: 14 }} />
                    <Text strong style={{ fontSize: 13 }}>{t("hunter.title")}</Text>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="text-2xl font-bold"
                      style={{ color: getHunterColor(data.hunter.remaining) }}
                    >
                      {data.hunter.remaining}
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        / {data.hunter.limit}
                      </Text>
                      <div
                        className="mt-1 rounded-full overflow-hidden"
                        style={{ height: 5, width: 80, background: "#f3f4f6" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(data.hunter.remaining / data.hunter.limit) * 100}%`,
                            background: getHunterColor(data.hunter.remaining),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {data.hunter.remaining <= 2 && (
                    <Text style={{ fontSize: 11, color: "#dc2626", display: "block", marginTop: 6 }}>
                      {t("hunter.low")}
                    </Text>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

// ── StepRow component ──
function StepRow({
  step,
  dueLabel,
  tagColor,
  updatingId,
  onMarkSent,
  onMarkResponded,
  onView,
  tMarkSent,
  tMarkResponded,
  tView,
  tActionType,
}: {
  step: DueStep;
  dueLabel: string;
  tagColor: string;
  updatingId: string | null;
  onMarkSent: () => void;
  onMarkResponded: () => void;
  onView: () => void;
  tMarkSent: string;
  tMarkResponded: string;
  tView: string;
  tActionType: string;
}) {
  const isUpdating = updatingId === step.id;
  const actionColor = ACTION_COLORS[step.actionType] || "#6b7280";

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5"
      style={{ background: "#fff", border: "1px solid #f0f0f0" }}
    >
      <span style={{ color: actionColor, fontSize: 14 }}>
        {ACTION_ICONS[step.actionType] || <FileTextOutlined />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Text strong style={{ fontSize: 12 }}>{step.prospect.name}</Text>
          {step.prospect.company && (
            <Text type="secondary" style={{ fontSize: 11 }}>· {step.prospect.company}</Text>
          )}
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {tActionType}
        </Text>
      </div>
      <Tag
        color={tagColor}
        style={{ fontSize: 10, borderRadius: 4, margin: 0, fontWeight: 600 }}
      >
        {dueLabel}
      </Tag>
      <div className="flex gap-1">
        <Button
          size="small"
          type="primary"
          loading={isUpdating}
          icon={isUpdating ? <LoadingOutlined /> : <CheckCircleOutlined />}
          onClick={onMarkSent}
          style={{ fontSize: 11, borderRadius: 6, height: 26, background: "#10b981", border: "none" }}
        >
          {tMarkSent}
        </Button>
        <Button
          size="small"
          onClick={onView}
          style={{ fontSize: 11, borderRadius: 6, height: 26 }}
        >
          {tView}
        </Button>
      </div>
    </div>
  );
}
