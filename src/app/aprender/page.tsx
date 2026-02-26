import Placeholder from "@/components/placeholder";
import { isLearnFeatureEnabled } from "@/lib/features";
import AprenderClientPage from "./page-client";

export default function AprenderPage() {
  if (!isLearnFeatureEnabled()) {
    return (
      <Placeholder
        title="Aprender"
        backHref="/"
        description="Feature ECO_FEATURES_LEARN desativada neste ambiente."
      />
    );
  }

  return <AprenderClientPage />;
}
