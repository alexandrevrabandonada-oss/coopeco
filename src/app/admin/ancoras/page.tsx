import Placeholder from "@/components/placeholder";
import { isAnchorsFeatureEnabled } from "@/lib/features";
import AdminAncorasClient from "./ancoras-client";

export default function AdminAncorasPage() {
  if (!isAnchorsFeatureEnabled()) {
    return (
      <Placeholder
        title="Admin / Âncoras"
        backHref="/admin"
        description="Feature ECO_FEATURES_ANCHORS desativada neste ambiente."
      />
    );
  }

  return <AdminAncorasClient />;
}
