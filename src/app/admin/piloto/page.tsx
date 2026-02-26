import Placeholder from "@/components/placeholder";
import { isPilotFeatureEnabled } from "@/lib/features";
import AdminPilotoClient from "./piloto-client";

export default function AdminPilotoPage() {
  if (!isPilotFeatureEnabled()) {
    return (
      <Placeholder
        title="Admin / Piloto"
        backHref="/admin"
        description="Feature ECO_FEATURES_PILOT desativada neste ambiente."
      />
    );
  }

  return <AdminPilotoClient />;
}
