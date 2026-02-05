"use client";

import Image from "next/image";
import { Button, Card, Space, Typography, message } from "antd";
import { RocketOutlined, BookOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

export default function Home() {
  const [messageApi, contextHolder] = message.useMessage();

  const showMessage = () => {
    messageApi.success("Ant Design est bien intégré ! 🎉");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      {contextHolder}
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        
        <Card className="w-full mt-8" variant="borderless">
          <Title level={2}>Bienvenue sur Next.js + Ant Design</Title>
          <Paragraph className="text-lg text-zinc-600">
            Ant Design a été intégré avec succès dans votre projet Next.js.
            Vous pouvez maintenant utiliser tous les composants de la librairie.
          </Paragraph>
          
          <Space wrap className="mt-4">
            <Button type="primary" icon={<RocketOutlined />} onClick={showMessage}>
              Tester Ant Design
            </Button>
            <Button icon={<BookOutlined />} href="https://ant.design/components/overview" target="_blank">
              Documentation Ant Design
            </Button>
          </Space>
        </Card>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row mt-8">
          <Button
            type="primary"
            size="large"
            icon={<RocketOutlined />}
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
          >
            Deploy Now
          </Button>
          <Button
            size="large"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
          >
            Documentation Next.js
          </Button>
        </div>
      </main>
    </div>
  );
}
