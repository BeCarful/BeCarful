import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";
import { env } from "@/lib/env";

export function googleAuthOptions() {
  const { GCP_WORKLOAD_IDENTITY_PROVIDER: provider, GCP_SERVICE_ACCOUNT_EMAIL: serviceAccount } = env();
  if (!provider || !serviceAccount) return {};
  return {
    credentials: {
      type: "external_account",
      audience: `//iam.googleapis.com/${provider}`,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
      subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
    },
  };
}
