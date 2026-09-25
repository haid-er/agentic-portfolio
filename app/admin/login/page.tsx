/** /admin/login. STUB — owner: admin-core. */
export default function LoginPage() {
  return (
    <form method="post" action="/api/admin/login" className="grid gap-4 max-w-sm">
      <h1 className="text-4">Admin login</h1>
      <label className="mono" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" className="min-h-tap px-3 border border-rule bg-surface" />
      <button type="submit" className="min-h-tap border border-rule mono">Sign in</button>
    </form>
  )
}
