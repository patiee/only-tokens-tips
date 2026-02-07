import Link from "next/link";
import { ArrowRight, Wallet, Zap, Globe, Coins, ShieldCheck, Settings, ExternalLink } from "lucide-react";
import { allChains, ChainFamily, nonEvmChains } from "@/config/chains";
import { HomeWidgetDemo } from "@/components/HomeWidgetDemo";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-geist-sans)] bg-black text-white relative overflow-hidden selection:bg-purple-500/30">

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[30%] right-[0%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[0%] left-[20%] w-[30%] h-[30%] bg-pink-600/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <main className="flex-1 flex flex-col items-center w-full z-10">

        {/* Hero Section */}
        <section className="w-full max-w-5xl px-6 pt-24 pb-16 flex flex-col items-center text-center">

          <h1 className="text-6xl sm:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-zinc-500 animate-in fade-in zoom-in-50 duration-700">
            Stream Tips
          </h1>

          <p className="text-xl sm:text-2xl text-zinc-400 max-w-2xl leading-relaxed mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            The next-gen crypto tipping platform for creators. <br />
            <span className="text-zinc-200">Receive tips from any network, directly to your wallet.</span>
          </p>

          <div className="flex gap-4 items-center flex-col sm:flex-row animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <Link
              href="/auth"
              className="rounded-full bg-white text-black px-10 py-4 font-bold text-lg hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              Start Receiving Tips <ArrowRight size={20} />
            </Link>
            <Link
              href="/auth"
              className="rounded-full border border-zinc-700 bg-zinc-900/50 px-10 py-4 font-bold text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all backdrop-blur-md"
            >
              Log In
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-zinc-800 text-xs font-medium text-zinc-500 mt-12 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 hover:bg-zinc-900 transition-colors cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live on Mainnet
          </div>

        </section>

        {/* How it Works */}
        <section className="w-full max-w-6xl px-6 py-24 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-black mb-6">How It Works</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              We've simplified crypto tipping. No custodial wallets or complex setups. Just direct payments to your wallet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="01"
              title="Create Profile"
              desc="Register as a creator, set your unique username, and connect your wallet browser extension."
            />
            <StepCard
              number="02"
              title="Select Network"
              desc="Choose your preferred network and asset (e.g., USDC onto Base or BTC onto Bitcoin) to receive funds from tips automatically converted to your preferred asset."
            />
            <StepCard
              number="03"
              title="Share & Earn"
              desc="Share your tip page link. Viewers send any token from any chain and you can share widget in your video stream."
            />
          </div>
        </section>

        {/* Widget Section */}
        <section className="w-full px-6 py-24 bg-gradient-to-b from-zinc-900/50 to-black border-t border-white/5 overflow-hidden">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-400 uppercase tracking-wider">
                For Streamers
              </div>
              <h2 className="text-4xl sm:text-5xl font-black leading-tight">
                Engage your audience with <span className="text-purple-400">Live Alerts</span>
              </h2>
              <p className="text-zinc-400 text-lg">
                Connect our widget to OBS, Streamlabs, or Twitch Studio. Every time you receive a tip, a customizable alert pops up on your stream instantly.
              </p>
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-green-400" /> Real-time blockchain verification
                </li>
                <li className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-green-400" /> Text-to-Speech (English, Spanish, French, German, Japanese, Korean, Chinese + 40 more)
                </li>
                <li className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-green-400" /> Fully customizable colors
                </li>
              </ul>
            </div>

            {/* Widget Visual */}
            <div className="flex-1 w-full max-w-md relative flex justify-center">
              {/* Mock Stream Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 blur-2xl rounded-full opacity-50 transition-opacity duration-1000" />

              <div className="relative z-10 w-full">
                <HomeWidgetDemo />
              </div>

              <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-purple-500/20 blur-3xl rounded-full" />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full max-w-6xl px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              icon={<Globe className="text-blue-400" />}
              title="Universal Payments"
              desc="Senders can pay with any token on any supported chain. The magic happens in the background."
            />
            <FeatureCard
              icon={<Coins className="text-yellow-400" />}
              title="Auto-Conversion"
              desc="Tips are automatically bridged and swapped to your preferred asset. You always get what you want."
            />
            <FeatureCard
              icon={<Wallet className="text-purple-400" />}
              title="Self-Custodial"
              desc="We never hold your funds. Tips go directly from the sender to your wallet. No withdrawal limits."
            />
            <FeatureCard
              icon={<Settings className="text-pink-400" />}
              title="Control"
              desc="Change your preferred network or destination wallet anytime in your account settings."
            />
          </div>
        </section>



        {/* Supported Networks */}
        <section className="w-full px-6 py-24 bg-zinc-900/30 border-y border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-black mb-6">Supported Networks</h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Accept tips from major blockchains. Sender pays on their chain, we handle the bridging to your wallet.
              </p>
            </div>

            <div className="flex flex-col gap-8">
              {/* Bitcoin */}
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <img src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png" alt="Bitcoin" className="w-32 h-32 opacity-50 grayscale" />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                    <img src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png" alt="Bitcoin" className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Bitcoin</h3>
                    <p className="text-zinc-400">Native BTC support. Direct wallet-to-wallet transactions.</p>
                  </div>

                </div>
              </div>

              {/* Solana */}
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <img src="https://assets.coingecko.com/coins/images/4128/small/solana.png" alt="Solana" className="w-32 h-32 opacity-50 grayscale" />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                    <img src="https://assets.coingecko.com/coins/images/4128/small/solana.png" alt="Solana" className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Solana</h3>
                    <p className="text-zinc-400">High-speed, low-cost tips. Supports USDC, SOL, and SPL tokens.</p>
                  </div>

                </div>
              </div>

              {/* Sui */}
              <div className="bg-gradient-to-br from-blue-400/10 to-blue-600/5 border border-blue-400/20 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <img src="https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg" alt="Sui" className="w-32 h-32 opacity-50 grayscale" />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <img src="https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg" alt="Sui" className="w-10 h-10 rounded-full" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Sui</h3>
                    <p className="text-zinc-400">Next-generation blockchain. Instant finality for your tips.</p>
                  </div>

                </div>
              </div>

              {/* EVM Grid */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700">
                    <Globe className="text-zinc-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">EVM Ecosystem</h3>
                    <p className="text-zinc-400">Support for Ethereum, Base, Arbitrum, Optimism, and more.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {allChains.filter(c => c.family === ChainFamily.EVM).map((chain) => (
                    <div key={chain.id} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 transition-all hover:-translate-y-1">
                      <img src={chain.logoURI} alt={chain.name} className="w-8 h-8 rounded-full" />
                      <span className="font-bold text-sm text-zinc-300">{chain.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="w-full max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl sm:text-5xl font-black mb-8">Ready to earn crypto?</h2>
          <Link
            href="/auth"
            className="inline-flex rounded-full bg-white text-black px-12 py-5 font-bold text-xl hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Get Started Now
          </Link>
          <div className="mt-8 text-zinc-500 text-sm">
            Dashboard & History available after login.
          </div>
        </section>

      </main>
    </div>
  );
}

function StepCard({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="p-8 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm relative overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className="text-6xl font-black text-zinc-800/50 absolute top-4 right-6 group-hover:text-zinc-800 transition-colors select-none">
        {number}
      </div>
      <h3 className="text-2xl font-bold mb-4 relative z-10">{title}</h3>
      <p className="text-zinc-400 leading-relaxed relative z-10">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800/60 backdrop-blur-sm hover:bg-zinc-900/80 transition-all group">
      <div className="mb-6 p-3 bg-zinc-950 rounded-2xl w-fit border border-zinc-800 group-hover:border-zinc-700 group-hover:scale-110 transition-all">{icon}</div>
      <h3 className="text-xl font-bold mb-3 text-zinc-200">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{desc}</p>
    </div>
  );
}
