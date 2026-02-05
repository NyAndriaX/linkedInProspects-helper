# LinkedIn Prospects Helper

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Ant%20Design-6-0170FE?style=for-the-badge&logo=ant-design" alt="Ant Design" />
  <img src="https://img.shields.io/badge/LinkedIn-OAuth-0A66C2?style=for-the-badge&logo=linkedin" alt="LinkedIn" />
</p>

<p align="center">
  <strong>Your intelligent LinkedIn prospecting assistant</strong>
</p>

<p align="center">
  Streamline your LinkedIn prospecting workflow with automated tools, smart tracking, and powerful analytics.
</p>

---

## Overview

**LinkedIn Prospects Helper** is a modern web application designed to help sales professionals, recruiters, and business developers manage their LinkedIn prospecting activities more efficiently.

### Key Features

| Feature | Description |
|---------|-------------|
| **LinkedIn Authentication** | Secure OAuth 2.0 login with your LinkedIn account |
| **Prospect Management** | Track and organize your LinkedIn prospects in one place |
| **Message Tracking** | Keep track of sent messages and follow-ups |
| **Search History** | Save and revisit your prospect searches |
| **Analytics Dashboard** | Visualize your prospecting metrics and performance |

## How It Works

### 1. Connect Your LinkedIn Account

Sign in securely using your LinkedIn credentials. We use OAuth 2.0 to ensure your password is never shared with our application.

<p align="center">
  <em>Click "Sign in with LinkedIn" → Authorize the app → Start prospecting</em>
</p>

### 2. Dashboard Overview

Once logged in, you'll see your personalized dashboard with:

- **Quick Stats**: Overview of your prospects, messages, and searches
- **Recent Activity**: Your latest prospecting actions
- **Quick Actions**: One-click access to common tasks

### 3. Manage Your Prospects

| Action | Description |
|--------|-------------|
| **Add Prospects** | Import prospects from your LinkedIn searches |
| **Organize** | Tag and categorize prospects by status, industry, or custom labels |
| **Track Progress** | Monitor where each prospect is in your pipeline |
| **Notes** | Add personal notes and reminders for each prospect |

### 4. Message Management

- **Templates**: Create reusable message templates
- **Tracking**: See which messages have been sent
- **Follow-ups**: Set reminders for follow-up messages
- **Analytics**: Track response rates and engagement

## User Interface

### Login Screen

Clean and simple authentication page with LinkedIn OAuth integration.

### Main Dashboard

Modern, responsive dashboard built with Ant Design components featuring:
- Real-time statistics
- Quick action buttons
- User profile dropdown
- Dark/Light mode support

## Permissions Required

When you connect your LinkedIn account, we request the following permissions:

| Permission | Purpose |
|------------|---------|
| `openid` | Verify your identity |
| `profile` | Access your name and profile picture |
| `email` | Access your email address |

> **Privacy Note**: We only access the minimum data required to provide our services. Your LinkedIn password is never stored or accessed by our application.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **NextAuth.js** | Authentication library |
| **Ant Design** | UI component library |
| **Tailwind CSS** | Utility-first styling |
| **TypeScript** | Type-safe development |

## Support

Having issues or questions? Here's how to get help:

- **Bug Reports**: Open an issue on GitHub
- **Feature Requests**: Submit a feature request via GitHub issues
- **Documentation**: Check the `/docs` folder for detailed guides

## Roadmap

- [ ] Bulk prospect import
- [ ] Advanced search filters
- [ ] Email integration
- [ ] CRM export (Salesforce, HubSpot)
- [ ] Team collaboration features
- [ ] Mobile app

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for LinkedIn prospectors everywhere
</p>

---

## For Developers

Looking to set up the development environment? See [INSTALL.md](docs/INSTALL.md) for installation instructions.
