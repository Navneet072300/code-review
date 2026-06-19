export type AnalysisMode = "full" | "beginner" | "senior";

export interface AnalysisResult {
  summary: string;
  language_detected: string;
  what_it_does: string;
  execution_flow: string;
  potential_issues: string[];
  suggested_improvements: string[];
  fixed_version: string;
  best_practices: string[];
  complexity_analysis: { time: string; space: string };
  key_takeaways: string[];
}

export interface TestResult {
  language: string;
  test_framework: string;
  tests: string;
  explanation: string;
}

export interface DocsResult {
  documented_code: string;
  readme_section: string;
  api_reference: string;
}

export interface ConvertResult {
  converted_code: string;
  notes: string[];
  caveats: string[];
}

export interface DiagramResult {
  diagram: string;
  diagram_type: string;
  description: string;
}

export interface SecurityVulnerability {
  title: string;
  severity: string;
  description: string;
  line_hint: string;
  remediation: string;
}

export interface SecurityResult {
  risk_level: "critical" | "high" | "medium" | "low" | "none";
  vulnerabilities: SecurityVulnerability[];
  secure_version: string;
  summary: string;
}

export interface InterviewQuestion {
  question: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  hint: string;
  answer: string;
}

export interface InterviewResult {
  questions: InterviewQuestion[];
}

export interface CommitResult {
  commit_message: string;
  type: string;
  scope: string;
  breaking_change: boolean;
  explanation: string;
}

export interface RepoModule {
  name: string;
  purpose: string;
  key_dependencies: string[];
}

export interface RepoAnalysisResult {
  repo_summary: string;
  tech_stack: string[];
  architecture_overview: string;
  project_structure: string;
  entry_points: string[];
  key_modules: RepoModule[];
  data_flow: string;
  code_quality_score: number;
  code_quality_notes: string;
  potential_issues: string[];
  security_concerns: string[];
  suggested_improvements: string[];
  architecture_diagram: string;
  key_takeaways: string[];
}

export type TabId =
  | "overview"
  | "flow"
  | "issues"
  | "optimization"
  | "tests"
  | "docs"
  | "diagram"
  | "security"
  | "interview";
