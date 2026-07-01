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

export type SubmitVerdict = 'ok' | 'wa' | 'tle' | 'rte';

export interface SubmitState {
  verdict: SubmitVerdict;
  stars: 0 | 1 | 2 | 3;
  failedTest?: number;
  failedTier?: 1 | 2 | 3;
}

export interface Problem {
  slug: string;
  title: string;
  statement: string;
  starter_code: string;
  order_index: number;
  visibleTests: ServerTest[];
  checker_py?: string | null;
}

export interface ServerTest {
  id: number;
  ordinal: number;
  tier: number;
  input: string;
  expected: string;
  is_visible?: number;
}

export type Tier = 1 | 2 | 3;

export interface SubmitTestCase {
  ordinal: number;
  tier: Tier;
  input: string;
  expected: string;
  fieldsJson?: string | null;
}

export type SubmitResult =
  | { verdict: 'ok'; stars: 3 }
  | { verdict: 'wa' | 'tle' | 'rte'; stars: 0 | 1 | 2; failedTier: Tier; failedTest: number };

export interface ProblemListItem {
  id: number;
  slug: string;
  title: string;
  order_index: number;
}

export interface BestStars {
  problem_id: number;
  best_stars: number;
}
