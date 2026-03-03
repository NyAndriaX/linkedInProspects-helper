"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Button,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Empty,
  Table,
  Space,
  Tooltip,
  Avatar,
  Upload,
  Image,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
  EyeOutlined,
  EditOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  UserOutlined,
  GlobalOutlined,
  UploadOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import type { ColumnsType } from "antd/es/table";
import type { TableRowSelection } from "antd/es/table/interface";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePosts } from "@/hooks/usePosts";
import { useProfile } from "@/hooks/useProfile";
import { GeneratePostsModal } from "@/components/features/GeneratePostsModal";
import { Post, PostStatus, PostFormData, postStatusConfig } from "@/types/post";
import { Link } from "@/i18n/routing";
import { toPostImageProxyPath } from "@/lib/post-image-url";
import { apiClient } from "@/lib/api-client";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function PostsPage() {
  const t = useTranslations("posts");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("postStatus");
  const { data: session } = useSession();
  
  const { posts, isLoading, isPublishing, addPost, updatePost, deletePost, publishPost, filterByStatus, refetch } =
    usePosts();
  const { isProfileComplete, profile } = useProfile();
  const [messageApi, contextHolder] = message.useMessage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [isAiEditing, setIsAiEditing] = useState(false);

  const resolvePostImages = (post: Post): string[] => {
    if (Array.isArray(post.imageUrls) && post.imageUrls.length > 0) {
      return post.imageUrls;
    }
    return post.imageUrl ? [post.imageUrl] : [];
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const filteredPosts = filterByStatus(statusFilter);

  const handleCreate = () => {
    setEditingPost(null);
    form.resetFields();
    form.setFieldsValue({ status: "draft" });
    setAiInstruction("");
    setIsModalOpen(true);
  };

  const handleEdit = (post: Post) => {
    const images = resolvePostImages(post);
    setEditingPost(post);
    form.setFieldsValue({
      title: post.title,
      content: post.content,
      status: post.status,
      imageUrl: post.imageUrl || undefined,
      imageUrls: images,
    });
    setAiInstruction("");
    setIsModalOpen(true);
  };

  const handleView = (post: Post) => {
    setViewingPost(post);
    setIsViewModalOpen(true);
  };

  const handleSubmit = async (values: PostFormData) => {
    const normalizedImageUrls = Array.from(
      new Set(
        [
          ...(Array.isArray(values.imageUrls) ? values.imageUrls : []),
          values.imageUrl?.trim() || "",
        ].filter(Boolean)
      )
    );

    const payload: PostFormData = {
      ...values,
      imageUrl: normalizedImageUrls[0] || null,
      imageUrls: normalizedImageUrls,
    };

    if (editingPost) {
      updatePost(editingPost.id, payload);
      messageApi.success(t("messages.updated"));
    } else {
      addPost(payload);
      messageApi.success(t("messages.created"));
    }
    setIsModalOpen(false);
    form.resetFields();
    setAiInstruction("");
  };

  const handleAiAssistEdit = async () => {
    const content = String(form.getFieldValue("content") || "").trim();
    const title = String(form.getFieldValue("title") || "").trim();
    const instruction = aiInstruction.trim();

    if (!instruction) {
      messageApi.warning(t("modal.aiAssistMissingInstruction"));
      return;
    }
    if (!content) {
      messageApi.warning(t("modal.aiAssistMissingContent"));
      return;
    }

    setIsAiEditing(true);
    try {
      const data = await apiClient.post<{ content: string }>(
        "/api/posts/assist-edit",
        {
          title,
          content,
          instruction,
        }
      );
      form.setFieldValue("content", data.content);
      messageApi.success(t("modal.aiAssistSuccess"));
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : t("modal.aiAssistFailed")
      );
    } finally {
      setIsAiEditing(false);
    }
  };

  const isValidImagePath = (value: string) =>
    /^https?:\/\/\S+$/i.test(value) || value.startsWith("/uploads/");

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      messageApi.error(t("modal.imageTypeInvalid"));
      return false;
    }

    const maxSizeMb = 5;
    if (file.size > maxSizeMb * 1024 * 1024) {
      messageApi.error(t("modal.imageSizeInvalid", { max: maxSizeMb }));
      return false;
    }

    setIsImageUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("modal.imageUploadFailed"));
      }

      const currentImages = form.getFieldValue("imageUrls");
      const nextImages = Array.isArray(currentImages)
        ? Array.from(new Set([...currentImages, data.url]))
        : [data.url];

      form.setFieldsValue({
        imageUrls: nextImages,
        imageUrl: nextImages[0],
      });
      messageApi.success(t("modal.imageUploaded"));
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : t("modal.imageUploadFailed")
      );
    } finally {
      setIsImageUploading(false);
    }

    return false;
  };

  const handleDelete = (id: string) => {
    deletePost(id);
    messageApi.success(t("messages.deleted"));
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    const result = await publishPost(id);
    setPublishingId(null);
    
    if (result.success) {
      messageApi.success(t("messages.publishedSuccess"));
      if (result.warnings && result.warnings.length > 0) {
        messageApi.warning(result.warnings.join(" "));
      }
    } else {
      messageApi.error(result.error || t("messages.publishFailed"));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const results = await Promise.all(
        selectedRowKeys.map((id) => deletePost(id))
      );
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        messageApi.success(t("bulk.deleted", { count: successCount }));
      } else {
        messageApi.error(t("bulk.deleteFailed"));
      }
      setSelectedRowKeys([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkStatus = async (status: PostStatus) => {
    if (selectedRowKeys.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const results = await Promise.all(
        selectedRowKeys.map((id) => updatePost(id, { status }))
      );
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        messageApi.success(t("bulk.statusUpdated", { count: successCount }));
      } else {
        messageApi.error(t("bulk.statusFailed"));
      }
      setSelectedRowKeys([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkPublish = async () => {
    if (selectedRowKeys.length === 0) return;

    const selectedPosts = posts.filter((post) =>
      selectedRowKeys.includes(post.id)
    );
    const readyPosts = selectedPosts.filter((post) => post.status === "ready");
    const skippedDraftCount = selectedPosts.filter(
      (post) => post.status === "draft"
    ).length;
    const skippedPublishedCount = selectedPosts.filter(
      (post) => post.status === "published"
    ).length;

    if (readyPosts.length === 0) {
      messageApi.warning(t("bulk.publishNoReady"));
      return;
    }

    setIsBulkProcessing(true);
    try {
      let successCount = 0;
      const publishWarnings: string[] = [];
      for (const post of readyPosts) {
        const result = await publishPost(post.id);
        if (result.success) {
          successCount += 1;
          if (result.warnings && result.warnings.length > 0) {
            publishWarnings.push(...result.warnings);
          }
        }
      }

      if (successCount > 0) {
        messageApi.success(t("bulk.published", { count: successCount }));
      } else {
        messageApi.error(t("bulk.publishFailed"));
      }

      if (skippedDraftCount > 0) {
        messageApi.info(
          t("bulk.publishSkippedDraft", { count: skippedDraftCount })
        );
      }
      if (skippedPublishedCount > 0) {
        messageApi.info(
          t("bulk.publishSkippedPublished", { count: skippedPublishedCount })
        );
      }
      if (publishWarnings.length > 0) {
        messageApi.warning(Array.from(new Set(publishWarnings)).join(" "));
      }

      setSelectedRowKeys([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const rowSelection: TableRowSelection<Post> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys as string[]),
  };

  const columns: ColumnsType<Post> = [
    {
      title: t("table.title"),
      dataIndex: "title",
      key: "title",
      width: isMobile ? 120 : 200,
      ellipsis: true,
      render: (title: string) => (
        <div className="overflow-hidden" style={{ maxWidth: isMobile ? 120 : 200 }}>
          <Text strong ellipsis={{ tooltip: title }} style={{ maxWidth: "100%" }}>
            {title}
          </Text>
        </div>
      ),
    },
    {
      title: t("table.content"),
      dataIndex: "content",
      key: "content",
      ellipsis: true,
      render: (content: string, record: Post) => (
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <Paragraph
              type="secondary"
              ellipsis={{ rows: 1, tooltip: content }}
              className="!mb-0"
              style={{ maxWidth: "100%" }}
            >
              {content}
            </Paragraph>
          </div>
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
            className="flex-shrink-0"
          />
        </div>
      ),
    },
    {
      title: t("table.status"),
      dataIndex: "status",
      key: "status",
      width: isMobile ? 100 : 130,
      render: (status: PostStatus) => (
        <Tag color={postStatusConfig[status].color}>
          {tStatus(status)}
        </Tag>
      ),
    },
    ...(!isMobile
      ? [
          {
            title: t("table.created"),
            dataIndex: "createdAt",
            key: "createdAt",
            width: 120,
            render: (date: string) => (
              <Text type="secondary" className="text-sm">
                {new Date(date).toLocaleDateString()}
              </Text>
            ),
          },
        ]
      : []),
    {
      title: t("table.actions"),
      key: "actions",
      width: isMobile ? 100 : 140,
      fixed: isMobile ? ("right" as const) : undefined,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          {record.status === "ready" && (
            <Popconfirm
              title={t("publishConfirm.title")}
              description={t("publishConfirm.description")}
              onConfirm={() => handlePublish(record.id)}
              okText={tCommon("publish")}
              cancelText={tCommon("cancel")}
              disabled={isPublishing}
            >
              <Button
                size="small"
                type="primary"
                loading={publishingId === record.id}
                icon={publishingId === record.id ? <LoadingOutlined /> : <SendOutlined />}
                style={{ background: "#6366f1", borderColor: "#6366f1" }}
              />
            </Popconfirm>
          )}
          <Popconfirm
            title={tCommon("delete") + "?"}
            onConfirm={() => handleDelete(record.id)}
            okText={tCommon("yes")}
            cancelText={tCommon("no")}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      {contextHolder}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Title level={2} className="!mb-1">
              {t("title")}
            </Title>
            <Text type="secondary">{t("subtitle")}</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            block={isMobile}
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            }}
          >
            {t("newPost")}
          </Button>
        </div>

        {/* Filter */}
        <Card size="small">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Text type="secondary">{t("status")}</Text>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: isMobile ? "100%" : 180 }}
              options={[
                { value: "all", label: t("filter.all") },
                { value: "draft", label: t("filter.draft") },
                { value: "ready", label: t("filter.ready") },
                { value: "published", label: t("filter.published") },
              ]}
            />
            <Tooltip 
              title={!isProfileComplete ? t("completeProfileFirst") : ""}
              placement="top"
            >
              <Button
                icon={!isProfileComplete ? <WarningOutlined /> : <ThunderboltOutlined />}
                block={isMobile}
                onClick={() => setIsGenerateModalOpen(true)}
                disabled={!isProfileComplete}
                style={isProfileComplete ? {
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  borderColor: "#d97706",
                  color: "white",
                } : undefined}
              >
                {t("generatePost")}
              </Button>
            </Tooltip>
            {!isProfileComplete && (
              <Link href="/settings">
                <Button type="link" size="small" className="text-orange-500">
                  {t("goToSettings")}
                </Button>
              </Link>
            )}
          </div>
          {selectedRowKeys.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <Text strong>{t("bulk.selected", { count: selectedRowKeys.length })}</Text>
              <Select
                placeholder={t("bulk.changeStatus")}
                style={{ width: isMobile ? "100%" : 180 }}
                onChange={(value) => handleBulkStatus(value)}
                disabled={isBulkProcessing}
                options={[
                  { value: "draft", label: t("filter.draft") },
                  { value: "ready", label: t("filter.ready") },
                  { value: "published", label: t("filter.published") },
                ]}
              />
              <Popconfirm
                title={t("bulk.publishConfirm")}
                onConfirm={handleBulkPublish}
                okText={tCommon("publish")}
                cancelText={tCommon("cancel")}
              >
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={isBulkProcessing}
                  style={{ background: "#6366f1", borderColor: "#6366f1" }}
                >
                  {t("bulk.publishSelected")}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t("bulk.deleteConfirm")}
                onConfirm={handleBulkDelete}
                okText={tCommon("yes")}
                cancelText={tCommon("no")}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={isBulkProcessing}
                >
                  {t("bulk.deleteSelected")}
                </Button>
              </Popconfirm>
              <Button type="text" onClick={() => setSelectedRowKeys([])}>
                {t("bulk.clearSelection")}
              </Button>
            </div>
          )}
        </Card>

        {/* Table */}
        <Card styles={{ body: { padding: isMobile ? 0 : undefined, overflow: "hidden" } }}>
          <Table
            columns={columns}
            dataSource={filteredPosts}
            rowKey="id"
            rowSelection={rowSelection}
            loading={isLoading}
            scroll={{ x: isMobile ? 600 : undefined }}
            size={isMobile ? "small" : "middle"}
            tableLayout="fixed"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: isMobile ? undefined : (total) => `${total} ${t("title").toLowerCase()}`,
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    statusFilter === "all"
                      ? t("empty.noPostsYet")
                      : t("empty.noStatusPosts", { status: tStatus(statusFilter).toLowerCase() })
                  }
                >
                  <Button type="primary" onClick={handleCreate}>
                    {t("empty.createFirst")}
                  </Button>
                </Empty>
              ),
            }}
          />
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editingPost ? t("modal.editTitle") : t("modal.createTitle")}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setAiInstruction("");
        }}
        footer={null}
        width={isMobile ? "95%" : 640}
        destroyOnClose
        centered={isMobile}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="title"
            label={t("table.title")}
            rules={[{ required: true, message: t("modal.titlePlaceholder") }]}
          >
            <Input
              placeholder={t("modal.titlePlaceholder")}
              size="large"
              maxLength={100}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="content"
            label={t("table.content")}
            rules={[{ required: true, message: t("modal.contentPlaceholder") }]}
          >
            <TextArea
              rows={10}
              placeholder={t("modal.contentPlaceholder")}
              showCount
              maxLength={3000}
              style={{ resize: "none" }}
            />
          </Form.Item>

          {editingPost && (
            <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
              <Text strong className="block mb-1">
                {t("modal.aiAssistLabel")}
              </Text>
              <Text type="secondary" className="text-xs block mb-2">
                {t("modal.aiAssistHelp")}
              </Text>
              <Input
                value={aiInstruction}
                onChange={(event) => setAiInstruction(event.target.value)}
                placeholder={t("modal.aiAssistPlaceholder")}
                maxLength={220}
                showCount
                onPressEnter={() => {
                  if (!isAiEditing) {
                    void handleAiAssistEdit();
                  }
                }}
              />
              <Button
                icon={<RobotOutlined />}
                className="mt-2"
                loading={isAiEditing}
                onClick={() => void handleAiAssistEdit()}
                block={isMobile}
              >
                {isAiEditing ? t("modal.aiAssisting") : t("modal.aiAssistButton")}
              </Button>
            </div>
          )}

          <Form.Item
            name="imageUrl"
            label={t("modal.imageUrlLabel")}
            rules={[
              {
                validator: (_, value: string | undefined) => {
                  if (!value || isValidImagePath(value)) return Promise.resolve();
                  return Promise.reject(new Error(t("modal.imageUrlInvalid")));
                },
              },
            ]}
          >
            <Input
              placeholder={t("modal.imageUrlPlaceholder")}
              size="large"
              allowClear
              onBlur={(event) => {
                const value = event.target.value?.trim();
                if (!value) return;
                const currentImages = form.getFieldValue("imageUrls");
                const nextImages = Array.isArray(currentImages)
                  ? Array.from(new Set([...currentImages, value]))
                  : [value];
                form.setFieldsValue({
                  imageUrls: nextImages,
                  imageUrl: nextImages[0],
                });
              }}
            />
          </Form.Item>
          <Form.Item name="imageUrls" hidden>
            <Select mode="multiple" />
          </Form.Item>

          <div className="mb-4">
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={handleImageUpload}
            >
              <Button
                icon={<UploadOutlined />}
                loading={isImageUploading}
                block={isMobile}
              >
                {isImageUploading
                  ? t("modal.uploadingImage")
                  : t("modal.uploadImage")}
              </Button>
            </Upload>
            <Text type="secondary" className="text-xs">
              {t("modal.uploadImageHelp")}
            </Text>
          </div>

          <Form.Item noStyle shouldUpdate={(prev, next) => prev.imageUrls !== next.imageUrls}>
            {({ getFieldValue, setFieldValue }) => {
              const imageUrls = Array.isArray(getFieldValue("imageUrls"))
                ? (getFieldValue("imageUrls") as string[])
                : [];
              if (imageUrls.length === 0) return null;

              return (
                <div className="mb-4 rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {imageUrls.map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="relative">
                        <Image
                          src={toPostImageProxyPath(imageUrl)}
                          alt="Post preview"
                          className="w-full object-cover rounded-md"
                          style={{ maxHeight: 160 }}
                          preview
                        />
                        <Button
                          danger
                          size="small"
                          className="absolute top-1 right-1"
                          onClick={() => {
                            const nextImages = imageUrls.filter((_, i) => i !== index);
                            setFieldValue("imageUrls", nextImages);
                            setFieldValue("imageUrl", nextImages[0] || undefined);
                          }}
                        >
                          {t("modal.removeImage")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }}
          </Form.Item>

          <Form.Item
            name="status"
            label={t("table.status")}
            rules={[{ required: true }]}
          >
            <Select
              size="large"
              options={
                editingPost
                  ? [
                      { value: "draft", label: t("modal.statusDraft") },
                      { value: "ready", label: t("modal.statusReady") },
                      { value: "published", label: t("modal.statusPublished") },
                    ]
                  : [
                      { value: "draft", label: t("modal.statusDraft") },
                      { value: "ready", label: t("modal.statusReady") },
                    ]
              }
            />
          </Form.Item>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <Button size="large" onClick={() => setIsModalOpen(false)} block={isMobile}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block={isMobile}
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              }}
            >
              {editingPost ? t("modal.saveChanges") : t("modal.createPost")}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* View Modal — LinkedIn-style preview */}
      <Modal
        title={null}
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={null}
        width={isMobile ? "95%" : 620}
        centered
        style={{ top: 20 }}
        styles={{ body: { padding: 0, maxHeight: "85vh", overflowY: "auto" } }}
      >
        {viewingPost && (
          <div>
            {/* Header bar */}
            <div
              className="flex items-center gap-3 flex-wrap px-5 py-3"
              style={{ borderBottom: "1px solid #f0f0f0" }}
            >
              <Tag color={postStatusConfig[viewingPost.status].color}>
                {tStatus(viewingPost.status)}
              </Tag>
              <Text type="secondary" className="text-xs ml-auto" ellipsis>
                {viewingPost.title}
              </Text>
            </div>

            {/* LinkedIn Card */}
            <div
              className="mx-5 my-4 rounded-xl overflow-hidden"
              style={{ border: "1px solid #e5e7eb", background: "#fff" }}
            >
              {/* Profile */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-1.5">
                <Avatar
                  src={session?.user?.image}
                  icon={<UserOutlined />}
                  size={40}
                />
                <div className="leading-tight">
                  <Text strong className="text-[13px]">
                    {session?.user?.name || "You"}
                  </Text>
                  <div className="flex items-center gap-1 text-gray-400 text-[11px] mt-0.5">
                    <span>
                      {viewingPost.publishedAt
                        ? new Date(viewingPost.publishedAt).toLocaleDateString()
                        : new Date(viewingPost.createdAt).toLocaleDateString()}
                    </span>
                    <span>·</span>
                    <GlobalOutlined style={{ fontSize: 9 }} />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-2">
                <pre
                  className="whitespace-pre-wrap text-[13px] leading-relaxed"
                  style={{ fontFamily: "inherit", margin: 0, color: "#1d1d1d" }}
                >
                  {viewingPost.content}
                </pre>
              </div>

              {/* Image(s) */}
              {resolvePostImages(viewingPost).length > 0 && (
                <div
                  className={
                    resolvePostImages(viewingPost).length === 1
                      ? "px-4 pb-4"
                      : "grid grid-cols-1 sm:grid-cols-2 gap-2 px-4 pb-4"
                  }
                >
                  {resolvePostImages(viewingPost).map((imageUrl, index) => (
                    <div
                      key={`${imageUrl}-${index}`}
                      className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
                    >
                      <Image
                        src={toPostImageProxyPath(imageUrl)}
                        alt={`Post image ${index + 1}`}
                        className="w-full object-contain"
                        style={{
                          maxHeight:
                            resolvePostImages(viewingPost).length === 1
                              ? isMobile
                                ? 320
                                : 460
                              : isMobile
                                ? 220
                                : 280,
                        }}
                        preview
                      />
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Meta */}
            <div className="flex justify-between text-[11px] text-gray-400 px-5 pb-1">
              <span>
                {t("view.created")}{" "}
                {new Date(viewingPost.createdAt).toLocaleString()}
              </span>
              {viewingPost.publishedAt && (
                <span>
                  {t("view.published")}{" "}
                  {new Date(viewingPost.publishedAt).toLocaleString()}
                </span>
              )}
            </div>

            {/* Actions */}
            <div
              className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-5 py-4"
              style={{ borderTop: "1px solid #f0f0f0", background: "#fafafa" }}
            >
              <Button
                onClick={() => setIsViewModalOpen(false)}
                block={isMobile}
              >
                {tCommon("close")}
              </Button>
              <Button
                icon={<EditOutlined />}
                block={isMobile}
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleEdit(viewingPost);
                }}
              >
                {tCommon("edit")}
              </Button>
              {viewingPost.status === "ready" && (
                <Popconfirm
                  title={t("publishConfirm.title")}
                  description={t("publishConfirm.description")}
                  onConfirm={async () => {
                    await handlePublish(viewingPost.id);
                    setIsViewModalOpen(false);
                  }}
                  okText={tCommon("publish")}
                  cancelText={tCommon("cancel")}
                  disabled={isPublishing}
                >
                  <Button
                    type="primary"
                    icon={
                      publishingId === viewingPost.id ? (
                        <LoadingOutlined />
                      ) : (
                        <SendOutlined />
                      )
                    }
                    loading={publishingId === viewingPost.id}
                    block={isMobile}
                    style={{
                      background:
                        "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      fontWeight: 600,
                    }}
                  >
                    {tCommon("publish")}
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Generate Modal */}
      <GeneratePostsModal
        open={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onSaved={refetch}
        profileTone={profile.preferredTone}
        profileIndustry={profile.industry}
        profileContact={{
          phone: profile.phone,
          githubUrl: profile.githubUrl,
          portfolioUrl: profile.portfolioUrl,
          linkedInProfileUrl: profile.linkedInProfileUrl,
        }}
      />
    </MainLayout>
  );
}
