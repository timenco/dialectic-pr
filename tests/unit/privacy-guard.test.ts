import { PrivacyGuard } from "../../src/security/privacy-guard";
import { ValidationError } from "../../src/core/types";

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
      const diff = `
+-----BEGIN RSA PRIVATE KEY-----
+MIIEowIBAAKCAQEA...
+-----END RSA PRIVATE KEY-----
`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect EC private keys", () => {
      const diff = `
+-----BEGIN EC PRIVATE KEY-----
+MHQCAQEEIBkg...
+-----END EC PRIVATE KEY-----
`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect AWS access keys", () => {
      const diff = `+const key = "AKIAIOSFODNN7EXAMPLE";`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect hardcoded API tokens (sk-)", () => {
      const diff = `+const apiKey = "sk-abcdefghijklmnopqrstuvwxyz123456";`;
      expect(() => guard.validateNoSecrets(diff)).toThrow(ValidationError);
    });

    it("should detect GitHub personal access tokens", () => {
      const diff = `+const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1234";`;
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
      const diff = `+-----BEGIN RSA PRIVATE KEY-----`;
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
