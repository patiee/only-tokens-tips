import Link from "next/link";
import { ArrowRight, Wallet, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-black text-white relative overflow-hidden">

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-purple-600/20 blur-[100px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-blue-600/20 blur-[100px] rounded-full" />
      </div>

      <main className="flex flex-col gap-8 items-center text-center z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live on mainnet
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-tr from-white to-zinc-500">
          Crypto Tips for <br /> Next Gen Streamers
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 max-w-xl">
          Receive ETH, USDC, and tokens directly from your viewers with 0% platform fees. Instant settlement.
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row mt-4">
          <Link
            href="/signup"
            className="rounded-full bg-white text-black px-8 py-3.5 font-semibold text-lg hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            Start Receiving Tips <ArrowRight size={20} />
          </Link>
          <a
            href="https://github.com/only-tokens-tips"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-zinc-700 bg-zinc-900/50 px-8 py-3.5 font-medium text-white hover:bg-zinc-800 transition-all"
          >
            View on GitHub
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 w-full text-left">
          <FeatureCard
            icon={<Wallet className="text-purple-400" />}
            title="Direct Wallet"
            desc="Tips go straight to your self-custodial wallet."
          />
          <FeatureCard
            icon={<Zap className="text-yellow-400" />}
            title="Instant Alerts"
            desc="Real-time OBS overlays for every donation."
          />
          <FeatureCard
            icon={<div className="text-green-400 font-bold">$</div>}
            title="0% Fees"
            desc="We don't take a cut. You keep 100% of tips."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-zinc-400">{desc}</p>
    </div>
  );
}
