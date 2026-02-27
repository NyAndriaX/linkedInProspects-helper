"use client";

import { useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Space,
  Divider,
  Row,
  Col,
  Checkbox,
  message,
  Spin,
} from "antd";
import {
  UserOutlined,
  AimOutlined,
  EditOutlined,
  SaveOutlined,
  ReloadOutlined,
  PhoneOutlined,
  GithubOutlined,
  LinkOutlined,
  LinkedinOutlined,
} from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProfile } from "@/hooks/useProfile";
import {
  UserProfile,
  ContentGoal,
  ToneType,
} from "@/types/profile";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Industry keys for translation
const industryKeys = [
  "tech", "finance", "healthcare", "education", "marketing",
  "consulting", "real_estate", "retail", "manufacturing", "legal",
  "hr", "media", "nonprofit", "government", "startup", "other"
] as const;

// Content goal keys
const contentGoalKeys: ContentGoal[] = [
  "thought_leadership", "lead_generation", "brand_awareness",
  "network_growth", "recruitment", "education", "engagement"
];

// Tone keys
const toneKeys: ToneType[] = [
  "professional", "casual", "inspirational",
  "educational", "storytelling", "provocative", "humorous"
];

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tIndustries = useTranslations("industries");
  const tGoals = useTranslations("contentGoals");
  const tTones = useTranslations("tones");
  
  const [form] = Form.useForm();
  const { profile, isLoading, isSaving, saveProfile, resetProfile } =
    useProfile();
  const [messageApi, contextHolder] = message.useMessage();

  // Build translated options
  const industryOptions = industryKeys.map((key) => ({
    value: key,
    label: tIndustries(key),
  }));

  const contentGoalOptions = contentGoalKeys.map((key) => ({
    value: key,
    label: tGoals(`${key}.label`),
    description: tGoals(`${key}.description`),
  }));

  const toneOptions = toneKeys.map((key) => ({
    value: key,
    label: tTones(`${key}.label`),
    description: tTones(`${key}.description`),
  }));

  useEffect(() => {
    if (!isLoading) {
      form.setFieldsValue(profile);
    }
  }, [profile, isLoading, form]);

  const handleSubmit = async (values: UserProfile) => {
    const success = await saveProfile(values);
    if (success) {
      messageApi.success(t("messages.saved"));
    } else {
      messageApi.error(t("messages.saveFailed"));
    }
  };

  const handleReset = async () => {
    await resetProfile();
    form.setFieldsValue(profile);
    messageApi.info(t("messages.reset"));
  };

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
        <div>
          <Title level={2} className="!mb-2">
            {t("title")}
          </Title>
          <Paragraph type="secondary">
            {t("subtitle")}
          </Paragraph>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={profile}
          size="large"
        >
          <Row gutter={[24, 24]}>
            {/* Professional Information */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <UserOutlined />
                    <span>{t("professional.title")}</span>
                  </Space>
                }
                className="h-full"
              >
                <Form.Item
                  name="jobTitle"
                  label={t("professional.jobTitle")}
                  rules={[
                    { required: true, message: t("professional.jobTitleRequired") },
                  ]}
                >
                  <Input placeholder={t("professional.jobTitlePlaceholder")} />
                </Form.Item>

                <Form.Item name="company" label={t("professional.company")}>
                  <Input placeholder={t("professional.companyPlaceholder")} />
                </Form.Item>

                <Form.Item
                  name="industry"
                  label={t("professional.industry")}
                  rules={[
                    { required: true, message: t("professional.industryRequired") },
                  ]}
                >
                  <Select
                    placeholder={t("professional.industryPlaceholder")}
                    options={industryOptions}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                <Form.Item name="targetAudience" label={t("professional.targetAudience")}>
                  <TextArea
                    rows={2}
                    placeholder={t("professional.targetAudiencePlaceholder")}
                  />
                </Form.Item>
              </Card>
            </Col>

            {/* Content Preferences */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <EditOutlined />
                    <span>{t("content.title")}</span>
                  </Space>
                }
                className="h-full"
              >
                <Form.Item
                  name="preferredTone"
                  label={t("content.preferredTone")}
                  rules={[
                    { required: true, message: t("content.toneRequired") },
                  ]}
                >
                  <Select placeholder={t("content.tonePlaceholder")}>
                    {toneOptions.map((tone) => (
                      <Select.Option key={tone.value} value={tone.value}>
                        <div>
                          <Text>{tone.label}</Text>
                          <Text type="secondary" className="ml-2 text-xs">
                            - {tone.description}
                          </Text>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="preferredLanguage" label={t("content.language")}>
                  <Select
                    options={[
                      { value: "fr", label: "Français" },
                      { value: "en", label: "English" },
                    ]}
                  />
                </Form.Item>

                <Form.Item name="contentTopics" label={t("content.topics")}>
                  <Select
                    mode="tags"
                    placeholder={t("content.topicsPlaceholder")}
                    tokenSeparators={[","]}
                  />
                </Form.Item>

                <Form.Item name="expertise" label={t("content.expertise")}>
                  <Select
                    mode="tags"
                    placeholder={t("content.expertisePlaceholder")}
                    tokenSeparators={[","]}
                  />
                </Form.Item>
              </Card>
            </Col>

            {/* Contact Information */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <PhoneOutlined />
                    <span>{t("contact.title")}</span>
                  </Space>
                }
              >
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="phone"
                      label={t("contact.phone")}
                      extra={t("contact.phoneHelp")}
                    >
                      <Input
                        prefix={<PhoneOutlined />}
                        placeholder={t("contact.phonePlaceholder")}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="githubUrl"
                      label={t("contact.githubUrl")}
                      rules={[{ type: "url", message: t("contact.urlInvalid") }]}
                    >
                      <Input
                        prefix={<GithubOutlined />}
                        placeholder={t("contact.githubUrlPlaceholder")}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="portfolioUrl"
                      label={t("contact.portfolioUrl")}
                      rules={[{ type: "url", message: t("contact.urlInvalid") }]}
                    >
                      <Input
                        prefix={<LinkOutlined />}
                        placeholder={t("contact.portfolioUrlPlaceholder")}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="linkedInProfileUrl"
                      label={t("contact.linkedInProfileUrl")}
                      rules={[{ type: "url", message: t("contact.urlInvalid") }]}
                    >
                      <Input
                        prefix={<LinkedinOutlined />}
                        placeholder={t("contact.linkedInProfileUrlPlaceholder")}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Content Goals */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <AimOutlined />
                    <span>{t("goals.title")}</span>
                  </Space>
                }
              >
                <Form.Item
                  name="contentGoals"
                  label={t("goals.question")}
                  rules={[
                    {
                      required: true,
                      message: t("goals.required"),
                    },
                  ]}
                >
                  <Checkbox.Group className="w-full">
                    <Row gutter={[16, 16]}>
                      {contentGoalOptions.map((goal) => (
                        <Col xs={24} sm={12} md={8} key={goal.value}>
                          <Checkbox value={goal.value} className="w-full">
                            <div>
                              <Text strong>{goal.label}</Text>
                              <br />
                              <Text type="secondary" className="text-xs">
                                {goal.description}
                              </Text>
                            </div>
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Divider />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              size="large"
            >
              {t("actions.resetToDefaults")}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={isSaving}
              size="large"
              style={{
                background: "linear-gradient(135deg, #0A66C2 0%, #004182 100%)",
              }}
            >
              {t("actions.saveProfile")}
            </Button>
          </div>
        </Form>
      </div>
    </MainLayout>
  );
}
