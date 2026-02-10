"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Typography,
  Tag,
  Segmented,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Spin,
  Empty,
  message,
  Popconfirm,
  Tooltip,
  Badge,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  LinkOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  MailOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  TagOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";

const { Title, Text, Paragraph } = Typography;

// ── Types ──

interface JobListing {
  id: string;
  externalId: string;
  source: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string;
  contactEmail: string | null;
  location: string | null;
  salary: string | null;
  tags: string[];
  publishedAt: string;
}

interface JobMatch {
  id: string;
  userId: string;
  alertId: string;
  jobListingId: string;
  status: string;
  createdAt: string;
  jobListing: JobListing;
  alert: { name: string; id: string };
}

interface JobAlert {
  id: string;
  name: string;
  keywords: string[];
  excludeKeywords: string[];
  sources: string[];
  maxPerDay: number;
  isActive: boolean;
  lastFetchAt: string | null;
  createdAt: string;
  _count: { matches: number };
}

interface ListingsResponse {
  matches: JobMatch[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: Record<string, number>;
}

// ── Constants ──

const SOURCE_COLORS: Record<string, string> = {
  remotive: "#6366f1",
  jobicy: "#0ea5e9",
  arbeitnow: "#f59e0b",
  reddit: "#ef4444",
  hackernews: "#f97316",
};

const ALL_SOURCES = ["remotive", "jobicy", "arbeitnow", "reddit", "hackernews"];

// ── Page ──

export default function JobsPage() {
  const t = useTranslations("jobs");
  const [messageApi, contextHolder] = message.useMessage();

  const [activeTab, setActiveTab] = useState<string>("offers");

  // Offers state
  const [listings, setListings] = useState<ListingsResponse | null>(null);
  const [offersLoading, setOffersLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("new");
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);

  // Alerts state
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<JobAlert | null>(null);
  const [alertForm] = Form.useForm();

  // ── Fetch offers ──
  const fetchOffers = useCallback(
    async (status = "new") => {
      setOffersLoading(true);
      try {
        const res = await fetch(
          `/api/job-listings?status=${status}&limit=50`
        );
        if (res.ok) {
          const data: ListingsResponse = await res.json();
          setListings(data);
        }
      } catch (error) {
        console.error("Failed to fetch offers:", error);
      } finally {
        setOffersLoading(false);
      }
    },
    []
  );

  // ── Fetch alerts ──
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch("/api/job-alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers(statusFilter);
    fetchAlerts();
  }, [fetchOffers, fetchAlerts, statusFilter]);

