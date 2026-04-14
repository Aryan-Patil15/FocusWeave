import { PageHeader } from '@/components/layout/page-header';
import { FocusAuditorWorkspace } from '@/components/focus-auditor/focus-auditor-workspace';

export default function FocusAuditorPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Core Feature"
        title="Adaptive Focus Auditor"
        description="Build your ideal 24-hour rhythm, import real activity data, and audit exactly where your day aligned or drifted."
      />
      <FocusAuditorWorkspace />
    </div>
  );
}
