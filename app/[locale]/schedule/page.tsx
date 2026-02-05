"use client";

import { useState } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  TimePicker,
  Space,
  Typography,
  Tag,
  Popconfirm,
  message,
  Spin,
  Empty,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  useSchedules,
  Schedule,
  CreateScheduleData,
  TIMEZONE_OPTIONS,
} from "@/hooks/useSchedules";

const { Title, Text, Paragraph } = Typography;

export default function SchedulePage() {
  const t = useTranslations("schedule");
  const tCommon = useTranslations("common");
  
  const {
    schedules,
    isLoading,
    isSaving,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
  } = useSchedules();

  const [messageApi, contextHolder] = message.useMessage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [form] = Form.useForm();

  // Day names from translations
  const dayNames = [
    t("days.sunday"),
    t("days.monday"),
    t("days.tuesday"),
    t("days.wednesday"),
    t("days.thursday"),
    t("days.friday"),
    t("days.saturday"),
  ];

  const dayOptions = dayNames.map((name, index) => ({
    value: index,
    label: name,
  }));

  const handleCreate = () => {
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldsValue({
      timezone: "Europe/Paris",
      isRecurring: true,
      times: [dayjs("09:00", "HH:mm")],
    });
    setIsModalOpen(true);
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    form.setFieldsValue({
      name: schedule.name,
      dayOfWeek: schedule.dayOfWeek,
      times: schedule.times.map((time) => dayjs(time, "HH:mm")),
      timezone: schedule.timezone,
      isRecurring: schedule.isRecurring,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSchedule(id);
    if (result.success) {
      messageApi.success(t("messages.deleted"));
    } else {
      messageApi.error(result.error || t("messages.deleteFailed"));
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const result = await toggleSchedule(id, isActive);
    if (result.success) {
      messageApi.success(isActive ? t("messages.activated") : t("messages.paused"));
    } else {
      messageApi.error(result.error || t("messages.updateFailed"));
    }
  };

  const handleSubmit = async (values: {
    name: string;
    dayOfWeek: number;
    times: dayjs.Dayjs[];
    timezone: string;
    isRecurring: boolean;
  }) => {
    const data: CreateScheduleData = {
      name: values.name,
      dayOfWeek: values.dayOfWeek,
      times: values.times.map((time) => time.format("HH:mm")),
      timezone: values.timezone,
      isRecurring: values.isRecurring,
    };

    if (editingSchedule) {
      const result = await updateSchedule(editingSchedule.id, data);
      if (result.success) {
        messageApi.success(t("messages.updated"));
        setIsModalOpen(false);
      } else {
        messageApi.error(result.error || t("messages.updateFailed"));
      }
    } else {
      const result = await createSchedule(data);
      if (result.success) {
        messageApi.success(t("messages.created"));
        setIsModalOpen(false);
      } else {
        messageApi.error(result.error || t("messages.createFailed"));
      }
    }
  };

  const columns = [
    {
      title: t("table.name"),
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Schedule) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" className="text-xs">
            {record.isRecurring ? t("recurring") : t("oneTime")}
          </Text>
        </div>
      ),
    },
    {
      title: t("table.day"),
      dataIndex: "dayOfWeek",
      key: "dayOfWeek",
      render: (day: number) => (
        <Tag icon={<CalendarOutlined />} color="blue">
          {dayNames[day]}
        </Tag>
      ),
    },
    {
      title: t("table.times"),
      dataIndex: "times",
      key: "times",
      render: (times: string[]) => (
        <Space wrap>
          {times.sort().map((time) => (
            <Tag key={time} icon={<ClockCircleOutlined />}>
              {time}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t("table.timezone"),
      dataIndex: "timezone",
      key: "timezone",
      render: (tz: string) => (
        <Tag icon={<GlobalOutlined />}>
          {TIMEZONE_OPTIONS.find((o) => o.value === tz)?.label || tz}
        </Tag>
      ),
    },
    {
      title: t("table.nextRun"),
      dataIndex: "nextRunAt",
      key: "nextRunAt",
      render: (date: string | null) =>
        date ? (
          <Text type="secondary">{new Date(date).toLocaleString()}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: t("table.active"),
      dataIndex: "isActive",
      key: "isActive",
      render: (isActive: boolean, record: Schedule) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggle(record.id, checked)}
          loading={isSaving}
        />
      ),
    },
    {
      title: t("table.actions"),
      key: "actions",
      render: (_: unknown, record: Schedule) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={t("deleteConfirm.title")}
            description={t("deleteConfirm.description")}
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Spin size="large" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {contextHolder}
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Title level={2} className="mb-1!">
              {t("title")}
            </Title>
            <Paragraph type="secondary">
              {t("subtitle")}
            </Paragraph>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            style={{
              background: "linear-gradient(135deg, #0A66C2 0%, #004182 100%)",
            }}
          >
            {t("addSchedule")}
          </Button>
        </div>

        {/* Info Card */}
        <Card size="small" className="bg-blue-50 border-blue-200">
          <Row gutter={[16, 8]}>
            <Col span={24}>
              <Text>
                <strong>{t("howItWorks.title")}</strong> {t("howItWorks.description")}
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Schedules Table */}
        {schedules.length === 0 ? (
          <Card>
            <Empty
              description={t("empty.noSchedules")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={handleCreate}>
                {t("empty.createFirst")}
              </Button>
            </Empty>
          </Card>
        ) : (
          <Card>
            <Table
              dataSource={schedules}
              columns={columns}
              rowKey="id"
              pagination={false}
              scroll={{ x: 800 }}
            />
          </Card>
        )}

        {/* Create/Edit Modal */}
        <Modal
          title={editingSchedule ? t("modal.editTitle") : t("modal.createTitle")}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          width={500}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="mt-4"
          >
            <Form.Item
              name="name"
              label={t("modal.name")}
              rules={[{ required: true, message: t("modal.nameRequired") }]}
            >
              <Input placeholder={t("modal.namePlaceholder")} />
            </Form.Item>

            <Form.Item
              name="dayOfWeek"
              label={t("modal.dayOfWeek")}
              rules={[{ required: true, message: t("modal.dayRequired") }]}
            >
              <Select options={dayOptions} placeholder={t("modal.selectDay")} />
            </Form.Item>

            <Form.List name="times">
              {(fields, { add, remove }) => (
                <Form.Item
                  label={t("modal.publicationTimes")}
                  extra={t("modal.timesHelp")}
                  required
                >
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <Space key={field.key} align="baseline">
                        <Form.Item
                          {...field}
                          rules={[{ required: true, message: t("modal.timeRequired") }]}
                          noStyle
                        >
                          <TimePicker format="HH:mm" placeholder={t("modal.selectTime")} />
                        </Form.Item>
                        {fields.length > 1 && (
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        )}
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add(dayjs("09:00", "HH:mm"))}
                      icon={<PlusOutlined />}
                      block
                    >
                      {t("modal.addTime")}
                    </Button>
                  </div>
                </Form.Item>
              )}
            </Form.List>

            <Form.Item
              name="timezone"
              label={t("modal.timezone")}
              rules={[{ required: true, message: t("modal.timezoneRequired") }]}
            >
              <Select
                options={TIMEZONE_OPTIONS}
                placeholder={t("modal.selectTimezone")}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item
              name="isRecurring"
              label={t("modal.recurringLabel")}
              valuePropName="checked"
            >
              <Switch checkedChildren={tCommon("yes")} unCheckedChildren={tCommon("no")} />
            </Form.Item>
            <Text type="secondary" className="block -mt-4 mb-4 text-xs">
              {t("modal.recurringHelp")}
            </Text>

            <div className="flex gap-2 justify-end">
              <Button onClick={() => setIsModalOpen(false)}>{tCommon("cancel")}</Button>
              <Button type="primary" htmlType="submit" loading={isSaving}>
                {editingSchedule ? tCommon("update") : tCommon("create")}
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
}
