import Placeholder from "@/components/placeholder";
import { isPilotFeatureEnabled } from "@/lib/features";
import AdminOperacaoClient from "./operacao-client";

export default function AdminOperacaoPage() {
  if (!isPilotFeatureEnabled()) {
    return (
      <Placeholder
        title="Admin / Operação"
        backHref="/admin"
        description="Feature ECO_FEATURES_PILOT desativada neste ambiente."
      />
    );
  }

  return <AdminOperacaoClient />;
}
