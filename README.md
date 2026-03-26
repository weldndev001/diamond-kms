# DIAMOND Knowledge Management System (KMS)

Welcome to **DIAMOND KMS**, a modern and comprehensive Knowledge Management System equipped with Artificial Intelligence (AI) to empower learning, knowledge sharing, and enterprise information management.

## 🚀 Features

- **Knowledge Base & Content Management**
  - Create, view, and organize documents and contents.
  - Rich-text editing powered by [Tiptap](https://tiptap.dev/).
  - Feature-complete management for internal knowledge and standard operating procedures (SOPs).
  
- **AI-Powered Capabilities**
  - **AI Assistant:** Ask questions about company knowledge, extract insights, and summarize documents.
  - Intelligent Semantic Search to locate information using natural language.
  - Integrated with large language models including OpenAI and Google Generative AI (Gemini).

- **Employee Engagement & Training**
  - **Quizzes:** Assess employee comprehension (Pemahaman Pegawai).
  - **Read Trackers:** Monitor document reading compliance.
  - **Leaderboard:** Gamify the learning experience.

- **Enterprise Workflows**
  - Advanced multi-role access control (Super Admin, Group Admin, Supervisor, Maintainer).
  - Document and Content Approvals pipeline.
  - User and Division management tailored for Human Resources (HRD).
  - Suggestion box for employees to contribute ideas.

---

## 🛠 Tech Stack

Our application is built using the latest web technologies to ensure scalability, performance, and an exceptional user experience:

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router format)
- **Language:** TypeScript
- **Database ORM:** [Prisma](https://www.prisma.io/)
- **Database:** PostgreSQL (Self-hosted on `db01.weldn.ai`)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/)
- **Storage Provider:** Cloud Storage (S3-Compatible REST API)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components:** [Radix UI](https://www.radix-ui.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Form Handling & Validation:** React Hook Form + Zod
- **AI SDK:** Custom integrations using `@google/generative-ai` and `openai`

---

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm, yarn, pnpm, or bun
- A PostgreSQL Database (Local or Hosted)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd diamond-kms
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file at the root of your project based on `.env.example`. You will need variables for:
   - Database connection (`DATABASE_URL`, `DIRECT_URL`)
   - Storage directory (`UPLOAD_DIR`)
   - Applicable AI API Keys (OpenAI, Gemini)

4. **Initialize Database:**
   Generate the Prisma client and run migrations (if any):
   ```bash
   npx prisma generate
   npx prisma db push
   # Optional: run seeders if available
   # npm run seed
   ```

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application specifies port `7000`. Navigate to [http://localhost:7000](http://localhost:7000) in your browser.

---

## 📜 Development Scripts

- `npm run dev`: Starts the Next.js development server on port 7000.
- `npm run build`: Compiles the application for production deployment.
- `npm run start`: Runs the production server on port 7000.
- `npm run lint`: Runs ESLint to find and fix styling/syntax issues.
- `npm run postinstall`: Automatically generates the Prisma client.

---

## 🔒 Security & Access

Authentication is securely managed through **NextAuth.js** using Credentials Provider with bcrypt encryption, combined with robust role-based routing natively integrated into the Next.js App Router (Middleware checks).

### Defined System Roles:
- **SUPER_ADMIN**: Full system access, configuration, and HR/Billing management.
- **MAINTAINER**: Access to system overviews, error logs, and AI service provider configurations.
- **GROUP_ADMIN**: Can manage users, track document readings, and oversee approvals inside a group.
- **SUPERVISOR**: Can monitor team progress and reading trackers.
- *(Standard Users)*: Access to knowledge bases, quizzes, and the AI Assistant.

---

## 💎 Design Guidelines

Always maintain consistency with the defined design rules and spacing defined in `tailwind.config` / `postcss-variables`, ensuring a premium and modern UI utilizing subtle borders, glassmorphic touches, and smooth transitions.

---

For internal development support, reach out to the engineering team.