  // ── Update match status ──
  const updateMatchStatus = async (matchId: string, newStatus: string) => {
    setUpdatingMatchId(matchId);
    try {
      const res = await fetch(`/api/job-listings/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      messageApi.success(t("offers.statusUpdated"));
      fetchOffers(statusFilter);
    } catch {
      messageApi.error(t("offers.statusUpdateFailed"));
    } finally {
      setUpdatingMatchId(null);
    }
  };

  // ── Add to CRM ──
  const addToCrm = async (matchId: string) => {
    setUpdatingMatchId(matchId);
    try {
      const res = await fetch(`/api/job-listings/${matchId}/to-prospect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      messageApi.success(t("offers.addedToCrmSuccess"));
      fetchOffers(statusFilter);
    } catch {
      messageApi.error(t("offers.addedToCrmFailed"));
    } finally {
      setUpdatingMatchId(null);
    }
  };

  // ── Create/update alert ──
  const handleAlertSubmit = async (values: Record<string, unknown>) => {
    try {
      const url = editingAlert
        ? `/api/job-alerts/${editingAlert.id}`
        : "/api/job-alerts";
      const method = editingAlert ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error("Failed");

      messageApi.success(
        editingAlert ? t("alerts.updated") : t("alerts.created")
      );
      setAlertModalOpen(false);
      setEditingAlert(null);
      alertForm.resetFields();
      fetchAlerts();
    } catch {
      messageApi.error(
        editingAlert ? t("alerts.updateFailed") : t("alerts.createFailed")
      );
    }
  };

  // ── Toggle alert active ──
  const toggleAlert = async (alert: JobAlert) => {
    try {
      const res = await fetch(`/api/job-alerts/${alert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !alert.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      messageApi.success(t("alerts.updated"));
      fetchAlerts();
    } catch {
      messageApi.error(t("alerts.updateFailed"));
    }
  };

  // ── Delete alert ──
  const deleteAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/job-alerts/${alertId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      messageApi.success(t("alerts.deleted"));
      fetchAlerts();
      fetchOffers(statusFilter);
    } catch {
      messageApi.error(t("alerts.deleteFailed"));
    }
  };

  // ── Open edit modal ──
  const openEditAlert = (alert: JobAlert) => {
    setEditingAlert(alert);
    alertForm.setFieldsValue({
      name: alert.name,
      keywords: alert.keywords,
      excludeKeywords: alert.excludeKeywords,
      sources: alert.sources,
      maxPerDay: alert.maxPerDay,
      isActive: alert.isActive,
    });
    setAlertModalOpen(true);
  };

  // ── Status counts ──
  const counts = listings?.counts || {};
  const totalNew = counts["new"] || 0;

  return (
    <MainLayout>
      {contextHolder}
      <div className="space-y-5">
        {/* ━━━ Header ━━━ */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 40,
                height: 40,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              }}
            >
              <SearchOutlined style={{ color: "#fff", fontSize: 18 }} />
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

          <Segmented
            value={activeTab}
            onChange={(val) => setActiveTab(val as string)}
            options={[
              {
                label: (
                  <span className="flex items-center gap-1.5 px-1">
                    <SearchOutlined />
                    {t("tabs.offers")}
                    {totalNew > 0 && (
                      <Badge
                        count={totalNew}
                        size="small"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </span>
                ),
                value: "offers",
              },
              {
                label: (
                  <span className="flex items-center gap-1.5 px-1">
                    <TagOutlined />
                    {t("tabs.alerts")}
                  </span>
                ),
                value: "alerts",
              },
            ]}
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* ━━━ TAB: OFFERS ━━━ */}
        <div style={{ display: activeTab === "offers" ? "block" : "none" }}>
          {/* Status filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {[
              { key: "new", label: t("offers.new"), count: counts["new"] },
              { key: "saved", label: t("offers.saved"), count: counts["saved"] },
              { key: "dismissed", label: t("offers.dismissed"), count: counts["dismissed"] },
              { key: "added_to_crm", label: t("offers.addedToCrm"), count: counts["added_to_crm"] },
              { key: "all", label: t("offers.all"), count: undefined },
            ].map((item) => (
              <Button
                key={item.key}
                size="small"
                type={statusFilter === item.key ? "primary" : "default"}
                onClick={() => setStatusFilter(item.key)}
                style={{
                  borderRadius: 16,
                  fontWeight: statusFilter === item.key ? 600 : 400,
                  ...(statusFilter === item.key
                    ? { background: "#6366f1", border: "none" }
                    : {}),
                }}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 && (
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>
                    ({item.count})
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Offer cards */}
          {offersLoading ? (
            <div className="flex justify-center py-16">
              <Spin
                indicator={
                  <LoadingOutlined
                    style={{ fontSize: 32, color: "#6366f1" }}
                    spin
                  />
                }
              />
            </div>
          ) : listings && listings.matches.length > 0 ? (
            <div className="space-y-3">
              {listings.matches.map((match) => (
                <JobCard
                  key={match.id}
                  match={match}
                  isUpdating={updatingMatchId === match.id}
                  onSave={() => updateMatchStatus(match.id, "saved")}
                  onDismiss={() => updateMatchStatus(match.id, "dismissed")}
                  onAddToCrm={() => addToCrm(match.id)}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "#fafbfc", border: "1px solid #e5e7eb" }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text strong style={{ fontSize: 15, display: "block", marginBottom: 4 }}>
                      {t("offers.empty")}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {t("offers.emptyDesc")}
                    </Text>
                  </div>
                }
              />
              {alerts.length === 0 && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setActiveTab("alerts");
                    setAlertModalOpen(true);
                  }}
                  style={{
                    marginTop: 16,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  {t("alerts.create")}
                </Button>
              )}
            </div>
          )}

          {/* Future auto-apply note */}
          <div
            className="mt-4 rounded-lg px-4 py-3 flex items-center gap-2"
            style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
          >
            <InfoCircleOutlined style={{ color: "#3b82f6", fontSize: 14 }} />
            <Text style={{ fontSize: 12, color: "#1d4ed8" }}>
              {t("offers.autoApplyFuture")}
            </Text>
          </div>
        </div>

        {/* ━━━ TAB: ALERTS ━━━ */}
        <div style={{ display: activeTab === "alerts" ? "block" : "none" }}>
          {/* Cron info banner */}
          <div
            className="mb-4 rounded-lg px-4 py-3 flex items-center gap-2"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            <ClockCircleOutlined style={{ color: "#16a34a", fontSize: 14 }} />
            <Text style={{ fontSize: 12, color: "#166534" }}>
              {t("alerts.cronInfo")}
            </Text>
          </div>

          <div className="flex items-center justify-between mb-4">
            <Text strong style={{ fontSize: 15 }}>
              {t("alerts.title")}
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingAlert(null);
                alertForm.resetFields();
                setAlertModalOpen(true);
              }}
              style={{
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                border: "none",
                fontWeight: 600,
              }}
            >
              {t("alerts.create")}
            </Button>
          </div>

          {alertsLoading ? (
            <div className="flex justify-center py-16">
              <Spin
                indicator={
                  <LoadingOutlined
                    style={{ fontSize: 32, color: "#6366f1" }}
                    spin
                  />
                }
              />
            </div>
          ) : alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl p-4"
                  style={{
                    background: "#fff",
                    border: `1px solid ${alert.isActive ? "#e5e7eb" : "#f3f4f6"}`,
                    opacity: alert.isActive ? 1 : 0.6,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Text strong style={{ fontSize: 14 }}>
                          {alert.name}
                        </Text>
                        <Tag
                          color={alert.isActive ? "green" : "default"}
                          style={{ borderRadius: 10, fontSize: 11, fontWeight: 600 }}
                        >
                          {alert.isActive ? t("alerts.active") : t("alerts.inactive")}
                        </Tag>
                        <Tag style={{ borderRadius: 10, fontSize: 11 }}>
                          {t("alerts.matchCount", {
                            count: alert._count.matches,
                          })}
                        </Tag>
                      </div>

                      {/* Keywords */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {alert.keywords.map((kw, i) => (
                          <Tag
                            key={i}
                            color="blue"
                            style={{ borderRadius: 12, fontSize: 11 }}
                          >
                            {kw}
                          </Tag>
                        ))}
                        {alert.excludeKeywords.map((kw, i) => (
                          <Tag
                            key={`ex-${i}`}
                            color="red"
                            style={{ borderRadius: 12, fontSize: 11 }}
                          >
                            -{kw}
                          </Tag>
                        ))}
                      </div>

                      {/* Sources + meta */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-1">
                          {alert.sources.map((src) => (
                            <Tag
                              key={src}
                              style={{
                                borderRadius: 8,
                                fontSize: 10,
                                color: SOURCE_COLORS[src] || "#6b7280",
                                borderColor: SOURCE_COLORS[src] || "#d1d5db",
                                background: "transparent",
                              }}
                            >
                              {src}
                            </Tag>
                          ))}
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Max: {alert.maxPerDay}/jour
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {t("alerts.lastFetch")}:{" "}
                          {alert.lastFetchAt
                            ? new Date(alert.lastFetchAt).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : t("alerts.never")}
                        </Text>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        size="small"
                        checked={alert.isActive}
                        onChange={() => toggleAlert(alert)}
                      />
                      <Tooltip title={t("alerts.edit")}>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => openEditAlert(alert)}
                          style={{ borderRadius: 6 }}
                        />
                      </Tooltip>
                      <Popconfirm
                        title={t("alerts.deleteConfirm")}
                        onConfirm={() => deleteAlert(alert.id)}
                        okText={t("alerts.delete")}
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title={t("alerts.delete")}>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            style={{ borderRadius: 6 }}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "#fafbfc", border: "1px solid #e5e7eb" }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text
                      strong
                      style={{
                        fontSize: 15,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      {t("alerts.empty")}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {t("alerts.emptyDesc")}
                    </Text>
                  </div>
                }
              />
            </div>
          )}
        </div>

        {/* ━━━ ALERT MODAL ━━━ */}
        <Modal
          open={alertModalOpen}
          title={editingAlert ? t("alerts.edit") : t("alerts.create")}
          onCancel={() => {
            setAlertModalOpen(false);
            setEditingAlert(null);
            alertForm.resetFields();
          }}
          footer={null}
          width={520}
        >
          <Form
            form={alertForm}
            layout="vertical"
            onFinish={handleAlertSubmit}
            requiredMark={false}
            initialValues={{
              maxPerDay: 5,
              isActive: true,
              sources: ALL_SOURCES,
            }}
          >
            <Form.Item
              name="name"
              label={t("alerts.name")}
              rules={[{ required: true, message: t("alerts.nameRequired") }]}
            >
              <Input
                placeholder={t("alerts.namePlaceholder")}
                style={{ borderRadius: 8 }}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="keywords"
              label={t("alerts.keywords")}
              rules={[
                { required: true, message: t("alerts.keywordsRequired") },
              ]}
              extra={
                <Text type="secondary" className="text-xs">
                  {t("alerts.keywordsHelp")}
                </Text>
              }
            >
              <Select
                mode="tags"
                placeholder={t("alerts.keywordsPlaceholder")}
                style={{ borderRadius: 8 }}
                size="large"
                tokenSeparators={[","]}
              />
            </Form.Item>

            <Form.Item
              name="excludeKeywords"
              label={t("alerts.excludeKeywords")}
              extra={
                <Text type="secondary" className="text-xs">
                  {t("alerts.excludeHelp")}
                </Text>
              }
            >
              <Select
                mode="tags"
                placeholder={t("alerts.excludePlaceholder")}
                style={{ borderRadius: 8 }}
                size="large"
                tokenSeparators={[","]}
              />
            </Form.Item>

            <Form.Item
              name="sources"
              label={t("alerts.sources")}
              extra={
                <Text type="secondary" className="text-xs">
                  {t("alerts.sourcesHelp")}
                </Text>
              }
            >
              <Select
                mode="multiple"
                style={{ borderRadius: 8 }}
                size="large"
                options={ALL_SOURCES.map((s) => ({
                  value: s,
                  label: t(`sources.${s}`),
                }))}
              />
            </Form.Item>

            <Form.Item name="maxPerDay" label={t("alerts.maxPerDay")}>
              <InputNumber
                min={1}
                max={20}
                style={{ width: "100%", borderRadius: 8 }}
                size="large"
              />
            </Form.Item>

            <Form.Item name="isActive" valuePropName="checked">
              <Switch checkedChildren={t("alerts.active")} unCheckedChildren={t("alerts.inactive")} />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              icon={editingAlert ? <CheckCircleOutlined /> : <PlusOutlined />}
              style={{
                borderRadius: 10,
                height: 48,
                fontWeight: 600,
                fontSize: 15,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                border: "none",
              }}
            >
              {editingAlert ? t("alerts.edit") : t("alerts.create")}
            </Button>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
}

// ── Job Card Component ──

function JobCard({
  match,
  isUpdating,
  onSave,
  onDismiss,
  onAddToCrm,
  t,
}: {
  match: JobMatch;
  isUpdating: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onAddToCrm: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const listing = match.jobListing;
  const sourceColor = SOURCE_COLORS[listing.source] || "#6b7280";

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      {/* Header: title + source */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            <Text
              strong
              style={{ fontSize: 14, color: "#111827", cursor: "pointer" }}
              className="hover:underline"
            >
              {listing.title}
            </Text>
          </a>
          {listing.company && (
            <Text
              type="secondary"
              style={{ fontSize: 12, display: "block", marginTop: 2 }}
            >
              {listing.company}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Tag
            style={{
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              color: sourceColor,
              borderColor: sourceColor,
              background: "transparent",
              margin: 0,
            }}
          >
            {listing.source}
          </Tag>
          <Tag
            style={{
              borderRadius: 10,
              fontSize: 10,
              margin: 0,
              background: "#f9fafb",
              color: "#6b7280",
              border: "1px solid #e5e7eb",
            }}
          >
            {match.alert.name}
          </Tag>
        </div>
      </div>

      {/* Description excerpt */}
      {listing.description && (
        <Paragraph
          type="secondary"
          style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}
          ellipsis={{ rows: 2 }}
        >
          {listing.description}
        </Paragraph>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {listing.location && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <EnvironmentOutlined style={{ fontSize: 11 }} />
            {listing.location}
          </span>
        )}
        {listing.salary && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <DollarOutlined style={{ fontSize: 11 }} />
            {listing.salary}
          </span>
        )}
        {listing.contactEmail && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <MailOutlined style={{ fontSize: 11 }} />
            {listing.contactEmail}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <ClockCircleOutlined style={{ fontSize: 11 }} />
          {new Date(listing.publishedAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>

      {/* Tags */}
      {listing.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {listing.tags.slice(0, 6).map((tag, i) => (
            <Tag
              key={i}
              style={{ borderRadius: 10, fontSize: 10, margin: 0 }}
            >
              {tag}
            </Tag>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid #f3f4f6" }}>
        <a href={listing.url} target="_blank" rel="noopener noreferrer">
          <Button
            size="small"
            type="primary"
            icon={<LinkOutlined />}
            style={{
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              border: "none",
              height: 28,
            }}
          >
            {t("offers.openOriginal")}
          </Button>
        </a>

        {match.status === "new" && (
          <>
            <Button
              size="small"
              icon={isUpdating ? <LoadingOutlined /> : <SaveOutlined />}
              onClick={onSave}
              loading={isUpdating}
              style={{ borderRadius: 6, fontSize: 11, height: 28, fontWeight: 500 }}
            >
              {t("offers.save")}
            </Button>
            <Button
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={onDismiss}
              loading={isUpdating}
              style={{
                borderRadius: 6,
                fontSize: 11,
                height: 28,
                fontWeight: 500,
                color: "#9ca3af",
              }}
            >
              {t("offers.dismiss")}
            </Button>
          </>
        )}

        {match.status !== "added_to_crm" && (
          <Button
            size="small"
            icon={<TeamOutlined />}
            onClick={onAddToCrm}
            loading={isUpdating}
            style={{
              borderRadius: 6,
              fontSize: 11,
              height: 28,
              fontWeight: 500,
              marginLeft: "auto",
              color: "#6366f1",
              borderColor: "#6366f1",
            }}
          >
            {t("offers.addToCrm")}
          </Button>
        )}

        {match.status === "added_to_crm" && (
          <Tag
            color="green"
            style={{ borderRadius: 10, fontSize: 11, marginLeft: "auto" }}
          >
            <CheckCircleOutlined /> CRM
          </Tag>
        )}
      </div>
    </div>
  );
}
