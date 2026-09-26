/** Writes the GitHub Actions workflow that matches the current settings (illustrative, not executed). */
import type { RunConfig } from './engine'

export function toWorkflowYaml(cfg: RunConfig): string {
  const aws = cfg.target === 'aws'
  const deployNeeds = aws ? 'image' : 'build'
  const lines = [
    'name: ci',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '',
    'concurrency:',
    '  group: ci-${{ github.ref }}',
    '  cancel-in-progress: true',
    '',
    'permissions:',
    '  contents: read',
    '  id-token: write   # OIDC to the cloud, no long-lived keys',
    '',
    'jobs:',
    '  lint:',
    '    runs-on: ubuntu-24.04',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with: { node-version: 22, cache: npm }',
    '      - run: npm ci',
    '      - run: npx eslint . --max-warnings 0',
    '',
    '  typecheck:',
    '    runs-on: ubuntu-24.04',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with: { node-version: 22, cache: npm }',
    '      - run: npm ci',
    '      - run: npx tsc --noEmit',
    '',
    '  unit:',
    '    needs: [lint, typecheck]',
    '    runs-on: ubuntu-24.04',
    '    strategy:',
    '      matrix: { node: [20, 22] }',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with: { node-version: "${{ matrix.node }}", cache: npm }',
    '      - run: npm ci',
    '      - run: npx vitest run --coverage',
    '',
    '  e2e:',
    '    needs: [lint, typecheck]',
    '    runs-on: ubuntu-24.04',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with: { node-version: 22, cache: npm }',
    '      - run: npm ci',
    '      - run: npx playwright install --with-deps chromium',
    '      - run: npx playwright test',
    '',
    '  build:',
    '    needs: [unit, e2e]',
    '    runs-on: ubuntu-24.04',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with: { node-version: 22, cache: npm }',
    '      - uses: actions/cache@v4',
    '        with:',
    '          path: .next/cache',
    "          key: nextjs-${{ hashFiles('package-lock.json') }}",
    '      - run: npm ci',
    '      - run: npm run build',
    '      - uses: actions/upload-artifact@v4',
    '        with: { name: next-build, path: .next }',
    '',
  ]
  if (aws) {
    lines.push(
      '  image:',
      '    needs: build',
      '    runs-on: ubuntu-24.04',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - uses: docker/setup-buildx-action@v3',
      '      - uses: aws-actions/configure-aws-credentials@v4',
      '        with: { role-to-assume: "${{ vars.DEPLOY_ROLE }}", aws-region: "${{ vars.AWS_REGION }}" }',
      '      - id: ecr',
      '        uses: aws-actions/amazon-ecr-login@v2',
      '      - uses: docker/build-push-action@v6',
      '        with:',
      '          push: true',
      '          tags: ${{ steps.ecr.outputs.registry }}/web:${{ github.sha }}',
      '          cache-from: type=gha',
      '          cache-to: type=gha,mode=max',
      '',
    )
  }
  const deploy = (id: string, env: 'preview' | 'production', cond: string) => {
    lines.push(
      `  ${id}:`,
      `    needs: ${deployNeeds}`,
      `    if: ${cond}`,
      '    runs-on: ubuntu-24.04',
      `    environment: ${env}${env === 'production' ? '   # required reviewers gate this job' : ''}`,
      '    steps:',
    )
    if (aws) {
      lines.push(
        '      - uses: aws-actions/configure-aws-credentials@v4',
        '        with: { role-to-assume: "${{ vars.DEPLOY_ROLE }}", aws-region: "${{ vars.AWS_REGION }}" }',
        `      - run: aws ecs update-service --cluster ${env} --service web --force-new-deployment`,
        `      - run: aws ecs wait services-stable --cluster ${env} --services web`,
      )
    } else {
      lines.push(
        '      - uses: actions/download-artifact@v4',
        '        with: { name: next-build, path: .next }',
        `      - run: npx vercel deploy --prebuilt${env === 'production' ? ' --prod' : ''} --token "$VERCEL_TOKEN"`,
        '        env: { VERCEL_TOKEN: "${{ secrets.VERCEL_TOKEN }}" }',
      )
    }
    lines.push('      - run: curl -fsS "$DEPLOY_URL/api/health"', '')
  }
  deploy('deploy-preview', 'preview', "github.ref != 'refs/heads/main'")
  deploy('deploy-prod', 'production', "github.ref == 'refs/heads/main'")
  return lines.join('\n')
}
