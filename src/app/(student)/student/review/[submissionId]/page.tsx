import { redirect } from "next/navigation";

import { requireAreaAccess } from "@/lib/auth/guards";

export default async function StudentReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  await requireAreaAccess("student");
  const { submissionId } = await params;

  redirect(`/student/results/${submissionId}`);
}
