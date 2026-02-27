"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Typography,
  Table,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  DatePicker,
  Drawer,
  InputNumber,
  Dropdown,
  Badge,
  Spin,
  message,
  Popconfirm,
  Tooltip,
  Empty,
  Space,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableRowSelection } from "antd/es/table/interface";
import type { MenuProps } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  SearchOutlined,
  LinkOutlined,
  MailOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  StarOutlined,
  PhoneOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  NodeIndexOutlined,
  SendOutlined,
  MinusCircleOutlined,
  ClockCircleOutlined,
  BellOutlined,
  DownOutlined,
  CarryOutOutlined,
  StopOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── Types ──

interface SequenceStep {
  id: string;
  order: number;
  relativeDays: number;
  actionType: string;
  content: string | null;
  status: string;
  dueDate: string | null;
  sentAt: string | null;
  notes: string | null;
}

interface Sequence {
  id: string;
  name: string;
  prospectId: string;
  steps: SequenceStep[];
  createdAt: string;
}

interface ReminderStep {
  id: string;
  order: number;
  actionType: string;
  content: string | null;
  status: string;
  dueDate: string | null;
  sequenceId: string;
  sequenceName: string;
  prospect: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
  };
}

interface Prospect {
  id: string;
  name: string;
  linkedinUrl?: string | null;
  email?: string | null;
  company?: string | null;
  status: string;
  notes?: string | null;
  lastContactDate?: string | null;
  followUpDate?: string | null;
  firstContactDate?: string | null;
  // Enrichment fields
  companySize?: string | null;
  companyIndustry?: string | null;
  companyDescription?: string | null;
  website?: string | null;
  enrichedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  new: number;
  contacted: number;
  replied: number;
  interested: number;
  converted: number;
  lost: number;
  followUpThisWeek: number;
  overdueFollowUps: number;
}

// ── Status config ──

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  new: {
    color: "#6366f1",
    bg: "#eef2ff",
    border: "#c7d2fe",
    icon: <StarOutlined />,
  },
  contacted: {
    color: "#0a66c2",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: <PhoneOutlined />,
  },
  replied: {
    color: "#8b5cf6",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    icon: <MessageOutlined />,
  },
  interested: {
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: <CheckCircleOutlined />,
  },
  converted: {
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    icon: <RocketOutlined />,
  },
  lost: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: <CloseCircleOutlined />,
  },
};

const STATUS_KEYS = [
  "new",
  "contacted",
  "replied",
  "interested",
  "converted",
  "lost",
] as const;

// ── Action type config ──
const ACTION_TYPE_CONFIG: Record<
  string,
  { color: string; icon: React.ReactNode }
> = {
  connection: { color: "#0a66c2", icon: <LinkOutlined /> },
  message: { color: "#6366f1", icon: <MessageOutlined /> },
  email: { color: "#f59e0b", icon: <MailOutlined /> },
  call: { color: "#10b981", icon: <PhoneOutlined /> },
  note: { color: "#6b7280", icon: <FileTextOutlined /> },
};

const ACTION_TYPE_KEYS = ["connection", "message", "email", "call", "note"] as const;

// ── Predefined sequence templates ──
const SEQUENCE_TEMPLATES = {
  standard: {
    name: "Séquence Standard (3 touches)",
    steps: [
      { relativeDays: 0, actionType: "connection", content: "" },
      { relativeDays: 3, actionType: "message", content: "" },
      { relativeDays: 7, actionType: "message", content: "" },
    ],
  },
  aggressive: {
    name: "Séquence Intensive (5 touches)",
    steps: [
      { relativeDays: 0, actionType: "connection", content: "" },
      { relativeDays: 2, actionType: "message", content: "" },
      { relativeDays: 5, actionType: "email", content: "" },
      { relativeDays: 9, actionType: "message", content: "" },
      { relativeDays: 14, actionType: "email", content: "" },
    ],
  },
  soft: {
    name: "Séquence Douce (2 touches)",
    steps: [
      { relativeDays: 0, actionType: "message", content: "" },
      { relativeDays: 10, actionType: "message", content: "" },
    ],
  },
};

// ── Page ──

