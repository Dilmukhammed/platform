import { CreateTestForm } from "./CreateTestForm";

/**
 * Teacher Create Test Page
 *
 * Server component wrapper — the layout already calls requireAreaAccess("teacher"),
 * so we just render the client form component here.
 */
export default function CreateTestPage() {
  return <CreateTestForm />;
}
