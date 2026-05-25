import { Suspense } from "react";
import GradebookContent from "./gradebook-content";
import { t } from "@/lib/translations";

function GradebookLoading() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-foreground">{t.teacher.gradebook.title}</h1>
        <p className="mt-1 text-body text-foreground-secondary">{t.teacher.gradebook.loading}</p>
      </div>
    </section>
  );
}

export default function TeacherGradebookPage() {
  return (
    <Suspense fallback={<GradebookLoading />}>
      <GradebookContent />
    </Suspense>
  );
}