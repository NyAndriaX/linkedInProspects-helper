"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Typography,
  Form,
  Input,
  Select,
  message,
  Empty,
  Avatar,
  Spin,
  Tooltip,
  Divider,
  Tag,
  Segmented,
  Progress,
  Alert,
} from "antd";
import {
  SendOutlined,
  CopyOutlined,
  ReloadOutlined,
  UserOutlined,
  CheckOutlined,
  MessageOutlined,
  LinkOutlined,
  RetweetOutlined,
  TeamOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  MailOutlined,
  SearchOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProfile } from "@/hooks/useProfile";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ── Types ──

interface GeneratedMessage {
  message: string;
  suggestedSubject: string | null;
  length: number;
}

interface OutreachFormValues {
  prospectName: string;
  prospectDetails: string;
  messageType: "connection" | "inmail" | "followup";
  myExpertise?: string;
  tone?: string;
}

interface EmailResult {
  success: boolean;
  email?: string;
  confidence?: number;
  position?: string | null;
  domain?: string;
  company?: string;
  name?: string;
  verification?: {
    result: string;
    score: number;
    mxRecords: boolean;
    smtpCheck: boolean;
    disposable: boolean;
    webmail: boolean;
  } | null;
  remaining: number;
  limit: number;
  limitReached?: boolean;
  notFound?: boolean;
}

// ── Constants ──

const MAX_CHARS: Record<string, number> = {
  connection: 300,
  inmail: 800,
  followup: 800,
};

const TYPE_COLORS: Record<string, string> = {
  connection: "#0a66c2",
  inmail: "#7c3aed",
  followup: "#ea580c",
};

// ── Page Component ──

