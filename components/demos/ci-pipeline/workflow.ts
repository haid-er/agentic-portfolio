/** Writes the GitHub Actions workflow that matches the current settings (illustrative, not executed). */
import type { RunConfig } from './engine'

/** GitHub expression that is true on the production branch. */
const PROD = "github.ref == 'refs/heads/main'"

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
    ...(aws ? [] : [
      'env:',
      '  VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}',
      '  VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}',
      '',
    ]),
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
    ...(aws
      ? [
          '      - run: npm run build',
          '      - uses: actions/upload-artifact@v4',
          '        with: { name: next-build, path: .next, include-hidden-files: true }',
        ]
      : [
          // `vercel deploy --prebuilt` needs the Build Output API folder (.vercel/output) that `vercel build` writes.
          `      - run: npx vercel pull --yes --environment=\${{ ${PROD} && 'production' || 'preview' }} --token "$VERCEL_TOKEN"`,
          '        env: { VERCEL_TOKEN: "${{ secrets.VERCEL_TOKEN }}" }',
          `      - run: npx vercel build \${{ ${PROD} && '--prod' || '' }} --token "$VERCEL_TOKEN"`,
          '        env: { VERCEL_TOKEN: "${{ secrets.VERCEL_TOKEN }}" }',
          '      - uses: actions/upload-artifact@v4',
          '        with: { name: vercel-output, path: .vercel/output, include-hidden-files: true }',
        ]),
    '',
  ]
  if (aws) {
    lines.push(
      '  image:',
      '    needs: build',
      '    runs-on: ubuntu-24.04',
      '    outputs:',
      '      uri: ${{ steps.ecr.outputs.registry }}/web:${{ github.sha }}',
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
      '    env: { DEPLOY_URL: "${{ vars.DEPLOY_URL }}" }',
      '    steps:',
    )
    if (aws) {
      // Register a task definition revision that points at this commit's image, then roll the service onto it.
      lines.push(
        '      - uses: actions/checkout@v4',
        '      - uses: aws-actions/configure-aws-credentials@v4',
        '        with: { role-to-assume: "${{ vars.DEPLOY_ROLE }}", aws-region: "${{ vars.AWS_REGION }}" }',
        '      - id: taskdef',
        '        uses: aws-actions/amazon-ecs-render-task-definition@v1',
        '        with:',
        `          task-definition: .aws/task-definition.${env}.json`,
        '          container-name: web',
        '          image: ${{ needs.image.outputs.uri }}',
        '      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2',
        '        with:',
        '          task-definition: ${{ steps.taskdef.outputs.task-definition }}',
        `          cluster: ${env}`,
        '          service: web',
        '          wait-for-service-stability: true',
      )
    } else {
      lines.push(
        '      - uses: actions/download-artifact@v4',
        '        with: { name: vercel-output, path: .vercel/output }',
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
