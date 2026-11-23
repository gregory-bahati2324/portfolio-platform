import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import PublicLayout from "@/layouts/PublicLayout";
import ArticleDetail from "@/pages/public/ArticleDetail";
import Articles from "@/pages/public/Articles";
import NewsletterStatus from "@/pages/public/NewsletterStatus";
import About from "@/pages/public/About";
import Contact from "@/pages/public/Contact";
import Home from "@/pages/public/Home";
import NotFound from "@/pages/public/NotFound";
import ProjectDetail from "@/pages/public/ProjectDetail";
import Projects from "@/pages/public/Projects";
import Services from "@/pages/public/Services";
import Skills from "@/pages/public/Skills";

const ForgotPassword = lazy(() => import("@/pages/admin/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/admin/ResetPassword"));
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const Login = lazy(() => import("@/pages/admin/Login"));
const Overview = lazy(() => import("@/pages/admin/Overview"));
const AdminProfile = lazy(() => import("@/pages/admin/Profile"));
const AdminProjects = lazy(() => import("@/pages/admin/Projects"));
const ProjectEditor = lazy(() => import("@/pages/admin/ProjectEditor"));
const ProjectPreview = lazy(() => import("@/pages/admin/ProjectPreview"));
const AdminSkills = lazy(() => import("@/pages/admin/Skills"));
const AdminServices = lazy(() => import("@/pages/admin/Services"));
const AdminMedia = lazy(() => import("@/pages/admin/Media"));
const AdminInquiries = lazy(() => import("@/pages/admin/Inquiries"));
const AdminChatbot = lazy(() => import("@/pages/admin/Chatbot"));
const AdminArticles = lazy(() => import("@/pages/admin/Articles"));
const AdminTestimonials = lazy(() => import("@/pages/admin/Testimonials"));
const AdminNewsletter = lazy(() => import("@/pages/admin/Newsletter"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/services" element={<Services />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/:slug" element={<ArticleDetail />} />
          <Route path="/newsletter/confirm" element={<NewsletterStatus />} />
          <Route path="/newsletter/unsubscribe" element={<NewsletterStatus />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin/reset-password" element={<ResetPassword />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="projects/new" element={<ProjectEditor />} />
          <Route path="projects/:id" element={<ProjectEditor />} />
          <Route path="projects/:id/preview" element={<ProjectPreview />} />
          <Route path="skills" element={<AdminSkills />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="media" element={<AdminMedia />} />
          <Route path="inquiries" element={<AdminInquiries />} />
          <Route path="chatbot" element={<AdminChatbot />} />
          <Route path="articles" element={<AdminArticles />} />
          <Route path="testimonials" element={<AdminTestimonials />} />
          <Route path="newsletter" element={<AdminNewsletter />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
