import { AuthCard } from "@/app/components/AuthCard";
import { RegisterWizard } from "./RegisterWizard";

export default function RegisterPage() {
  return (
    <AuthCard eyebrow="Crear cuenta" title="Armá tu perfil" wide>
      <RegisterWizard />
    </AuthCard>
  );
}
