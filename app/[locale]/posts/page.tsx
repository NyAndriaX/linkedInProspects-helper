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
  InputNumber,
  Select,
  message,
  Popconfirm,
  Empty,
  Table,
  Space,
  Tooltip,
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
  LikeOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { ColumnsType } from "antd/es/table";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePosts } from "@/hooks/usePosts";
import { useProfile } from "@/hooks/useProfile";
import { Post, PostStatus, PostFormData, postStatusConfig } from "@/types/post";
import { Link } from "@/i18n/routing";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function PostsPage() {
  const t = useTranslations("posts");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("postStatus");
  
  const { isLoading, isPublishing, addPost, updatePost, deletePost, publishPost, filterByStatus, refetch } =
    usePosts();
  const { isProfileComplete } = useProfile();
  const [messageApi, contextHolder] = message.useMessage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [postCount, setPostCount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

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
    });
    setIsModalOpen(true);
  };

  const handleView = (post: Post) => {
    setViewingPost(post);
    setIsViewModalOpen(true);
  };

  const handleSubmit = async (values: PostFormData) => {
    if (editingPost) {
      updatePost(editingPost.id, values);
      messageApi.success(t("messages.updated"));
    } else {
      addPost(values);
      messageApi.success(t("messages.created"));
    }
    setIsModalOpen(false);
    form.resetFields();
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

  const handleOpenGenerateModal = () => {
    setPostCount(1);
    setIsGenerateModalOpen(true);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: postCount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("messages.generateFailed"));
      }

      messageApi.success(t("messages.generateSuccess", { count: data.count }));
      setIsGenerateModalOpen(false);
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("messages.generateFailed");
      messageApi.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
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
            title: t("table.reactions"),
            key: "reactions",
            width: 100,
            render: (_: unknown, record: Post) => (
              <Tooltip title={t("table.reactions")}>
                <span className="flex items-center gap-1 text-green-500">
                  <LikeOutlined />
                  <span>{record.reactions || 0}</span>
                </span>
              </Tooltip>
            ),
          },
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
                onClick={handleOpenGenerateModal}
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
        </Card>

        {/* Table */}
        <Card styles={{ body: { padding: isMobile ? 0 : undefined, overflow: "hidden" } }}>
          <Table
            columns={columns}
            dataSource={filteredPosts}
            rowKey="id"
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

      {/* View Modal */}
      <Modal
        title={null}
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={null}
        width={isMobile ? "95%" : 640}
        centered={isMobile}
      >
        {viewingPost && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              <Tag color={postStatusConfig[viewingPost.status].color}>
                {tStatus(viewingPost.status)}
              </Tag>
              {viewingPost.status === "published" && (
                <Tooltip title={t("table.reactions")}>
                  <span className="flex items-center gap-1 text-green-500 text-sm">
                    <LikeOutlined />
                    <span>{viewingPost.reactions || 0}</span>
                  </span>
                </Tooltip>
              )}
            </div>

            {/* Title */}
            <Title level={3} className="!mt-2 !mb-0">
              {viewingPost.title}
            </Title>

            {/* Content */}
            <div className="bg-gray-50 rounded-xl p-5 my-4">
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ fontFamily: "inherit", margin: 0 }}
              >
                {viewingPost.content}
              </pre>
            </div>

            {/* Meta */}
            <div className="flex justify-between text-sm text-gray-500 pt-2">
              <span>{t("view.created")} {new Date(viewingPost.createdAt).toLocaleString()}</span>
              {viewingPost.publishedAt && (
                <span>{t("view.published")} {new Date(viewingPost.publishedAt).toLocaleString()}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
              <Button onClick={() => setIsViewModalOpen(false)} block={isMobile}>
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
                    icon={publishingId === viewingPost.id ? <LoadingOutlined /> : <SendOutlined />}
                    loading={publishingId === viewingPost.id}
                    block={isMobile}
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
      <Modal
        title={t("generate.title")}
        open={isGenerateModalOpen}
        onCancel={() => setIsGenerateModalOpen(false)}
        footer={null}
        width={isMobile ? "95%" : 400}
        centered={isMobile}
        destroyOnClose
      >
        <div className="py-4">
          <Text type="secondary" className="block mb-4">
            {t("generate.howMany")}
          </Text>
          <InputNumber
            min={1}
            max={10}
            value={postCount}
            onChange={(value) => setPostCount(value || 1)}
            size="large"
            style={{ width: "100%" }}
            placeholder={t("generate.placeholder")}
          />
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
            <Button 
              size="large" 
              onClick={() => setIsGenerateModalOpen(false)} 
              block={isMobile}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={isGenerating}
              onClick={handleGenerate}
              block={isMobile}
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                borderColor: "#d97706",
              }}
            >
              {postCount > 1 
                ? t("generate.buttonPlural", { count: postCount })
                : t("generate.button", { count: postCount })}
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
