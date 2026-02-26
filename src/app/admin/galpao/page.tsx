import Placeholder from "@/components/placeholder";
import { isGalpaoFeatureEnabled } from "@/lib/features";
import AdminGalpaoClient from "./galpao-client";

export default function AdminGalpaoPage() {
  if (!isGalpaoFeatureEnabled()) {
    return (
      <Placeholder
        title="Admin / Galpão"
        backHref="/admin"
        description="Feature ECO_FEATURES_GALPAO desativada neste ambiente."
      />
    );
  }

  return <AdminGalpaoClient />;
}
