import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Security headers for production
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/(.*).(woff2|ttf|otf|eot)",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },

  async redirects() {
    return [
      // Route 1: teacher review (pluralization)
      {
        source: "/teacher/review",
        destination: "/teacher/reviews",
        permanent: true,
      },
      {
        source: "/teacher/review/:submissionId*",
        destination: "/teacher/reviews/:submissionId*",
        permanent: true,
      },
      // Route 3: admin organization approvals
      {
        source: "/admin/organizations/pending",
        destination: "/admin/organization-approvals",
        permanent: true,
      },
      // Route 4: auth student sign-in to login
      {
        source: "/auth/student/sign-in",
        destination: "/auth/student/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
