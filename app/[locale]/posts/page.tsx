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
    setIsModalOpen(true);
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    form.setFieldsValue({
      title: post.title,
      content: post.content,
      status: post.status,
      imageUrl: post.imageUrl || undefined,
    });
    setIsModalOpen(true);
  };

  const handleView = (post: Post) => {
    setViewingPost(post);
    setIsViewModalOpen(true);
  };

  const handleSubmit = async (values: PostFormData) => {
    const payload: PostFormData = {
      ...values,
      imageUrl: values.imageUrl?.trim() || null,
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

      form.setFieldValue("imageUrl", data.url);
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
      for (const post of readyPosts) {
        const result = await publishPost(post.id);
        if (result.success) successCount += 1;
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
        onCancel={() => setIsModalOpen(false)}
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
            />
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

          <Form.Item noStyle shouldUpdate={(prev, next) => prev.imageUrl !== next.imageUrl}>
            {({ getFieldValue, setFieldValue }) => {
              const imageUrl = getFieldValue("imageUrl");
              if (!imageUrl) return null;

              return (
                <div className="mb-4 rounded-lg border border-gray-200 p-3 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Post preview"
                    className="w-full object-cover rounded-md mb-2"
                    style={{ maxHeight: 220 }}
                  />
                  <Button
                    danger
                    size="small"
                    onClick={() => setFieldValue("imageUrl", undefined)}
                  >
                    {t("modal.removeImage")}
                  </Button>
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
        width={isMobile ? "95%" : 520}
        centered
        styles={{ body: { padding: 0 } }}
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

              {/* Image */}
              {viewingPost.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={viewingPost.imageUrl}
                  alt=""
                  className="w-full object-cover"
                  style={{ maxHeight: 260 }}
                />
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
      />
    </MainLayout>
  );
}