export default function OutreachPage() {
  const t = useTranslations("outreach");
  const { data: session } = useSession();
  const { profile } = useProfile();
  const [messageApi, contextHolder] = message.useMessage();

  const [activeTab, setActiveTab] = useState<string>("message");
  const [isMobile, setIsMobile] = useState(false);

  // ── Message Generator State ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState<GeneratedMessage | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [currentType, setCurrentType] = useState<string>("connection");
  const [form] = Form.useForm<OutreachFormValues>();

  // ── Email Finder State ──
  const [emailForm] = Form.useForm();
  const [isSearching, setIsSearching] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Pre-fill expertise from user profile
  useEffect(() => {
    if (profile?.jobTitle) {
      const parts = [
        profile.jobTitle,
        profile.company ? `chez ${profile.company}` : "",
        profile.expertise?.length
          ? `spécialisé en ${profile.expertise.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(", ");
      form.setFieldValue("myExpertise", parts);
    }
  }, [profile, form]);

  // ═══════════════════════════════════
  //  MESSAGE GENERATOR HANDLERS
  // ═══════════════════════════════════

  const handleGenerate = useCallback(
    async (values: OutreachFormValues) => {
      setIsGenerating(true);
      setGeneratedMsg(null);
      setCopied(false);
      try {
        const response = await fetch("/api/generate-outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 429) {
            messageApi.warning(t("errors.rateLimited"));
          } else {
            messageApi.error(data.error || t("errors.generateFailed"));
          }
          return;
        }
        setGeneratedMsg(data);
        setCurrentType(values.messageType);
      } catch {
        messageApi.error(t("errors.generateFailed"));
      } finally {
        setIsGenerating(false);
      }
    },
    [messageApi, t]
  );

  const handleCopy = useCallback(() => {
    if (!generatedMsg) return;
    const textToCopy = generatedMsg.suggestedSubject
      ? `Sujet: ${generatedMsg.suggestedSubject}\n\n${generatedMsg.message}`
      : generatedMsg.message;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    messageApi.success(t("result.copied"));
    setTimeout(() => setCopied(false), 2500);
  }, [generatedMsg, messageApi, t]);

  const handleRegenerate = useCallback(() => {
    form.submit();
  }, [form]);

  const handleFollowup = useCallback(() => {
    form.setFieldValue("messageType", "followup");
    setCurrentType("followup");
    setTimeout(() => form.submit(), 50);
  }, [form]);

  // ═══════════════════════════════════
  //  EMAIL FINDER HANDLERS
  // ═══════════════════════════════════

  const handleFindEmail = useCallback(
    async (values: { name: string; company: string; domain?: string; linkedinUrl?: string }) => {
      setIsSearching(true);
      setEmailResult(null);
      setEmailCopied(false);
      try {
        const response = await fetch("/api/find-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 503) {
            messageApi.error(t("emailFinder.result.apiNotConfigured"));
          } else {
            messageApi.error(data.error || "Search failed");
          }
          return;
        }
        setEmailResult(data);
      } catch {
        messageApi.error("Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [messageApi, t]
  );

  const handleCopyEmail = useCallback(() => {
    if (!emailResult?.email) return;
    navigator.clipboard.writeText(emailResult.email);
    setEmailCopied(true);
    messageApi.success(t("emailFinder.result.copied"));
    setTimeout(() => setEmailCopied(false), 2500);
  }, [emailResult, messageApi, t]);

  const handleUseForOutreach = useCallback(() => {
    if (!emailResult) return;
    // Pre-fill the message form with prospect data
    form.setFieldValue("prospectName", emailResult.name || "");
    const details = [
      emailResult.position ? `Poste : ${emailResult.position}` : "",
      emailResult.company ? `Entreprise : ${emailResult.company}` : "",
      emailResult.email ? `Email : ${emailResult.email}` : "",
      emailResult.domain ? `Domaine : ${emailResult.domain}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    form.setFieldValue("prospectDetails", details);
    // Switch to message tab
    setActiveTab("message");
    messageApi.success("Prospect pré-rempli dans le formulaire message !");
  }, [emailResult, form, messageApi]);

  // ── Add to CRM handler (from message tab) ──
  const handleAddToCrmFromMessage = useCallback(async () => {
    const prospectName = form.getFieldValue("prospectName");
    const prospectDetails = form.getFieldValue("prospectDetails") || "";
    if (!prospectName) {
      messageApi.warning("Remplissez le nom du prospect d'abord");
      return;
    }
    try {
      const response = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prospectName,
          notes: prospectDetails,
          status: "contacted",
          lastContactDate: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error("Failed");
      messageApi.success("Prospect ajouté au CRM !");
    } catch {
      messageApi.error("Échec de l'ajout au CRM");
    }
  }, [form, messageApi]);

  // ── Add to CRM handler (from email finder) ──
  const handleAddToCrmFromEmail = useCallback(async () => {
    if (!emailResult) return;
    try {
      const response = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emailResult.name || "",
          email: emailResult.email || null,
          company: emailResult.company || null,
          status: "new",
        }),
      });
      if (!response.ok) throw new Error("Failed");
      messageApi.success("Prospect sauvegardé dans le CRM !");
    } catch {
      messageApi.error("Échec de l'ajout au CRM");
    }
  }, [emailResult, messageApi]);

  // ── Derived values ──
  const charMax = MAX_CHARS[currentType] || 300;
  const charUsed = generatedMsg?.length || 0;
  const charPercent = charMax > 0 ? (charUsed / charMax) * 100 : 0;
  const charColor =
    charPercent > 100 ? "#ef4444" : charPercent > 85 ? "#f59e0b" : "#22c55e";

  const userName = session?.user?.name || "Utilisateur";
  const userImage = session?.user?.image;

  const typeBadgeLabel =
    currentType === "connection"
      ? t("result.connectionBadge")
      : currentType === "inmail"
        ? t("result.inmailBadge")
        : t("result.followupBadge");

  // Verification status helpers
  const getVerificationColor = (result?: string) => {
    switch (result) {
      case "deliverable":
        return "#22c55e";
      case "risky":
        return "#f59e0b";
      case "undeliverable":
        return "#ef4444";
      default:
        return "#9ca3af";
    }
  };

  const getVerificationIcon = (result?: string) => {
    switch (result) {
      case "deliverable":
        return <CheckCircleOutlined />;
      case "risky":
        return <ExclamationCircleOutlined />;
      case "undeliverable":
        return <CloseCircleOutlined />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  const getVerificationLabel = (result?: string) => {
    switch (result) {
      case "deliverable":
        return t("emailFinder.result.deliverable");
      case "risky":
        return t("emailFinder.result.risky");
      case "undeliverable":
        return t("emailFinder.result.undeliverable");
      default:
        return t("emailFinder.result.unknown");
    }
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
                background: "linear-gradient(135deg, #0a66c2, #004182)",
              }}
            >
              <SendOutlined style={{ color: "#fff", fontSize: 18 }} />
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

          {/* Tab switcher */}
          <Segmented
            value={activeTab}
            onChange={(val) => setActiveTab(val as string)}
            options={[
              {
                label: (
                  <span className="flex items-center gap-1.5 px-1">
                    <MessageOutlined /> {t("tabs.message")}
                  </span>
                ),
                value: "message",
              },
              {
                label: (
                  <span className="flex items-center gap-1.5 px-1">
                    <MailOutlined /> {t("tabs.emailFinder")}
                  </span>
                ),
                value: "email",
              },
            ]}
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            TAB 1: MESSAGE OUTREACH
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{ display: activeTab === "message" ? "block" : "none" }}>
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1.15fr",
            }}
          >
            {/* LEFT: Form */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                alignSelf: "start",
              }}
            >
              <div
                className="px-5 py-3 flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #fafbfc, #f3f4f6)",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <MessageOutlined style={{ color: "#6b7280", fontSize: 15 }} />
                <Text strong style={{ fontSize: 14, color: "#374151" }}>
                  {t("formTitle")}
                </Text>
              </div>
              <div className="p-5">
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleGenerate}
                  requiredMark={false}
                  initialValues={{ messageType: "connection", tone: "pro" }}
                >
                  <Text
                    className="text-xs font-semibold uppercase tracking-wide mb-3 block"
                    style={{ color: "#9ca3af" }}
                  >
                    {t("form.sectionProspect")}
                  </Text>
                  <Form.Item
                    name="prospectName"
                    label={<span className="font-medium text-sm">{t("form.prospectName")}</span>}
                    rules={[{ required: true, message: t("form.prospectNameRequired") }]}
                  >
                    <Input
                      placeholder={t("form.prospectNamePlaceholder")}
                      prefix={<UserOutlined style={{ color: "#9ca3af" }} />}
                      style={{ borderRadius: 8 }}
                      size="large"
                    />
                  </Form.Item>
                  <Form.Item
                    name="prospectDetails"
                    label={<span className="font-medium text-sm">{t("form.prospectDetails")}</span>}
                    rules={[{ required: true, message: t("form.prospectDetailsRequired") }]}
                  >
                    <TextArea
                      rows={4}
                      placeholder={t("form.prospectDetailsPlaceholder")}
                      style={{ borderRadius: 8, resize: "none" }}
                      showCount
                      maxLength={1000}
                    />
                  </Form.Item>
                  <Divider style={{ margin: "16px 0" }} />
                  <Text
                    className="text-xs font-semibold uppercase tracking-wide mb-3 block"
                    style={{ color: "#9ca3af" }}
                  >
                    {t("form.sectionConfig")}
                  </Text>
                  <div className="grid grid-cols-2 gap-3">
                    <Form.Item
                      name="messageType"
                      label={<span className="font-medium text-sm">{t("form.messageType")}</span>}
                    >
                      <Select
                        style={{ borderRadius: 8 }}
                        size="large"
                        onChange={(v) => setCurrentType(v)}
                        options={[
                          { value: "connection", label: t("form.types.connection") },
                          { value: "inmail", label: t("form.types.inmail") },
                          { value: "followup", label: t("form.types.followup") },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      name="tone"
                      label={<span className="font-medium text-sm">{t("form.tone")}</span>}
                    >
                      <Select
                        style={{ borderRadius: 8 }}
                        size="large"
                        options={[
                          { value: "pro", label: t("form.tones.pro") },
                          { value: "friendly", label: t("form.tones.friendly") },
                          { value: "direct", label: t("form.tones.direct") },
                        ]}
                      />
                    </Form.Item>
                  </div>
                  <Divider style={{ margin: "16px 0" }} />
                  <Text
                    className="text-xs font-semibold uppercase tracking-wide mb-3 block"
                    style={{ color: "#9ca3af" }}
                  >
                    {t("form.sectionExpertise")}
                  </Text>
                  <Form.Item
                    name="myExpertise"
                    label={<span className="font-medium text-sm">{t("form.myExpertise")}</span>}
                    extra={<Text type="secondary" className="text-xs">{t("form.myExpertiseHelp")}</Text>}
                  >
                    <Input
                      placeholder={t("form.myExpertisePlaceholder")}
                      prefix={<RocketOutlined style={{ color: "#9ca3af" }} />}
                      style={{ borderRadius: 8 }}
                      size="large"
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isGenerating}
                    block
                    size="large"
                    icon={<SendOutlined />}
                    style={{
                      borderRadius: 10,
                      height: 48,
                      fontWeight: 600,
                      fontSize: 15,
                      background: isGenerating
                        ? undefined
                        : "linear-gradient(135deg, #0a66c2, #004182)",
                      border: "none",
                      marginTop: 8,
                    }}
                  >
                    {isGenerating ? t("form.generating") : t("form.generate")}
                  </Button>
                </Form>
              </div>
            </div>

            {/* RIGHT: Preview */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                alignSelf: "start",
              }}
            >
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{
                  background: "linear-gradient(135deg, #fafbfc, #f3f4f6)",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div className="flex items-center gap-2">
                  <LinkOutlined style={{ color: "#6b7280", fontSize: 15 }} />
                  <Text strong style={{ fontSize: 14, color: "#374151" }}>
                    {t("previewTitle")}
                  </Text>
                </div>
                {generatedMsg && (
                  <Tag
                    color={TYPE_COLORS[currentType]}
                    style={{ borderRadius: 12, fontWeight: 600, fontSize: 11, margin: 0 }}
                  >
                    {typeBadgeLabel}
                  </Tag>
                )}
              </div>
              <div className="p-5">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Spin size="large" />
                    <Text type="secondary" className="mt-4" style={{ fontSize: 14 }}>
                      {t("form.generating")}
                    </Text>
                  </div>
                ) : generatedMsg ? (
                  <div className="space-y-4">
                    <div
                      className="rounded-lg overflow-hidden"
                      style={{ border: "1px solid #e5e7eb", background: "#fafbfc" }}
                    >
                      <div
                        className="px-4 py-3 flex items-center gap-3"
                        style={{ borderBottom: "1px solid #f0f0f0" }}
                      >
                        <Avatar
                          src={userImage}
                          icon={!userImage && <UserOutlined />}
                          size={36}
                          style={{ background: "#0a66c2", flexShrink: 0 }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Text strong style={{ fontSize: 13, color: "#111827" }}>
                              {userName}
                            </Text>
                            <ArrowRightOutlined style={{ fontSize: 10, color: "#9ca3af" }} />
                            <Text strong style={{ fontSize: 13, color: "#111827" }}>
                              {form.getFieldValue("prospectName") || "Prospect"}
                            </Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            LinkedIn •{" "}
                            {new Date().toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </Text>
                        </div>
                      </div>
                      {generatedMsg.suggestedSubject && (
                        <div
                          className="px-4 py-2"
                          style={{ background: "#f8fafc", borderBottom: "1px solid #f0f0f0" }}
                        >
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {t("result.subject")}
                          </Text>
                          <div>
                            <Text strong style={{ fontSize: 13, color: "#1f2937" }}>
                              {generatedMsg.suggestedSubject}
                            </Text>
                          </div>
                        </div>
                      )}
                      <div className="px-4 py-4">
                        <Paragraph
                          style={{
                            fontSize: 14,
                            lineHeight: 1.7,
                            color: "#1f2937",
                            marginBottom: 0,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {generatedMsg.message}
                        </Paragraph>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="rounded-full"
                          style={{ width: 8, height: 8, background: charColor }}
                        />
                        <Text style={{ fontSize: 12, color: charColor, fontWeight: 500 }}>
                          {charUsed} / {charMax} caractères
                        </Text>
                      </div>
                      {charPercent > 100 && (
                        <Tag color="error" style={{ fontSize: 11, margin: 0 }}>
                          Trop long
                        </Tag>
                      )}
                    </div>
                    <div
                      className="flex flex-wrap gap-2 pt-2"
                      style={{ borderTop: "1px solid #f3f4f6" }}
                    >
                      <Button
                        type="primary"
                        icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                        onClick={handleCopy}
                        style={{
                          borderRadius: 8,
                          fontWeight: 600,
                          background: copied
                            ? "#22c55e"
                            : "linear-gradient(135deg, #0a66c2, #004182)",
                          border: "none",
                          height: 38,
                        }}
                      >
                        {copied ? t("result.copied") : t("result.copy")}
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRegenerate}
                        style={{ borderRadius: 8, height: 38, fontWeight: 500 }}
                      >
                        {t("result.regenerate")}
                      </Button>
                      {currentType !== "followup" && (
                        <Button
                          icon={<RetweetOutlined />}
                          onClick={handleFollowup}
                          style={{
                            borderRadius: 8,
                            height: 38,
                            fontWeight: 500,
                            color: "#ea580c",
                            borderColor: "#ea580c",
                          }}
                        >
                          {t("result.followup")}
                        </Button>
                      )}
                      <Button
                        icon={<TeamOutlined />}
                        onClick={handleAddToCrmFromMessage}
                        style={{
                          borderRadius: 8,
                          height: 38,
                          fontWeight: 500,
                          marginLeft: "auto",
                          color: "#6366f1",
                          borderColor: "#6366f1",
                        }}
                      >
                        {t("result.addToCrm")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div
                      className="flex items-center justify-center rounded-full mb-4"
                      style={{
                        width: 64,
                        height: 64,
                        background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                      }}
                    >
                      <SendOutlined style={{ fontSize: 28, color: "#0a66c2" }} />
                    </div>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      imageStyle={{ display: "none" }}
                      description={
                        <div className="text-center">
                          <Text
                            strong
                            style={{ fontSize: 15, color: "#374151", display: "block", marginBottom: 4 }}
                          >
                            {t("empty.title")}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {t("empty.description")}
                          </Text>
                        </div>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            TAB 2: EMAIL FINDER
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{ display: activeTab === "email" ? "block" : "none" }}>
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1.15fr",
            }}
          >
            {/* LEFT: Email Finder Form */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                alignSelf: "start",
              }}
            >
              <div
                className="px-5 py-3 flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #fafbfc, #f0fdf4)",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <SearchOutlined style={{ color: "#16a34a", fontSize: 15 }} />
                <Text strong style={{ fontSize: 14, color: "#374151" }}>
                  {t("emailFinder.title")}
                </Text>
              </div>
              <div className="p-5">
                <Form
                  form={emailForm}
                  layout="vertical"
                  onFinish={handleFindEmail}
                  requiredMark={false}
                >
                  <Form.Item
                    name="name"
                    label={<span className="font-medium text-sm">{t("emailFinder.form.name")}</span>}
                    rules={[{ required: true, message: t("emailFinder.form.nameRequired") }]}
                  >
                    <Input
                      placeholder={t("emailFinder.form.namePlaceholder")}
                      prefix={<UserOutlined style={{ color: "#9ca3af" }} />}
                      style={{ borderRadius: 8 }}
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    name="company"
                    label={<span className="font-medium text-sm">{t("emailFinder.form.company")}</span>}
                    rules={[{ required: true, message: t("emailFinder.form.companyRequired") }]}
                  >
                    <Input
                      placeholder={t("emailFinder.form.companyPlaceholder")}
                      prefix={<GlobalOutlined style={{ color: "#9ca3af" }} />}
                      style={{ borderRadius: 8 }}
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    name="domain"
                    label={<span className="font-medium text-sm">{t("emailFinder.form.domain")}</span>}
                    extra={
                      <Text type="secondary" className="text-xs">
                        {t("emailFinder.form.domainHelp")}
                      </Text>
                    }
                  >
                    <Input
                      placeholder={t("emailFinder.form.domainPlaceholder")}
                      prefix={<LinkOutlined style={{ color: "#9ca3af" }} />}
                      style={{ borderRadius: 8 }}
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    name="linkedinUrl"
                    label={
                      <span className="font-medium text-sm">{t("emailFinder.form.linkedinUrl")}</span>
                    }
                  >
                    <Input
                      placeholder={t("emailFinder.form.linkedinUrlPlaceholder")}
                      prefix={
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="#9ca3af"
                          style={{ flexShrink: 0 }}
                        >
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      }
                      style={{ borderRadius: 8 }}
                      size="large"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isSearching}
                    block
                    size="large"
                    icon={<SearchOutlined />}
                    style={{
                      borderRadius: 10,
                      height: 48,
                      fontWeight: 600,
                      fontSize: 15,
                      background: isSearching
                        ? undefined
                        : "linear-gradient(135deg, #16a34a, #15803d)",
                      border: "none",
                      marginTop: 8,
                    }}
                  >
                    {isSearching
                      ? t("emailFinder.form.searching")
                      : t("emailFinder.form.search")}
                  </Button>
                </Form>
              </div>
            </div>

            {/* RIGHT: Email Results */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                alignSelf: "start",
              }}
            >
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{
                  background: "linear-gradient(135deg, #fafbfc, #f0fdf4)",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div className="flex items-center gap-2">
                  <MailOutlined style={{ color: "#16a34a", fontSize: 15 }} />
                  <Text strong style={{ fontSize: 14, color: "#374151" }}>
                    {t("emailFinder.result.found").split(" ")[0]}
                  </Text>
                </div>
                {emailResult && typeof emailResult.remaining === "number" && (
                  <Tag
                    style={{
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: 11,
                      margin: 0,
                      background: emailResult.remaining > 3 ? "#f0fdf4" : "#fef2f2",
                      color: emailResult.remaining > 3 ? "#16a34a" : "#ef4444",
                      border: `1px solid ${emailResult.remaining > 3 ? "#bbf7d0" : "#fecaca"}`,
                    }}
                  >
                    {t("emailFinder.result.remainingCount", {
                      remaining: emailResult.remaining,
                      limit: emailResult.limit,
                    })}
                  </Tag>
                )}
              </div>

              <div className="p-5">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Spin size="large" />
                    <Text type="secondary" className="mt-4" style={{ fontSize: 14 }}>
                      {t("emailFinder.form.searching")}
                    </Text>
                  </div>
                ) : emailResult ? (
                  <div className="space-y-4">
                    {/* Limit Reached */}
                    {emailResult.limitReached && (
                      <Alert
                        type="warning"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        message={t("emailFinder.result.limitReached")}
                        description={t("emailFinder.result.limitReachedDesc", {
                          limit: emailResult.limit,
                        })}
                        style={{ borderRadius: 10 }}
                        action={
                          <Button
                            size="small"
                            type="link"
                            href="mailto:tsilavina@example.com?subject=More%20email%20credits"
                            style={{ fontWeight: 600, fontSize: 12 }}
                          >
                            {t("emailFinder.result.contactForMore")}
                          </Button>
                        }
                      />
                    )}

                    {/* Not Found */}
                    {emailResult.notFound && !emailResult.limitReached && (
                      <div className="text-center py-8">
                        <div
                          className="inline-flex items-center justify-center rounded-full mb-4"
                          style={{
                            width: 56,
                            height: 56,
                            background: "#fef2f2",
                          }}
                        >
                          <CloseCircleOutlined
                            style={{ fontSize: 24, color: "#ef4444" }}
                          />
                        </div>
                        <div>
                          <Text
                            strong
                            style={{
                              display: "block",
                              fontSize: 15,
                              color: "#374151",
                              marginBottom: 4,
                            }}
                          >
                            {t("emailFinder.result.notFound")}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {t("emailFinder.result.notFoundDesc")}
                          </Text>
                        </div>
                      </div>
                    )}

                    {/* Success: Email Found */}
                    {emailResult.success && emailResult.email && (
                      <>
                        {/* Email prominently displayed */}
                        <div
                          className="rounded-lg p-4"
                          style={{
                            background:
                              "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircleOutlined
                              style={{ color: "#16a34a", fontSize: 14 }}
                            />
                            <Text
                              type="secondary"
                              style={{ fontSize: 12, fontWeight: 600 }}
                            >
                              {t("emailFinder.result.found")}
                            </Text>
                          </div>
                          <Text
                            strong
                            copyable={{
                              text: emailResult.email,
                              tooltips: false,
                            }}
                            style={{
                              fontSize: 20,
                              color: "#111827",
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {emailResult.email}
                          </Text>
                        </div>

                        {/* Details grid */}
                        <div
                          className="grid grid-cols-2 gap-3"
                          style={{ fontSize: 13 }}
                        >
                          {/* Confidence */}
                          <div
                            className="rounded-lg p-3"
                            style={{
                              background: "#fafbfc",
                              border: "1px solid #f0f0f0",
                            }}
                          >
                            <Text
                              type="secondary"
                              className="text-xs block mb-1"
                            >
                              {t("emailFinder.result.confidence")}
                            </Text>
                            <div className="flex items-center gap-2">
                              <Progress
                                percent={emailResult.confidence || 0}
                                size="small"
                                showInfo={false}
                                strokeColor={
                                  (emailResult.confidence || 0) >= 80
                                    ? "#22c55e"
                                    : (emailResult.confidence || 0) >= 50
                                      ? "#f59e0b"
                                      : "#ef4444"
                                }
                                style={{ flex: 1, marginBottom: 0 }}
                              />
                              <Text
                                strong
                                style={{ fontSize: 14, minWidth: 36 }}
                              >
                                {emailResult.confidence}%
                              </Text>
                            </div>
                          </div>

                          {/* Verification */}
                          <div
                            className="rounded-lg p-3"
                            style={{
                              background: "#fafbfc",
                              border: "1px solid #f0f0f0",
                            }}
                          >
                            <Text
                              type="secondary"
                              className="text-xs block mb-1"
                            >
                              {t("emailFinder.result.status")}
                            </Text>
                            <div className="flex items-center gap-1.5">
                              <span
                                style={{
                                  color: getVerificationColor(
                                    emailResult.verification?.result
                                  ),
                                }}
                              >
                                {getVerificationIcon(
                                  emailResult.verification?.result
                                )}
                              </span>
                              <Text
                                strong
                                style={{
                                  fontSize: 14,
                                  color: getVerificationColor(
                                    emailResult.verification?.result
                                  ),
                                }}
                              >
                                {getVerificationLabel(
                                  emailResult.verification?.result
                                )}
                              </Text>
                            </div>
                          </div>

                          {/* Position */}
                          {emailResult.position && (
                            <div
                              className="rounded-lg p-3"
                              style={{
                                background: "#fafbfc",
                                border: "1px solid #f0f0f0",
                              }}
                            >
                              <Text
                                type="secondary"
                                className="text-xs block mb-1"
                              >
                                {t("emailFinder.result.position")}
                              </Text>
                              <Text strong style={{ fontSize: 13 }}>
                                {emailResult.position}
                              </Text>
                            </div>
                          )}

                          {/* Domain */}
                          <div
                            className="rounded-lg p-3"
                            style={{
                              background: "#fafbfc",
                              border: "1px solid #f0f0f0",
                            }}
                          >
                            <Text
                              type="secondary"
                              className="text-xs block mb-1"
                            >
                              {t("emailFinder.result.domain")}
                            </Text>
                            <Text strong style={{ fontSize: 13 }}>
                              {emailResult.domain}
                            </Text>
                          </div>
                        </div>

                        {/* Verification badges */}
                        {emailResult.verification && (
                          <div className="flex flex-wrap gap-1.5">
                            {emailResult.verification.mxRecords && (
                              <Tag
                                color="green"
                                style={{ borderRadius: 6, fontSize: 11 }}
                              >
                                <SafetyCertificateOutlined /> MX Records
                              </Tag>
                            )}
                            {emailResult.verification.smtpCheck && (
                              <Tag
                                color="green"
                                style={{ borderRadius: 6, fontSize: 11 }}
                              >
                                <CheckCircleOutlined /> SMTP
                              </Tag>
                            )}
                            {emailResult.verification.disposable && (
                              <Tag
                                color="red"
                                style={{ borderRadius: 6, fontSize: 11 }}
                              >
                                <ExclamationCircleOutlined /> Jetable
                              </Tag>
                            )}
                            {emailResult.verification.webmail && (
                              <Tag
                                style={{ borderRadius: 6, fontSize: 11 }}
                              >
                                <MailOutlined /> Webmail
                              </Tag>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div
                          className="flex flex-wrap gap-2 pt-3"
                          style={{ borderTop: "1px solid #f3f4f6" }}
                        >
                          <Button
                            type="primary"
                            icon={
                              emailCopied ? (
                                <CheckOutlined />
                              ) : (
                                <CopyOutlined />
                              )
                            }
                            onClick={handleCopyEmail}
                            style={{
                              borderRadius: 8,
                              fontWeight: 600,
                              background: emailCopied
                                ? "#22c55e"
                                : "linear-gradient(135deg, #16a34a, #15803d)",
                              border: "none",
                              height: 38,
                            }}
                          >
                            {emailCopied
                              ? t("emailFinder.result.copied")
                              : t("emailFinder.result.copy")}
                          </Button>
                          <Button
                            icon={<SendOutlined />}
                            onClick={handleUseForOutreach}
                            style={{
                              borderRadius: 8,
                              height: 38,
                              fontWeight: 600,
                              color: "#0a66c2",
                              borderColor: "#0a66c2",
                            }}
                          >
                            {t("emailFinder.result.useForOutreach")}
                          </Button>
                          <Button
                            icon={<TeamOutlined />}
                            onClick={handleAddToCrmFromEmail}
                            style={{
                              borderRadius: 8,
                              height: 38,
                              fontWeight: 600,
                              color: "#6366f1",
                              borderColor: "#6366f1",
                            }}
                          >
                            {t("result.addToCrm")}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center py-16">
                    <div
                      className="flex items-center justify-center rounded-full mb-4"
                      style={{
                        width: 64,
                        height: 64,
                        background:
                          "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                      }}
                    >
                      <MailOutlined
                        style={{ fontSize: 28, color: "#16a34a" }}
                      />
                    </div>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      imageStyle={{ display: "none" }}
                      description={
                        <div className="text-center">
                          <Text
                            strong
                            style={{
                              fontSize: 15,
                              color: "#374151",
                              display: "block",
                              marginBottom: 4,
                            }}
                          >
                            {t("emailFinder.empty.title")}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {t("emailFinder.empty.description")}
                          </Text>
                        </div>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
