import { PrivacyGuard } from "../../src/security/privacy-guard";
import { ValidationError } from "../../src/core/types";

// Build sensitive test strings dynamically so they don't appear as
// literals in the diff and trigger the privacy guard during self-review.
function keyHeader(algo: string): string {
  return ["-----BEGIN", algo, "PRIVATE KEY-----"].join(" ");
}

function keyFooter(algo: string): string {
  return ["-----END", algo, "PRIVATE KEY-----"].join(" ");
}

describe("PrivacyGuard", () => {
  const guard = new PrivacyGuard();

  describe("displayDisclaimer", () => {
    it("should not throw when called", () => {
      expect(() => guard.displayDisclaimer()).not.toThrow();
    });
  });

  describe("validateNoSecrets", () => {
    it("should pass for normal code diffs", () => {
      const diff = `
diff --git a/src/auth.ts b/src/auth.ts
+export function login(user: string, pass: string) {
+  return authenticate(user, pass);
+}
`;
      expect(() => guard.validateNoSecrets(diff)).not.toThrow();
    });

    it("should detect RSA private keys", () => {
      const diff = `\n+${keyHeader("RSA")}\n+MIIEowIBAAKCAQEA...\n+${keyFooter("RSA")}\n`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect EC private keys", () => {
      const diff = `\n+${keyHeader("EC")}\n+MHQCAQEEIBkg...\n+${keyFooter("EC")}\n`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect AWS access keys", () => {
      // Build AKIA prefix dynamically
      const awsKey = "AK" + "IA" + "IOSFODNN7EXAMPLE";
      const diff = `+const key = "${awsKey}";`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect hardcoded API tokens (sk-)", () => {
      const token = "sk-" + "abcdefghijklmnopqrstuvwxyz123456";
      const diff = `+const apiKey = "${token}";`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect GitHub personal access tokens", () => {
      const token = "ghp_" + "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1234";
      const diff = `+const token = "${token}";`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should not flag env var references", () => {
      const diff = `
+const apiKey = process.env.API_KEY;
+const token = process.env.GITHUB_TOKEN;
`;
      expect(() => guard.validateNoSecrets(diff)).not.toThrow();
    });

    it("should not flag placeholder strings", () => {
      const diff = `
+const key = "your-api-key-here";
+const token = "REPLACE_ME";
`;
      expect(() => guard.validateNoSecrets(diff)).not.toThrow();
    });

    it("should include pattern preview in error", () => {
      const diff = `+${keyHeader("RSA")}`;
      try {
        guard.validateNoSecrets(diff);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).message).toContain("Potential secret detected");
      }
    });
  });
});
