export interface ProblemTest {
  id: string;
  input: string;
  expected: string;
  label?: string;
}

export interface ExampleRun {
  testId: string;
  stdout: string;
  passed: boolean;
}

export type SubmitVerdict = 'accepted' | 'wrong_answer' | 'runtime_error' | 'time_limit';

export interface SubmitState {
  verdict: SubmitVerdict;
  publicResults: { testId: string; passed: boolean }[];
  hiddenPassed: number;
  hiddenTotal: number;
}

export interface Problem {
  slug: string;
  title: string;
  difficulty: number;
  tags: string[];
  acceptedPct: number;
  statement: string;
  visibleTests: ProblemTest[];
  hiddenTestCount: number;
  starterCode: string;
}
