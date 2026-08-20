export type AppRole = "learner" | "provider" | "admin";
export type ProviderRole = "deaf_tutor" | "qualified_deaf_teacher" | "interpreter";
export type AdminRole = "super" | "verification" | "support" | "finance";
export type ProviderStatus = "draft" | "pending" | "approved" | "rejected" | "suspended";
export type VerificationType = "identity" | "deaf" | "teacher_qualification" | "interpreter_assessment";
export type VerificationState = "not_submitted" | "pending" | "approved" | "rejected" | "needs_information";

export interface UserSummary {
  id: string;
  displayName: string;
  roles: AppRole[];
  languages: string[];
}
