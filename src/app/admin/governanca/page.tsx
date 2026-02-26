import Placeholder from "@/components/placeholder";
import { isGovFeatureEnabled } from "@/lib/features";
import AdminGovernancaClient from "./governanca-client";

export default function AdminGovernancaPage() {
  if (!isGovFeatureEnabled()) {
    return (
      <Placeholder
        title="Admin / Governança"
        backHref="/admin"
        description="Feature ECO_FEATURES_GOV desativada neste ambiente."
      />
    );
  }

  return <AdminGovernancaClient />;
}
