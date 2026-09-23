import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAPI · 真实数据接入工作台",
  description: "从零配置媒体授权，校验真实接口，核对并保存广告报表。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
