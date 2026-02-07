"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Modal,
  Steps,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Checkbox,
  Typography,
  Space,
  Spin,
  message,
  Tag,
  Avatar,
  Divider,
  Badge,
} from "antd";
import {
  ThunderboltOutlined,
  LoadingOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  UserOutlined,
  GlobalOutlined,
  PictureOutlined,
  CheckCircleFilled,
  EditOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

const { Text } = Typography;
const { TextArea } = Input;

interface GeneratedPost {
  title: string;
  content: string;
  hashtags: string[];
  imageUrl: string | null;
  selected: boolean;
  status: "draft" | "ready";
  saved: boolean;
}

interface GeneratePostsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  profileTone?: string;
}

const TONE_KEYS = [
  "professional",
  "casual",
  "inspirational",
  "educational",
  "storytelling",
  "provocative",
  "humorous",
] as const;

const STYLE_KEYS = [
  "auto",
  "tips_list",
  "personal_story",
  "contrarian",
  "how_to",
  "question_driven",
  "case_study",
  "myth_busting",
] as const;

function buildFullContent(content: string, hashtags: string[]): string {
  if (hashtags.length === 0) return content;
  return content + "\n\n" + hashtags.join(" ");
}

export function GeneratePostsModal({
  open,
  onClose,
  onSaved,
  profileTone = "professional",
}: GeneratePostsModalProps) {
  const { data: session } = useSession();
  const t = useTranslations("posts");
  const tCommon = useTranslations("common");
  const tTones = useTranslations("tones");
  const tStatus = useTranslations("postStatus");
  const [messageApi, contextHolder] = message.useMessage();

  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [form] = Form.useForm();

  const handleClose = () => {
    setStep(0);
    setPosts([]);
    form.resetFields();
    setIsGenerating(false);
    setIsSaving(false);
    onClose();
  };

  const handleGenerate = async () => {
    const values = form.getFieldsValue();
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: values.count || 1,
          topic: values.topic || undefined,
          toneOverride: values.tone !== profileTone ? values.tone : undefined,
          style: values.style !== "auto" ? values.style : undefined,
          includeImage: values.includeImage || false,
          preview: true,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || t("messages.generateFailed"));

      setPosts(
        (data.posts || []).map(
          (p: {
            title: string;
            content: string;
            hashtags?: string[];
            imageUrl?: string | null;
          }) => ({
            title: p.title,
            content: p.content,
            hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
            imageUrl: p.imageUrl || null,
            selected: true,
            status: "ready" as const,
            saved: false,
          })
        )
      );
      setStep(1);
    } catch (err) {
      messageApi.error(
        err instanceof Error ? err.message : t("messages.generateFailed")
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    const selected = posts.filter((p) => p.selected && !p.saved);
    if (selected.length === 0) {
      messageApi.warning(t("generate.preview.noSelection"));
      return;
    }
    setIsSaving(true);
    try {
      const results = await Promise.all(
        selected.map((post) =>
          fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: post.title,
              content: buildFullContent(post.content, post.hashtags),
              status: post.status,
              imageUrl: post.imageUrl,
            }),
          })
        )
      );
      if (!results.every((r) => r.ok))
        throw new Error("Some posts failed to save");
      messageApi.success(
        t("generate.preview.saved", { count: selected.length })
      );
      onSaved();
      handleClose();
    } catch {
      messageApi.error(t("messages.generateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedulePost = async (index: number) => {
    const post = posts[index];
    if (post.saved) return;
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          content: buildFullContent(post.content, post.hashtags),
          status: "ready",
          imageUrl: post.imageUrl,
        }),
      });
      if (!response.ok) throw new Error("Failed to save");
      setPosts((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, saved: true, selected: false } : p
        )
      );
      messageApi.success(t("generate.preview.scheduledSuccess"));
      onSaved();
    } catch {
      messageApi.error(t("messages.generateFailed"));
    }
  };

  const togglePost = (index: number) => {
    setPosts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    );
  };

  const updatePost = (
    index: number,
    field: "title" | "content" | "status",
    value: string
  ) => {
    setPosts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const toggleAll = (selected: boolean) => {
    setPosts((prev) =>
      prev.map((p) => (p.saved ? p : { ...p, selected }))
    );
  };

  const selectedCount = posts.filter((p) => p.selected && !p.saved).length;

  const toneOptions = TONE_KEYS.map((key) => ({
    value: key,
    label: tTones(`${key}.label`),
  }));

  const styleOptions = STYLE_KEYS.map((key) => ({
    value: key,
    label: t(`generate.styles.${key}`),
  }));

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={step === 0 ? 540 : 640}
      style={{ maxWidth: "95vw" }}
      styles={{ body: { padding: 0 } }}
      destroyOnClose
      centered
    >
      {contextHolder}

      {/* ━━━ Modal Header ━━━ */}
      <div
        className="px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(135deg, #fafafa 0%, #f5f3ff 100%)",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              background:
                "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            }}
          >
            <ThunderboltOutlined style={{ color: "#fff", fontSize: 16 }} />
          </div>
          <div>
            <Text strong className="text-base block leading-tight">
              {t("generate.title")}
            </Text>
          </div>
        </div>
        <Steps
          current={step}
          size="small"
          items={[
            { title: t("generate.step1Title") },
            { title: t("generate.step2Title") },
          ]}
        />
      </div>

      {/* ━━━ Step 1: Configuration ━━━ */}
      {step === 0 && !isGenerating && (
        <div className="px-6 py-5">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              count: 3,
              tone: profileTone,
              style: "auto",
              includeImage: false,
            }}
            onFinish={handleGenerate}
            requiredMark={false}
          >
            {/* Topic */}
            <Form.Item
              name="topic"
              label={
                <span className="font-medium">{t("generate.topicLabel")}</span>
              }
              extra={
                <Text type="secondary" className="text-xs">
                  {t("generate.topicHelp")}
                </Text>
              }
            >
              <TextArea
                rows={2}
                placeholder={t("generate.topicPlaceholder")}
                maxLength={300}
                showCount
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Divider className="my-3" />

            {/* Tone & Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item
                name="tone"
                label={
                  <span className="font-medium">
                    {t("generate.toneLabel")}
                  </span>
                }
              >
                <Select options={toneOptions} />
              </Form.Item>
              <Form.Item
                name="style"
                label={
                  <span className="font-medium">
                    {t("generate.styleLabel")}
                  </span>
                }
              >
                <Select options={styleOptions} />
              </Form.Item>
            </div>

            {/* Count & Image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <Form.Item
                name="count"
                label={
                  <span className="font-medium">
                    {t("generate.howMany")}
                  </span>
                }
              >
                <InputNumber
                  min={1}
                  max={5}
                  style={{ width: "100%", borderRadius: 8 }}
                />
              </Form.Item>
              <Form.Item name="includeImage" valuePropName="checked">
                <Checkbox>
                  <span className="flex items-center gap-1.5 text-sm">
                    <PictureOutlined className="text-gray-500" />
                    {t("generate.includeImage")}
                  </span>
                </Checkbox>
              </Form.Item>
            </div>

            <Divider className="my-3" />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button onClick={handleClose}>{tCommon("cancel")}</Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ThunderboltOutlined />}
                style={{
                  background:
                    "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  borderColor: "#d97706",
                  fontWeight: 600,
                }}
              >
                {(form.getFieldValue("count") || 3) > 1
                  ? t("generate.buttonPlural", {
                      count: form.getFieldValue("count") || 3,
                    })
                  : t("generate.button", {
                      count: form.getFieldValue("count") || 3,
                    })}
              </Button>
            </div>
          </Form>
        </div>
      )}

      {/* ━━━ Loading ━━━ */}
      {isGenerating && (
        <div className="py-24 text-center">
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
              {t("generate.generating")}
            </Text>
            <Text type="secondary" className="text-sm mt-1 block">
              {t("generate.generatingTip")}
            </Text>
          </div>
        </div>
      )}

      {/* ━━━ Step 2: Preview & Edit ━━━ */}
      {step === 1 && !isGenerating && (
        <div>
          {/* Toolbar */}
          <div
            className="flex items-center justify-between gap-3 px-6 py-3"
            style={{ background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}
          >
            <Text type="secondary" className="text-sm">
              {t("generate.preview.subtitle", { count: posts.length })}
            </Text>
            <Space size={4}>
              <Button size="small" type="text" onClick={() => toggleAll(true)}>
                {t("generate.preview.selectAll")}
              </Button>
              <span className="text-gray-300">|</span>
              <Button size="small" type="text" onClick={() => toggleAll(false)}>
                {t("generate.preview.deselectAll")}
              </Button>
            </Space>
          </div>

          {/* Posts list */}
          <div
            className="px-6 py-4 space-y-4 overflow-y-auto"
            style={{ maxHeight: "58vh" }}
          >
            {posts.map((post, index) => {
              const isActive = post.selected && !post.saved;
              return (
                <div
                  key={index}
                  className="rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    border: post.saved
                      ? "1.5px solid #52c41a"
                      : isActive
                        ? "1.5px solid #818cf8"
                        : "1.5px solid #e5e7eb",
                    opacity: post.saved ? 0.65 : isActive ? 1 : 0.55,
                    background: "#fff",
                  }}
                >
                  {/* ── Card toolbar ── */}
                  <div
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{
                      background: post.saved
                        ? "#f6ffed"
                        : isActive
                          ? "#f5f3ff"
                          : "#fafafa",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <Checkbox
                      checked={post.selected}
                      onChange={() => togglePost(index)}
                      disabled={post.saved}
                    />
                    <Badge
                      count={index + 1}
                      style={{
                        backgroundColor: isActive ? "#6366f1" : "#d1d5db",
                        fontSize: 10,
                        boxShadow: "none",
                      }}
                    />
                    <Input
                      value={post.title}
                      onChange={(e) =>
                        updatePost(index, "title", e.target.value)
                      }
                      variant="borderless"
                      className="flex-1 font-medium! text-sm!"
                      disabled={post.saved}
                      style={{ padding: 0, background: "transparent" }}
                    />
                    {post.saved ? (
                      <Tag
                        color="success"
                        icon={<CheckCircleFilled />}
                        className="mr-0"
                      >
                        {t("generate.preview.scheduledTag")}
                      </Tag>
                    ) : (
                      <Select
                        size="small"
                        value={post.status}
                        onChange={(v) => updatePost(index, "status", v)}
                        options={[
                          { value: "draft", label: tStatus("draft") },
                          { value: "ready", label: tStatus("ready") },
                        ]}
                        variant="borderless"
                        style={{ width: 100 }}
                      />
                    )}
                  </div>

                  {/* ── LinkedIn Preview ── */}
                  <div>
                    {/* Profile header */}
                    <div className="flex items-center gap-3 px-4 pt-3 pb-1">
                      <Avatar
                        src={session?.user?.image}
                        icon={<UserOutlined />}
                        size={36}
                      />
                      <div className="leading-tight">
                        <Text strong className="text-xs">
                          {session?.user?.name || "You"}
                        </Text>
                        <div className="flex items-center gap-1 text-gray-400 text-[11px]">
                          <span>1d</span>
                          <span>·</span>
                          <GlobalOutlined style={{ fontSize: 9 }} />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 py-1">
                      <TextArea
                        value={post.content}
                        onChange={(e) =>
                          updatePost(index, "content", e.target.value)
                        }
                        autoSize={{ minRows: 3, maxRows: 10 }}
                        variant="borderless"
                        className="text-[13px]! leading-relaxed!"
                        style={{
                          padding: 0,
                          color: "#1d1d1d",
                          resize: "none",
                        }}
                        disabled={post.saved}
                      />
                    </div>

                    {/* Hashtags */}
                    {post.hashtags.length > 0 && (
                      <div className="px-4 pb-2 flex flex-wrap gap-x-1.5 gap-y-0.5">
                        {post.hashtags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-[#0a66c2] text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Image */}
                    {post.imageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="w-full object-cover"
                        style={{ maxHeight: 200 }}
                      />
                    )}

                  </div>

                  {/* ── Card footer ── */}
                  {!post.saved && (
                    <div
                      className="flex items-center justify-between px-4 py-2"
                      style={{
                        background: "#fafafa",
                        borderTop: "1px solid #f0f0f0",
                      }}
                    >
                      <Text type="secondary" className="text-[11px]">
                        <EditOutlined className="mr-1" />
                        {t("generate.preview.subtitle", { count: 1 }).split(
                          "."
                        )[0]}
                      </Text>
                      <Button
                        size="small"
                        icon={<CalendarOutlined />}
                        onClick={() => handleSchedulePost(index)}
                        style={{
                          borderColor: "#d97706",
                          color: "#d97706",
                          fontWeight: 500,
                          fontSize: 12,
                        }}
                      >
                        {t("generate.preview.schedule")}
                      </Button>
                    </div>
                  )}
                  {post.saved && (
                    <div
                      className="flex items-center justify-end px-4 py-2"
                      style={{
                        background: "#f6ffed",
                        borderTop: "1px solid #d9f7be",
                      }}
                    >
                      <Link href="/schedule">
                        <Button size="small" type="link" className="text-xs">
                          {t("generate.preview.schedule")} →
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 px-6 py-4"
            style={{
              borderTop: "1px solid #f0f0f0",
              background: "#fafafa",
            }}
          >
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep(0)}
              type="text"
            >
              {t("generate.preview.regenerate")}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={isSaving}
              onClick={handleSave}
              disabled={selectedCount === 0}
              style={
                selectedCount > 0
                  ? {
                      background:
                        "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      fontWeight: 600,
                    }
                  : { fontWeight: 600 }
              }
            >
              {t("generate.preview.saveSelectedCount", {
                count: selectedCount,
              })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
