import Placeholder from "@/components/placeholder";
import { isLearnFeatureEnabled } from "@/lib/features";
import AprenderMaterialClientPage from "./page-client";

export default function AprenderMaterialPage({ params }: { params: { material: string } }) {
  if (!isLearnFeatureEnabled()) {
    return (
      <Placeholder
        title="Aprender / Material"
        backHref="/aprender"
        description="Feature ECO_FEATURES_LEARN desativada neste ambiente."
      />
    );
  }

  return <AprenderMaterialClientPage params={params} />;
}
