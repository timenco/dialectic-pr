import { ConsensusEngine } from "../../src/core/consensus-engine";

/**
 * ConsensusEngine.parseReviewResponse tests
 * Test the private method via the public generateReview API-level contract,
 * but since we can't easily mock ClaudeAdapter, we test the parser directly
 * by accessing it through a test-friendly wrapper.
 */

// Access private parseReviewResponse via prototype
function parseResponse(text: string) {
  const engine = new ConsensusEngine(null as any);
  return (engine as any).parseReviewResponse(text);
}

describe("ConsensusEngine.parseReviewResponse", () => {
  it("should parse a well-formed response with consensus JSON", () => {
    const responseText = `
=== STEP 1: REVIEW AGENT ANALYSIS ===

Issue 1 (bug): Missing null check in auth handler.
  - File: src/auth/auth.controller.ts, Line: 42
  - Evidence: user.id accessed without null check
  - Impact: Potential runtime crash

=== STEP 2: DEV AGENT CHALLENGE ===

Issue 1 Challenge: The null check is handled by the auth guard upstream.
→ REJECT (reason: guard already validates user)

=== STEP 3: OUTPUT ===

📋 Executive Summary
The PR improves the auth flow. No significant issues found.

🔴 Critical Issues
✅ Critical 이슈 없음

🟡 Important Issues
✅ Important 이슈 없음

✅ 긍정적인 점
- Clean separation of concerns
- Good test coverage

📊 Final Verdict
결론: LGTM ✅
머지: 즉시 가능
우선순위: P2 (일반)

\`\`\`json
{
  "consensus_completed": true,
  "agreed_issues": [],
  "rejected_issues": [{"issue": "Missing null check", "reason": "guard already validates"}],
  "verdict": "LGTM",
  "false_positive_rate": 1.0
}
\`\`\`
`;

    const result = parseResponse(responseText);

    expect(result.consensus.verdict).toBe("APPROVE");
    expect(result.consensus.agreedIssues).toBe(0);
    expect(result.consensus.rejectedIssues).toBe(1);
    expect(result.consensus.fpRate).toBe("100%");
    expect(result.consensus.mergeable).toBe(true);
    expect(result.debateNarrative).toBeDefined();
    expect(result.debateNarrative).toContain("STEP 1");
    expect(result.issues).toEqual([]);
  });

  it("should parse CHANGES_REQUESTED verdict", () => {
    const responseText = `
Some review text.

\`\`\`json
{
  "consensus_completed": true,
  "agreed_issues": ["SQL injection in query builder"],
  "rejected_issues": [],
  "verdict": "CHANGES_REQUESTED",
  "false_positive_rate": 0.0
}
\`\`\`
`;

    const result = parseResponse(responseText);

    expect(result.consensus.verdict).toBe("REQUEST_CHANGES");
    expect(result.consensus.agreedIssues).toBe(1);
    expect(result.consensus.rejectedIssues).toBe(0);
    expect(result.consensus.fpRate).toBe("0%");
    expect(result.consensus.mergeable).toBe(false);
    expect(result.consensus.priority).toBe("high");
  });

  it("should parse NEEDS_DISCUSSION verdict", () => {
    const responseText = `
Review content here.

\`\`\`json
{
  "consensus_completed": true,
  "agreed_issues": ["Consider refactoring"],
  "rejected_issues": [{"issue": "Style issue", "reason": "subjective"}],
  "verdict": "NEEDS_DISCUSSION",
  "false_positive_rate": 0.5
}
\`\`\`
`;

    const result = parseResponse(responseText);

    expect(result.consensus.verdict).toBe("COMMENT");
    expect(result.consensus.mergeable).toBe(true);
    expect(result.consensus.priority).toBe("medium");
    expect(result.consensus.fpRate).toBe("50%");
  });

  it("should find consensus JSON by content, not position", () => {
    const responseText = `
Review text.

\`\`\`json
{
  "consensus_completed": true,
  "agreed_issues": [],
  "rejected_issues": [],
  "verdict": "LGTM",
  "false_positive_rate": 0.0
}
\`\`\`

\`\`\`typescript
// some code suggestion
const x = 1;
\`\`\`
`;

    const result = parseResponse(responseText);

    expect(result.consensus.verdict).toBe("APPROVE");
    // The narrative should include both the text before and the code suggestion after
    expect(result.debateNarrative).toContain("Review text");
    expect(result.debateNarrative).toContain("code suggestion");
  });

  it("should handle unfenced JSON fallback", () => {
    const responseText = `
Some review text without code fences.

{
  "consensus_completed": true,
  "agreed_issues": ["issue1"],
  "rejected_issues": [],
  "verdict": "CHANGES_REQUESTED",
  "false_positive_rate": 0.0
}
`;

    const result = parseResponse(responseText);

    expect(result.consensus.verdict).toBe("REQUEST_CHANGES");
    expect(result.consensus.agreedIssues).toBe(1);
  });

  it("should handle completely unparseable response", () => {
    const responseText = "This is just plain text with no JSON at all.";

    const result = parseResponse(responseText);

    expect(result.consensus.overallAssessment).toBe("Failed to parse review response");
    expect(result.issues).toEqual([]);
  });

  it("should salvage narrative with STEP markers on parse failure", () => {
    const responseText = `
=== STEP 1: REVIEW AGENT ANALYSIS ===
Some analysis here.

=== STEP 2: DEV AGENT CHALLENGE ===
Some challenges here.

No valid JSON block.
`;

    const result = parseResponse(responseText);

    expect(result.debateNarrative).toBeDefined();
    expect(result.debateNarrative).toContain("STEP 1");
  });

  it("should handle missing optional fields gracefully", () => {
    const responseText = `
\`\`\`json
{
  "consensus_completed": true
}
\`\`\`
`;

    const result = parseResponse(responseText);

    expect(result.consensus.agreedIssues).toBe(0);
    expect(result.consensus.rejectedIssues).toBe(0);
    expect(result.consensus.verdict).toBe("APPROVE");
    expect(result.consensus.fpRate).toBe("0%");
  });
});
