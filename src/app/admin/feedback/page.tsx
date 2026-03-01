import { ProtectedRouteGate } from "@/components/protected-route-gate";
import FeedbackTriageClient from "./feedback-client";

export default function AdminFeedbackPage() {
    return (
        <ProtectedRouteGate>
            <FeedbackTriageClient />
        </ProtectedRouteGate>
    );
}
