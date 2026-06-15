export default function SetupNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-lg p-6">
        <h1 className="text-lg font-bold text-brand mb-2">Almost there — connect Supabase</h1>
        <p className="text-sm text-slate-600 mb-4">
          The app can't find your Supabase credentials. Create a <code>.env</code> file in the
          project root (copy <code>.env.example</code>) and add:
        </p>
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-md p-3 overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key`}
        </pre>
        <p className="text-xs text-slate-500 mt-4">
          These values are public by design — security is enforced by Row Level Security + Auth.
          Then restart <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
