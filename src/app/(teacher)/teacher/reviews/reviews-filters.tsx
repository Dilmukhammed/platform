'use client';

import { Filter } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { t } from '@/lib/translations';

interface ReviewsFiltersProps {
  publications: { id: string; title: string }[];
  classes: { classId: string; title: string }[];
  filterPublication: string;
  filterClass: string;
  filterStatus: string;
  searchQuery: string;
}

export function ReviewsFilters({
  publications,
  classes,
  filterPublication,
  filterClass,
  filterStatus,
  searchQuery,
}: ReviewsFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-foreground-secondary" />
      <span className="text-sm text-foreground-secondary">{t.teacher.reviews.filters.label}</span>
      <form action="/teacher/reviews" method="GET" className="flex items-center gap-2">
        {searchQuery && <input type="hidden" name="search" value={searchQuery} />}
        <Select
          name="publication"
          size="sm"
          defaultValue={filterPublication}
          onChange={(e) => e.currentTarget.form?.submit()}
        >
          <option value="">{t.teacher.reviews.filters.allPublications}</option>
          {publications.map((pub) => (
            <option key={pub.id} value={pub.id}>
              {pub.title}
            </option>
          ))}
        </Select>
        <Select
          name="class"
          size="sm"
          defaultValue={filterClass}
          onChange={(e) => e.currentTarget.form?.submit()}
        >
          <option value="">{t.teacher.reviews.filters.allClasses}</option>
          {classes.map((cls) => (
            <option key={cls.classId} value={cls.classId}>
              {cls.title}
            </option>
          ))}
        </Select>
        <Select
          name="status"
          size="sm"
          defaultValue={filterStatus}
          onChange={(e) => e.currentTarget.form?.submit()}
        >
          <option value="">{t.teacher.reviews.filters.allStatus}</option>
          <option value="pending">{t.teacher.reviews.submissions.reviewStatus.pending}</option>
          <option value="in-review">{t.teacher.reviews.submissions.reviewStatus.draft}</option>
          <option value="released">{t.teacher.reviews.submissions.reviewStatus.released}</option>
        </Select>
      </form>
    </div>
  );
}