export default function CrmPage() {
  const t = useTranslations("crm");
  const [messageApi, contextHolder] = message.useMessage();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Sequence states
  const [sequenceDrawerOpen, setSequenceDrawerOpen] = useState(false);
  const [sequenceProspect, setSequenceProspect] = useState<Prospect | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoadingSequences, setIsLoadingSequences] = useState(false);
  const [createSequenceOpen, setCreateSequenceOpen] = useState(false);
  const [sequenceForm] = Form.useForm();
  const [isCreatingSequence, setIsCreatingSequence] = useState(false);

  // Reminder states
  const [reminders, setReminders] = useState<{
    overdue: ReminderStep[];
    today: ReminderStep[];
    upcoming: ReminderStep[];
  }>({ overdue: [], today: [], upcoming: [] });

  // ── Fetch prospects ──
  const fetchProspects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (searchText.trim()) params.set("search", searchText.trim());

      const response = await fetch(`/api/prospects?${params.toString()}`);
      const data = await response.json();
      if (response.ok) {
        setProspects(data.prospects || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch prospects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchText]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  // ── Modal handlers ──
  const openAddModal = () => {
    setEditingProspect(null);
    form.resetFields();
    form.setFieldsValue({ status: "new" });
    setModalOpen(true);
  };

  const openEditModal = (prospect: Prospect) => {
    setEditingProspect(prospect);
    form.setFieldsValue({
      name: prospect.name,
      email: prospect.email || "",
      company: prospect.company || "",
      linkedinUrl: prospect.linkedinUrl || "",
      status: prospect.status,
      notes: prospect.notes || "",
      lastContactDate: prospect.lastContactDate
        ? dayjs(prospect.lastContactDate)
        : null,
      followUpDate: prospect.followUpDate
        ? dayjs(prospect.followUpDate)
        : null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);

      const body = {
        name: values.name,
        email: values.email || null,
        company: values.company || null,
        linkedinUrl: values.linkedinUrl || null,
        status: values.status,
        notes: values.notes || null,
        lastContactDate: values.lastContactDate
          ? values.lastContactDate.toISOString()
          : null,
        followUpDate: values.followUpDate
          ? values.followUpDate.toISOString()
          : null,
      };

      const url = editingProspect
        ? `/api/prospects/${editingProspect.id}`
        : "/api/prospects";
      const method = editingProspect ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Save failed");

      messageApi.success(
        editingProspect ? t("messages.updated") : t("messages.created")
      );
      setModalOpen(false);
      fetchProspects();
    } catch {
      messageApi.error(
        editingProspect
          ? t("messages.updateFailed")
          : t("messages.createFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/prospects/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
      messageApi.success(t("messages.deleted"));
      fetchProspects();
    } catch {
      messageApi.error(t("messages.deleteFailed"));
    }
  };

  const handleQuickStatus = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/prospects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchProspects();
    } catch {
      messageApi.error(t("messages.updateFailed"));
    }
  };

  const clearSelection = () => {
    setSelectedRowKeys([]);
  };

  const handleBulkStatus = async (newStatus: string) => {
    if (selectedRowKeys.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        selectedRowKeys.map((id) =>
          fetch(`/api/prospects/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled" && result.value.ok
      ).length;
      if (successCount > 0) {
        messageApi.success(
          t("bulk.statusUpdated", {
            count: successCount,
          })
        );
      } else {
        messageApi.error(t("bulk.statusUpdateFailed"));
      }
      clearSelection();
      fetchProspects();
    } catch {
      messageApi.error(t("bulk.statusUpdateFailed"));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        selectedRowKeys.map((id) =>
          fetch(`/api/prospects/${id}`, {
            method: "DELETE",
          })
        )
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled" && result.value.ok
      ).length;
      if (successCount > 0) {
        messageApi.success(
          t("bulk.deleted", {
            count: successCount,
          })
        );
      } else {
        messageApi.error(t("bulk.deleteFailed"));
      }
      clearSelection();
      fetchProspects();
      fetchReminders();
    } catch {
      messageApi.error(t("bulk.deleteFailed"));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkEnrich = async () => {
    if (selectedRowKeys.length === 0) return;
    const selectedProspects = prospects.filter((prospect) =>
      selectedRowKeys.includes(prospect.id)
    );
    const enrichableProspects = selectedProspects.filter(
      (prospect) => prospect.email || prospect.company
    );

    if (enrichableProspects.length === 0) {
      messageApi.warning(t("bulk.noEnrichable"));
      return;
    }

    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        enrichableProspects.map((prospect) =>
          fetch("/api/enrich-prospect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prospectId: prospect.id }),
          })
        )
      );

      const successCount = results.filter((result) => {
        if (result.status !== "fulfilled" || !result.value.ok) return false;
        return true;
      }).length;

      if (successCount > 0) {
        messageApi.success(
          t("bulk.enriched", {
            count: successCount,
          })
        );
      } else {
        messageApi.info(t("bulk.enrichNoData"));
      }
      clearSelection();
      fetchProspects();
    } catch {
      messageApi.error(t("bulk.enrichFailed"));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // ── Enrich prospect ──
  const handleEnrich = async (prospect: Prospect) => {
    if (!prospect.email && !prospect.company) {
      messageApi.warning(t("enrich.noDomain"));
      return;
    }

    setEnrichingId(prospect.id);
    try {
      const response = await fetch("/api/enrich-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        messageApi.error(data.error || t("enrich.failed"));
        return;
      }

      if (data.limitReached) {
        messageApi.warning(t("enrich.limitReached"));
        return;
      }

      if (data.notFound) {
        messageApi.info(t("enrich.noData"));
        return;
      }

      if (data.success) {
        messageApi.success(t("enrich.success"));
        fetchProspects();
      } else {
        messageApi.info(t("enrich.noData"));
      }
    } catch {
      messageApi.error(t("enrich.failed"));
    } finally {
      setEnrichingId(null);
    }
  };

  // ── Fetch reminders ──
  const fetchReminders = useCallback(async () => {
    try {
      const response = await fetch("/api/followups/today");
      if (response.ok) {
        const data = await response.json();
        setReminders({
          overdue: data.overdue || [],
          today: data.today || [],
          upcoming: data.upcoming || [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // ── Sequence handlers ──
  const openSequenceDrawer = async (prospect: Prospect) => {
    setSequenceProspect(prospect);
    setSequenceDrawerOpen(true);
    setIsLoadingSequences(true);
    try {
      const response = await fetch(`/api/prospects/${prospect.id}/sequences`);
      if (response.ok) {
        const data = await response.json();
        setSequences(data.sequences || []);
      }
    } catch (error) {
      console.error("Failed to fetch sequences:", error);
    } finally {
      setIsLoadingSequences(false);
    }
  };

  const handleApplyTemplate = (templateKey: string) => {
    const template = SEQUENCE_TEMPLATES[templateKey as keyof typeof SEQUENCE_TEMPLATES];
    if (!template) return;

    sequenceForm.setFieldsValue({
      name: template.name,
      steps: template.steps,
    });
    setCreateSequenceOpen(true);
  };

  const handleCreateSequence = async () => {
    if (!sequenceProspect) return;
    try {
      const values = await sequenceForm.validateFields();
      setIsCreatingSequence(true);

      const response = await fetch(
        `/api/prospects/${sequenceProspect.id}/sequences`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            steps: values.steps.map((s: { relativeDays: number; actionType: string; content?: string }) => ({
              relativeDays: s.relativeDays || 0,
              actionType: s.actionType || "message",
              content: s.content || "",
            })),
          }),
        }
      );

      if (!response.ok) throw new Error("Create failed");

      const newSeq = await response.json();
      setSequences((prev) => [newSeq, ...prev]);
      setCreateSequenceOpen(false);
      sequenceForm.resetFields();
      messageApi.success(t("sequence.created"));
      fetchProspects();
      fetchReminders();
    } catch {
      messageApi.error(t("sequence.createFailed"));
    } finally {
      setIsCreatingSequence(false);
    }
  };

  const handleDeleteSequence = async (sequenceId: string) => {
    if (!sequenceProspect) return;
    try {
      const response = await fetch(
        `/api/prospects/${sequenceProspect.id}/sequences`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequenceId }),
        }
      );
      if (!response.ok) throw new Error("Delete failed");
      setSequences((prev) => prev.filter((s) => s.id !== sequenceId));
      messageApi.success(t("sequence.deleted"));
      fetchReminders();
    } catch {
      messageApi.error(t("sequence.deleteFailed"));
    }
  };

  const handleUpdateStep = async (
    stepId: string,
    updates: { status?: string; notes?: string; content?: string }
  ) => {
    try {
      const response = await fetch(`/api/sequence-steps/${stepId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Update failed");

      // Refresh sequences
      if (sequenceProspect) {
        const res = await fetch(`/api/prospects/${sequenceProspect.id}/sequences`);
        if (res.ok) {
          const data = await res.json();
          setSequences(data.sequences || []);
        }
      }
      messageApi.success(t("sequence.stepUpdated"));
      fetchProspects();
      fetchReminders();
    } catch {
      messageApi.error(t("sequence.stepUpdateFailed"));
    }
  };

  // ── Step display helpers ──
  const getStepDueTag = (step: SequenceStep) => {
    if (step.status !== "pending" || !step.dueDate) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(step.dueDate);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diff = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return <Tag color="error" style={{ fontSize: 10, borderRadius: 4 }}>{t("sequence.overdue")}</Tag>;
    if (diff === 0) return <Tag color="warning" style={{ fontSize: 10, borderRadius: 4 }}>{t("sequence.dueToday")}</Tag>;
    if (diff <= 3) return <Tag color="blue" style={{ fontSize: 10, borderRadius: 4 }}>{t("sequence.dueSoon")}</Tag>;
    return null;
  };

  // ── Follow-up display helpers ──
  const getFollowUpTag = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const diffDays = Math.ceil(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      return (
        <Tag
          color="error"
          style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}
        >
          <ExclamationCircleOutlined /> {t("table.overdue")}
        </Tag>
      );
    }
    if (diffDays === 0) {
      return (
        <Tag
          color="warning"
          style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}
        >
          <CalendarOutlined /> {t("table.today")}
        </Tag>
      );
    }
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {date.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        })}
      </Text>
    );
  };

  // ── Table columns ──
  const columns: ColumnsType<Prospect> = [
    {
      title: t("table.name"),
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (name: string, record: Prospect) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Text strong style={{ fontSize: 13 }}>
              {name}
            </Text>
            {record.enrichedAt && (
              <Tooltip title={`${t("enrich.enriched")} ${new Date(record.enrichedAt).toLocaleDateString("fr-FR")}`}>
                <SafetyCertificateOutlined style={{ color: "#10b981", fontSize: 12 }} />
              </Tooltip>
            )}
          </div>
          {record.company && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.company}
              </Text>
            </div>
          )}
          {/* Enrichment badges */}
          {record.enrichedAt && (
            <div className="flex flex-wrap gap-1 mt-1">
              {record.companyIndustry && (
                <Tag
                  color="blue"
                  style={{ fontSize: 10, lineHeight: "16px", margin: 0, borderRadius: 4, padding: "0 4px" }}
                >
                  {record.companyIndustry}
                </Tag>
              )}
              {record.companySize && (
                <Tag
                  color="cyan"
                  style={{ fontSize: 10, lineHeight: "16px", margin: 0, borderRadius: 4, padding: "0 4px" }}
                >
                  {record.companySize} {t("enrich.employees")}
                </Tag>
              )}
              {record.website && (
                <a href={record.website.startsWith("http") ? record.website : `https://${record.website}`} target="_blank" rel="noopener noreferrer">
                  <Tag
                    color="green"
                    style={{ fontSize: 10, lineHeight: "16px", margin: 0, borderRadius: 4, padding: "0 4px", cursor: "pointer" }}
                  >
                    <GlobalOutlined /> {t("enrich.website")}
                  </Tag>
                </a>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t("table.email"),
      dataIndex: "email",
      key: "email",
      width: 180,
      render: (email: string | null) =>
        email ? (
          <a
            href={`mailto:${email}`}
            className="text-xs"
            style={{ color: "#0a66c2" }}
          >
            {email}
          </a>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Text>
        ),
    },
    {
      title: t("table.linkedin"),
      dataIndex: "linkedinUrl",
      key: "linkedinUrl",
      width: 80,
      align: "center",
      render: (url: string | null) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button
              type="text"
              size="small"
              icon={<LinkOutlined />}
              style={{ color: "#0a66c2" }}
            />
          </a>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: t("table.status"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: string, record: Prospect) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
        return (
          <Select
            value={status}
            size="small"
            variant="borderless"
            onChange={(v) => handleQuickStatus(record.id, v)}
            style={{ width: 130 }}
            options={STATUS_KEYS.map((key) => ({
              value: key,
              label: (
                <span style={{ color: STATUS_CONFIG[key].color, fontSize: 12, fontWeight: 500 }}>
                  {STATUS_CONFIG[key].icon} {t(`status.${key}`)}
                </span>
              ),
            }))}
            popupMatchSelectWidth={false}
          >
            <Tag
              style={{
                background: config.bg,
                color: config.color,
                border: `1px solid ${config.border}`,
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {config.icon} {t(`status.${status}`)}
            </Tag>
          </Select>
        );
      },
    },
    {
      title: t("table.followUp"),
      dataIndex: "followUpDate",
      key: "followUpDate",
      width: 110,
      align: "center",
      render: (date: string | null) => getFollowUpTag(date),
    },
    {
      title: t("table.notes"),
      dataIndex: "notes",
      key: "notes",
      width: 200,
      ellipsis: true,
      render: (notes: string | null) =>
        notes ? (
          <Tooltip title={notes}>
            <Text
              type="secondary"
              style={{ fontSize: 12 }}
              ellipsis={{ tooltip: false }}
            >
              {notes.length > 60 ? notes.slice(0, 60) + "…" : notes}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Text>
        ),
    },
    {
      title: t("table.actions"),
      key: "actions",
      width: 170,
      align: "center",
      render: (_: unknown, record: Prospect) => {
        const canEnrich = !!(record.email || record.company);
        const isEnriching = enrichingId === record.id;

        return (
          <Space size={4}>
            <Tooltip title={t("sequence.title")}>
              <Button
                type="text"
                size="small"
                icon={<NodeIndexOutlined />}
                onClick={() => openSequenceDrawer(record)}
                style={{ color: "#8b5cf6" }}
              />
            </Tooltip>
            <Tooltip
              title={
                record.enrichedAt
                  ? `${t("enrich.enriched")} ${new Date(record.enrichedAt).toLocaleDateString("fr-FR")}`
                  : canEnrich
                    ? t("actions.enrich")
                    : t("enrich.noDomain")
              }
            >
              <Button
                type="text"
                size="small"
                icon={isEnriching ? <LoadingOutlined spin /> : <ThunderboltOutlined />}
                onClick={() => handleEnrich(record)}
                disabled={!canEnrich || isEnriching}
                style={{
                  color: record.enrichedAt
                    ? "#10b981"
                    : canEnrich
                      ? "#f59e0b"
                      : "#d1d5db",
                }}
              />
            </Tooltip>
            <Tooltip title={t("actions.edit")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
                style={{ color: "#6366f1" }}
              />
            </Tooltip>
            <Popconfirm
              title={t("messages.deleteConfirm")}
              onConfirm={() => handleDelete(record.id)}
              okText={t("actions.delete")}
              cancelText={t("actions.cancel")}
              okButtonProps={{ danger: true }}
            >
              <Tooltip title={t("actions.delete")}>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // ── Stats cards ──
  const statCards = [
    {
      key: "total",
      value: stats?.total || 0,
      icon: <TeamOutlined />,
      color: "#374151",
      bg: "#f9fafb",
    },
    {
      key: "interested",
      value: stats?.interested || 0,
      icon: <CheckCircleOutlined />,
      color: "#16a34a",
      bg: "#f0fdf4",
    },
    {
      key: "followUpWeek",
      value: stats?.followUpThisWeek || 0,
      icon: <CalendarOutlined />,
      color: "#f59e0b",
      bg: "#fffbeb",
    },
    {
      key: "converted",
      value: stats?.converted || 0,
      icon: <RocketOutlined />,
      color: "#059669",
      bg: "#ecfdf5",
    },
    {
      key: "overdue",
      value: stats?.overdueFollowUps || 0,
      icon: <ExclamationCircleOutlined />,
      color: "#dc2626",
      bg: "#fef2f2",
    },
  ];

  const statusOptions = [
    { value: "all", label: t("status.all") },
    ...STATUS_KEYS.map((key) => ({
      value: key,
      label: t(`status.${key}`),
    })),
  ];

  const rowSelection: TableRowSelection<Prospect> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys as string[]),
    preserveSelectedRowKeys: true,
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
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              }}
            >
              <TeamOutlined style={{ color: "#fff", fontSize: 18 }} />
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAddModal}
            size="large"
            style={{
              borderRadius: 10,
              fontWeight: 600,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              border: "none",
              height: 44,
            }}
          >
            {t("actions.add")}
          </Button>
        </div>

        {/* ━━━ Stats Dashboard ━━━ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map((stat) => (
            <div
              key={stat.key}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                background: stat.bg,
                border: "1px solid #f0f0f0",
              }}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 36,
                  height: 36,
                  background: `${stat.color}15`,
                  color: stat.color,
                  fontSize: 16,
                }}
              >
                {stat.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: stat.color,
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <Text
                  type="secondary"
                  style={{ fontSize: 11, lineHeight: 1.2 }}
                >
                  {t(`stats.${stat.key}`)}
                </Text>
              </div>
            </div>
          ))}
        </div>

        {/* ━━━ Reminders ━━━ */}
        {(reminders.overdue.length > 0 || reminders.today.length > 0 || reminders.upcoming.length > 0) && (
          <div
            className="rounded-xl p-4"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <BellOutlined style={{ color: "#f59e0b", fontSize: 16 }} />
              <Text strong style={{ fontSize: 14 }}>{t("reminders.title")}</Text>
              <Badge
                count={reminders.overdue.length + reminders.today.length + reminders.upcoming.length}
                style={{ backgroundColor: "#f59e0b" }}
              />
            </div>
            <div className="space-y-2">
              {reminders.overdue.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
                  onClick={() => {
                    const p = prospects.find((pp) => pp.id === r.prospect.id);
                    if (p) openSequenceDrawer(p);
                  }}
                >
                  <Tag color="error" style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>{t("reminders.overdue")}</Tag>
                  <span style={{ fontSize: 12, color: ACTION_TYPE_CONFIG[r.actionType]?.color || "#6b7280" }}>
                    {ACTION_TYPE_CONFIG[r.actionType]?.icon}
                  </span>
                  <Text style={{ fontSize: 12, flex: 1 }}>
                    <Text strong style={{ fontSize: 12 }}>{r.prospect.name}</Text>
                    {r.prospect.company && <Text type="secondary" style={{ fontSize: 11 }}> · {r.prospect.company}</Text>}
                    <Text type="secondary" style={{ fontSize: 11 }}> — {t(`sequence.actionTypes.${r.actionType}`)}</Text>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {r.dueDate && new Date(r.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </Text>
                </div>
              ))}
              {reminders.today.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
                  onClick={() => {
                    const p = prospects.find((pp) => pp.id === r.prospect.id);
                    if (p) openSequenceDrawer(p);
                  }}
                >
                  <Tag color="warning" style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>{t("reminders.today")}</Tag>
                  <span style={{ fontSize: 12, color: ACTION_TYPE_CONFIG[r.actionType]?.color || "#6b7280" }}>
                    {ACTION_TYPE_CONFIG[r.actionType]?.icon}
                  </span>
                  <Text style={{ fontSize: 12, flex: 1 }}>
                    <Text strong style={{ fontSize: 12 }}>{r.prospect.name}</Text>
                    {r.prospect.company && <Text type="secondary" style={{ fontSize: 11 }}> · {r.prospect.company}</Text>}
                    <Text type="secondary" style={{ fontSize: 11 }}> — {t(`sequence.actionTypes.${r.actionType}`)}</Text>
                  </Text>
                </div>
              ))}
              {reminders.upcoming.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow"
                  style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
                  onClick={() => {
                    const p = prospects.find((pp) => pp.id === r.prospect.id);
                    if (p) openSequenceDrawer(p);
                  }}
                >
                  <Tag color="blue" style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>{t("reminders.upcoming")}</Tag>
                  <span style={{ fontSize: 12, color: ACTION_TYPE_CONFIG[r.actionType]?.color || "#6b7280" }}>
                    {ACTION_TYPE_CONFIG[r.actionType]?.icon}
                  </span>
                  <Text style={{ fontSize: 12, flex: 1 }}>
                    <Text strong style={{ fontSize: 12 }}>{r.prospect.name}</Text>
                    {r.prospect.company && <Text type="secondary" style={{ fontSize: 11 }}> · {r.prospect.company}</Text>}
                    <Text type="secondary" style={{ fontSize: 11 }}> — {t(`sequence.actionTypes.${r.actionType}`)}</Text>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {r.dueDate && new Date(r.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ━━━ Filters ━━━ */}
        <div
          className="rounded-xl p-4 flex flex-wrap items-center gap-3"
          style={{ background: "#fff", border: "1px solid #e5e7eb" }}
        >
          <Input
            placeholder={t("table.searchPlaceholder")}
            prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ borderRadius: 8, maxWidth: 320, flex: 1 }}
            size="large"
            allowClear
          />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusOptions}
            style={{ borderRadius: 8, minWidth: 160 }}
            size="large"
          />
        </div>

        {/* ━━━ Table ━━━ */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid #e5e7eb" }}
        >
          {selectedRowKeys.length > 0 && (
            <div
              className="px-4 py-3 flex flex-wrap items-center gap-2"
              style={{ borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}
            >
              <Text strong style={{ fontSize: 13 }}>
                {t("bulk.selectedCount", { count: selectedRowKeys.length })}
              </Text>
              <Select
                size="small"
                style={{ minWidth: 170 }}
                placeholder={t("bulk.changeStatus")}
                onChange={handleBulkStatus}
                disabled={isBulkProcessing}
                options={STATUS_KEYS.map((key) => ({
                  value: key,
                  label: t(`status.${key}`),
                }))}
              />
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={handleBulkEnrich}
                loading={isBulkProcessing}
              >
                {t("bulk.enrich")}
              </Button>
              <Popconfirm
                title={t("bulk.deleteConfirm")}
                onConfirm={handleBulkDelete}
                okText={t("actions.delete")}
                cancelText={t("actions.cancel")}
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={isBulkProcessing}
                >
                  {t("bulk.delete")}
                </Button>
              </Popconfirm>
              <Button size="small" type="text" onClick={clearSelection}>
                {t("bulk.clearSelection")}
              </Button>
            </div>
          )}
          <Table
            columns={columns}
            dataSource={prospects}
            rowKey="id"
            rowSelection={rowSelection}
            loading={isLoading}
            pagination={{
              pageSize: 15,
              showSizeChanger: false,
              showTotal: (total) => `${total} prospects`,
              style: { padding: "0 16px" },
            }}
            scroll={{ x: 900 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div className="text-center py-4">
                      <Text
                        strong
                        style={{
                          display: "block",
                          fontSize: 15,
                          color: "#374151",
                          marginBottom: 4,
                        }}
                      >
                        {t("table.noProspects")}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {t("table.noProspectsDesc")}
                      </Text>
                    </div>
                  }
                />
              ),
            }}
            style={{ fontSize: 13 }}
          />
        </div>
      </div>

      {/* ━━━ Add/Edit Modal ━━━ */}
      <Modal
        title={null}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={520}
        destroyOnClose
        centered
        styles={{ body: { padding: 0 } }}
      >
        {/* Modal header */}
        <div
          className="px-6 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, #fafafa 0%, #eef2ff 100%)",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              }}
            >
              {editingProspect ? (
                <EditOutlined style={{ color: "#fff", fontSize: 16 }} />
              ) : (
                <PlusOutlined style={{ color: "#fff", fontSize: 16 }} />
              )}
            </div>
            <Text strong className="text-base">
              {editingProspect ? t("modal.editTitle") : t("modal.addTitle")}
            </Text>
          </div>
        </div>

        <div className="px-6 py-5">
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{ status: "new" }}
          >
            {/* Name */}
            <Form.Item
              name="name"
              label={
                <span className="font-medium text-sm">{t("modal.name")}</span>
              }
              rules={[
                { required: true, message: t("modal.nameRequired") },
              ]}
            >
              <Input
                placeholder={t("modal.namePlaceholder")}
                prefix={<UserOutlined style={{ color: "#9ca3af" }} />}
                style={{ borderRadius: 8 }}
                size="large"
              />
            </Form.Item>

            {/* Email + Company */}
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="email"
                label={
                  <span className="font-medium text-sm">
                    {t("modal.email")}
                  </span>
                }
              >
                <Input
                  placeholder={t("modal.emailPlaceholder")}
                  prefix={<MailOutlined style={{ color: "#9ca3af" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
              <Form.Item
                name="company"
                label={
                  <span className="font-medium text-sm">
                    {t("modal.company")}
                  </span>
                }
              >
                <Input
                  placeholder={t("modal.companyPlaceholder")}
                  prefix={<GlobalOutlined style={{ color: "#9ca3af" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
            </div>

            {/* LinkedIn + Status */}
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="linkedinUrl"
                label={
                  <span className="font-medium text-sm">
                    {t("modal.linkedin")}
                  </span>
                }
              >
                <Input
                  placeholder={t("modal.linkedinPlaceholder")}
                  prefix={<LinkOutlined style={{ color: "#9ca3af" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
              <Form.Item
                name="status"
                label={
                  <span className="font-medium text-sm">
                    {t("modal.status")}
                  </span>
                }
              >
                <Select
                  style={{ borderRadius: 8 }}
                  options={STATUS_KEYS.map((key) => ({
                    value: key,
                    label: (
                      <span
                        style={{
                          color: STATUS_CONFIG[key].color,
                          fontWeight: 500,
                        }}
                      >
                        {STATUS_CONFIG[key].icon} {t(`status.${key}`)}
                      </span>
                    ),
                  }))}
                />
              </Form.Item>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="lastContactDate"
                label={
                  <span className="font-medium text-sm">
                    {t("modal.lastContact")}
                  </span>
                }
              >
                <DatePicker
                  style={{ width: "100%", borderRadius: 8 }}
                  format="DD/MM/YYYY"
                />
              </Form.Item>
              <Form.Item
                name="followUpDate"
                label={
                  <span className="font-medium text-sm">
                    {t("modal.followUp")}
                  </span>
                }
                extra={
                  <Text type="secondary" className="text-xs">
                    {t("modal.followUpHelp")}
                  </Text>
                }
              >
                <DatePicker
                  style={{ width: "100%", borderRadius: 8 }}
                  format="DD/MM/YYYY"
                />
              </Form.Item>
            </div>

            {/* Enrichment data (read-only, shown only when editing an enriched prospect) */}
            {editingProspect?.enrichedAt && (
              <div
                className="rounded-lg p-3 mb-4"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <SafetyCertificateOutlined style={{ color: "#10b981", fontSize: 14 }} />
                  <Text strong style={{ fontSize: 12, color: "#065f46" }}>
                    {t("enrich.enriched")} — {new Date(editingProspect.enrichedAt).toLocaleDateString("fr-FR")}
                  </Text>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingProspect.companyIndustry && (
                    <Tag color="blue" style={{ margin: 0, borderRadius: 4 }}>
                      {t("enrich.industry")}: {editingProspect.companyIndustry}
                    </Tag>
                  )}
                  {editingProspect.companySize && (
                    <Tag color="cyan" style={{ margin: 0, borderRadius: 4 }}>
                      {t("enrich.companySize")}: {editingProspect.companySize}
                    </Tag>
                  )}
                  {editingProspect.website && (
                    <a
                      href={editingProspect.website.startsWith("http") ? editingProspect.website : `https://${editingProspect.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Tag color="green" style={{ margin: 0, borderRadius: 4, cursor: "pointer" }}>
                        <GlobalOutlined /> {editingProspect.website}
                      </Tag>
                    </a>
                  )}
                </div>
                {editingProspect.companyDescription && (
                  <Text
                    type="secondary"
                    style={{ fontSize: 11, display: "block", marginTop: 6 }}
                  >
                    {editingProspect.companyDescription.length > 200
                      ? editingProspect.companyDescription.slice(0, 200) + "…"
                      : editingProspect.companyDescription}
                  </Text>
                )}
              </div>
            )}

            {/* Notes */}
            <Form.Item
              name="notes"
              label={
                <span className="font-medium text-sm">
                  {t("modal.notes")}
                </span>
              }
            >
              <TextArea
                rows={3}
                placeholder={t("modal.notesPlaceholder")}
                style={{ borderRadius: 8, resize: "none" }}
                showCount
                maxLength={2000}
              />
            </Form.Item>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => setModalOpen(false)}>
                {t("actions.cancel")}
              </Button>
              <Button
                type="primary"
                onClick={handleSave}
                loading={isSaving}
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  border: "none",
                  fontWeight: 600,
                  borderRadius: 8,
                }}
              >
                {t("actions.save")}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
      {/* ━━━ Sequence Drawer ━━━ */}
      <Drawer
        title={null}
        open={sequenceDrawerOpen}
        onClose={() => {
          setSequenceDrawerOpen(false);
          setSequenceProspect(null);
          setSequences([]);
        }}
        width={520}
        styles={{ body: { padding: 0 } }}
      >
        {sequenceProspect && (
          <>
            {/* Drawer header */}
            <div
              className="px-5 pt-5 pb-4"
              style={{
                background: "linear-gradient(135deg, #fafafa 0%, #f3e8ff 100%)",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
                >
                  <NodeIndexOutlined style={{ color: "#fff", fontSize: 16 }} />
                </div>
                <div>
                  <Text strong style={{ fontSize: 15 }}>{t("sequence.title")}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {sequenceProspect.name}
                      {sequenceProspect.company && ` · ${sequenceProspect.company}`}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <Dropdown
                  menu={{
                    items: (Object.keys(SEQUENCE_TEMPLATES) as Array<keyof typeof SEQUENCE_TEMPLATES>).map((key) => ({
                      key,
                      label: (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 12 }}>{t(`sequence.templates.${key}`)}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{t(`sequence.templates.${key}Desc`)}</div>
                        </div>
                      ),
                    })) as MenuProps["items"],
                    onClick: ({ key }) => handleApplyTemplate(key),
                  }}
                >
                  <Button
                    icon={<CarryOutOutlined />}
                    style={{ borderRadius: 8, fontSize: 12, fontWeight: 500 }}
                  >
                    {t("sequence.applyTemplate")} <DownOutlined />
                  </Button>
                </Dropdown>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => {
                    sequenceForm.resetFields();
                    sequenceForm.setFieldsValue({
                      name: "",
                      steps: [{ relativeDays: 0, actionType: "message", content: "" }],
                    });
                    setCreateSequenceOpen(true);
                  }}
                  style={{ borderRadius: 8, fontSize: 12, fontWeight: 500 }}
                >
                  {t("sequence.createCustom")}
                </Button>
              </div>
            </div>

            {/* Sequences list */}
            <div className="p-5">
              {isLoadingSequences ? (
                <div className="flex justify-center py-12">
                  <Spin indicator={<LoadingOutlined spin />} />
                </div>
              ) : sequences.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div className="text-center">
                      <Text strong style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 4 }}>
                        {t("sequence.noSequences")}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t("sequence.noSequencesDesc")}
                      </Text>
                    </div>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {sequences.map((seq) => (
                    <div
                      key={seq.id}
                      className="rounded-xl"
                      style={{ border: "1px solid #e5e7eb", overflow: "hidden" }}
                    >
                      {/* Sequence header */}
                      <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{ background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}
                      >
                        <div>
                          <Text strong style={{ fontSize: 13 }}>{seq.name}</Text>
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {seq.steps.length} étapes · {new Date(seq.createdAt).toLocaleDateString("fr-FR")}
                            </Text>
                          </div>
                        </div>
                        <Popconfirm
                          title={t("sequence.deleteConfirm")}
                          onConfirm={() => handleDeleteSequence(seq.id)}
                          okText={t("actions.delete")}
                          cancelText={t("actions.cancel")}
                          okButtonProps={{ danger: true }}
                        >
                          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </div>

                      {/* Steps timeline */}
                      <div className="px-4 py-3">
                        {seq.steps.map((step, idx) => {
                          const actionConf = ACTION_TYPE_CONFIG[step.actionType] || ACTION_TYPE_CONFIG.note;
                          const isLast = idx === seq.steps.length - 1;
                          const isDone = step.status === "sent" || step.status === "responded" || step.status === "skipped";

                          return (
                            <div key={step.id} className="flex gap-3">
                              {/* Timeline line */}
                              <div className="flex flex-col items-center" style={{ width: 24 }}>
                                <div
                                  className="flex items-center justify-center rounded-full"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    background: isDone
                                      ? step.status === "skipped" ? "#f3f4f6" : "#ecfdf5"
                                      : `${actionConf.color}15`,
                                    color: isDone
                                      ? step.status === "skipped" ? "#9ca3af" : "#10b981"
                                      : actionConf.color,
                                    fontSize: 11,
                                    border: `2px solid ${isDone
                                      ? step.status === "skipped" ? "#d1d5db" : "#10b981"
                                      : actionConf.color
                                    }`,
                                  }}
                                >
                                  {isDone ? (
                                    step.status === "skipped" ? <StopOutlined /> : <CheckCircleOutlined />
                                  ) : (
                                    actionConf.icon
                                  )}
                                </div>
                                {!isLast && (
                                  <div
                                    style={{
                                      width: 2,
                                      flex: 1,
                                      minHeight: 20,
                                      background: isDone ? "#10b981" : "#e5e7eb",
                                    }}
                                  />
                                )}
                              </div>

                              {/* Step content */}
                              <div className={`flex-1 ${isLast ? "" : "pb-3"}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <Text strong style={{ fontSize: 12, color: isDone ? "#6b7280" : "#111827", textDecoration: step.status === "skipped" ? "line-through" : "none" }}>
                                    J+{step.relativeDays} — {t(`sequence.actionTypes.${step.actionType}`)}
                                  </Text>
                                  {getStepDueTag(step)}
                                  {step.status === "sent" && (
                                    <Tag color="success" style={{ fontSize: 10, borderRadius: 4, margin: 0 }}>
                                      {t("sequence.stepStatus.sent")}
                                    </Tag>
                                  )}
                                  {step.status === "responded" && (
                                    <Tag color="purple" style={{ fontSize: 10, borderRadius: 4, margin: 0 }}>
                                      {t("sequence.stepStatus.responded")}
                                    </Tag>
                                  )}
                                  {step.status === "skipped" && (
                                    <Tag color="default" style={{ fontSize: 10, borderRadius: 4, margin: 0 }}>
                                      {t("sequence.stepStatus.skipped")}
                                    </Tag>
                                  )}
                                </div>

                                {step.dueDate && step.status === "pending" && (
                                  <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                                    <ClockCircleOutlined /> {new Date(step.dueDate).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                                  </Text>
                                )}
                                {step.sentAt && (
                                  <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                                    <SendOutlined /> {t("sequence.sentOn")} {new Date(step.sentAt).toLocaleDateString("fr-FR")}
                                  </Text>
                                )}

                                {step.content && (
                                  <div
                                    className="rounded-md px-2.5 py-1.5 mt-1"
                                    style={{ background: "#f9fafb", fontSize: 11, color: "#374151", border: "1px solid #f0f0f0" }}
                                  >
                                    {step.content.length > 120 ? step.content.slice(0, 120) + "…" : step.content}
                                  </div>
                                )}

                                {/* Action buttons for pending steps */}
                                {step.status === "pending" && (
                                  <div className="flex gap-1.5 mt-2">
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<CheckCircleOutlined />}
                                      onClick={() => handleUpdateStep(step.id, { status: "sent" })}
                                      style={{
                                        fontSize: 11,
                                        borderRadius: 6,
                                        background: "#10b981",
                                        border: "none",
                                        height: 26,
                                      }}
                                    >
                                      {t("sequence.markSent")}
                                    </Button>
                                    <Button
                                      size="small"
                                      icon={<StarOutlined />}
                                      onClick={() => handleUpdateStep(step.id, { status: "responded" })}
                                      style={{ fontSize: 11, borderRadius: 6, height: 26, color: "#8b5cf6", borderColor: "#c4b5fd" }}
                                    >
                                      {t("sequence.markResponded")}
                                    </Button>
                                    <Button
                                      size="small"
                                      icon={<StopOutlined />}
                                      onClick={() => handleUpdateStep(step.id, { status: "skipped" })}
                                      style={{ fontSize: 11, borderRadius: 6, height: 26, color: "#9ca3af" }}
                                    >
                                      {t("sequence.markSkipped")}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Drawer>

      {/* ━━━ Create Sequence Modal ━━━ */}
      <Modal
        title={null}
        open={createSequenceOpen}
        onCancel={() => setCreateSequenceOpen(false)}
        footer={null}
        width={560}
        destroyOnClose
        centered
        styles={{ body: { padding: 0 } }}
      >
        <div
          className="px-6 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, #fafafa 0%, #f3e8ff 100%)",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
            >
              <NodeIndexOutlined style={{ color: "#fff", fontSize: 16 }} />
            </div>
            <Text strong className="text-base">{t("sequence.create")}</Text>
          </div>
        </div>

        <div className="px-6 py-5">
          <Form
            form={sequenceForm}
            layout="vertical"
            requiredMark={false}
            initialValues={{
              name: "",
              steps: [{ relativeDays: 0, actionType: "message", content: "" }],
            }}
          >
            <Form.Item
              name="name"
              label={<span className="font-medium text-sm">{t("sequence.name")}</span>}
              rules={[{ required: true, message: t("sequence.nameRequired") }]}
            >
              <Input
                placeholder={t("sequence.namePlaceholder")}
                style={{ borderRadius: 8 }}
                size="large"
              />
            </Form.Item>

            <Text strong style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
              Étapes de la séquence
            </Text>

            <Form.List name="steps">
              {(fields, { add, remove }) => (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.key}
                      className="rounded-lg p-3"
                      style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Text strong style={{ fontSize: 12, color: "#6366f1" }}>
                          {t("sequence.step", { order: index + 1 })}
                        </Text>
                        {fields.length > 1 && (
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(field.name)}
                            style={{ fontSize: 11 }}
                          >
                            {t("sequence.removeStep")}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Form.Item
                          {...field}
                          name={[field.name, "relativeDays"]}
                          label={<span style={{ fontSize: 11 }}>{t("sequence.relativeDays")}</span>}
                          style={{ marginBottom: 8 }}
                        >
                          <InputNumber
                            min={0}
                            max={90}
                            style={{ width: "100%", borderRadius: 6 }}
                            placeholder="0"
                            addonAfter="j"
                          />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "actionType"]}
                          label={<span style={{ fontSize: 11 }}>{t("sequence.actionType")}</span>}
                          style={{ marginBottom: 8 }}
                        >
                          <Select
                            style={{ borderRadius: 6 }}
                            options={ACTION_TYPE_KEYS.map((key) => ({
                              value: key,
                              label: (
                                <span style={{ fontSize: 12, color: ACTION_TYPE_CONFIG[key].color }}>
                                  {ACTION_TYPE_CONFIG[key].icon} {t(`sequence.actionTypes.${key}`)}
                                </span>
                              ),
                            }))}
                          />
                        </Form.Item>
                      </div>
                      <Form.Item
                        {...field}
                        name={[field.name, "content"]}
                        label={<span style={{ fontSize: 11 }}>{t("sequence.contentLabel")}</span>}
                        style={{ marginBottom: 0 }}
                      >
                        <Input.TextArea
                          rows={2}
                          placeholder={t("sequence.contentPlaceholder")}
                          style={{ borderRadius: 6, resize: "none", fontSize: 12 }}
                        />
                      </Form.Item>
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ relativeDays: 0, actionType: "message", content: "" })}
                    icon={<PlusOutlined />}
                    style={{ width: "100%", borderRadius: 8 }}
                  >
                    {t("sequence.addStep")}
                  </Button>
                </div>
              )}
            </Form.List>

            <div className="flex justify-end gap-3 pt-4 mt-4" style={{ borderTop: "1px solid #f0f0f0" }}>
              <Button onClick={() => setCreateSequenceOpen(false)}>
                {t("actions.cancel")}
              </Button>
              <Button
                type="primary"
                onClick={handleCreateSequence}
                loading={isCreatingSequence}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                  border: "none",
                  fontWeight: 600,
                  borderRadius: 8,
                }}
              >
                {t("sequence.create")}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </MainLayout>
  );
}
