# Installation Guide

This guide will help you set up LinkedIn Prospects Helper for local development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0 or higher
- **Yarn** (recommended) or npm
- **Git**
- A **LinkedIn Developer Account**

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/linkedInProspects-helper.git
cd linkedInProspects-helper
```

## Step 2: Install Dependencies

```bash
# Using Yarn (recommended)
yarn install

# Or using npm
npm install
```

## Step 3: Set Up LinkedIn OAuth

### Create a LinkedIn Application

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click **Create App**
3. Fill in the required information:
   - App name: `LinkedIn Prospects Helper`
   - LinkedIn Page: Select or create one
   - App logo: Upload a logo
4. Accept the terms and click **Create App**

### Configure OAuth 2.0

1. In your app settings, go to the **Auth** tab
2. Under **OAuth 2.0 settings**, add the following redirect URLs:

| Environment | Redirect URL |
|-------------|--------------|
| Development | `http://localhost:3000/api/auth/callback/linkedin` |
| Production | `https://your-domain.com/api/auth/callback/linkedin` |

3. Under **Products**, request access to:
   - **Sign In with LinkedIn using OpenID Connect**

4. Copy your **Client ID** and **Client Secret**

## Step 4: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# LinkedIn OAuth Configuration
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### Generate NextAuth Secret

```bash
openssl rand -base64 32
```

Copy the output and paste it as your `NEXTAUTH_SECRET`.

## Step 5: Run the Development Server

```bash
# Using Yarn
yarn dev

# Or using npm
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 6: Verify Installation

1. You should see the login page
2. Click **Sign in with LinkedIn**
3. Authorize the application
4. You should be redirected to the dashboard

## Project Structure

```
linkedInProspects-helper/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   └── auth/[...nextauth]/   # NextAuth API routes
│   ├── login/                    # Login page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page (dashboard)
├── components/                   # React components
│   └── providers/                # Context providers
├── docs/                         # Documentation
├── lib/                          # Core utilities
│   └── auth.ts                   # NextAuth configuration
├── public/                       # Static assets
├── types/                        # TypeScript definitions
│   └── next-auth.d.ts            # NextAuth type extensions
├── .cursorrules                  # Cursor AI guidelines
├── .env.example                  # Environment variables template
├── package.json                  # Dependencies and scripts
├── tailwind.config.ts            # Tailwind configuration
└── tsconfig.json                 # TypeScript configuration
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server |
| `yarn build` | Build for production |
| `yarn start` | Start production server |
| `yarn lint` | Run ESLint |

## Troubleshooting

### "Invalid redirect_uri" Error

Make sure the redirect URL in your LinkedIn app settings exactly matches:
```
http://localhost:3000/api/auth/callback/linkedin
```

### "NEXTAUTH_SECRET" Error

Ensure you have set the `NEXTAUTH_SECRET` in your `.env.local` file.

### LinkedIn OAuth Not Working

1. Verify your Client ID and Secret are correct
2. Ensure you've requested the "Sign In with LinkedIn using OpenID Connect" product
3. Check that the redirect URL is added in LinkedIn app settings

### Port Already in Use

If port 3000 is in use, you can specify a different port:

```bash
yarn dev -p 3001
```

Update `NEXTAUTH_URL` accordingly:
```env
NEXTAUTH_URL=http://localhost:3001
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Update `NEXTAUTH_URL` to your production URL
5. Add production redirect URL in LinkedIn app settings

### Other Platforms

The app can be deployed to any platform that supports Node.js:
- Railway
- Render
- DigitalOcean App Platform
- AWS Amplify

Remember to:
1. Set all environment variables
2. Update `NEXTAUTH_URL` to your production URL
3. Add the production callback URL to LinkedIn OAuth settings

## Next Steps

- Read the [Contributing Guide](../CONTRIBUTING.md) to learn how to contribute
- Check the [API Documentation](./API.md) for backend endpoints
- Review the [.cursorrules](../.cursorrules) for coding guidelines
