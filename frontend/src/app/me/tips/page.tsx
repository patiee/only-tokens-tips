
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, DollarSign, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";

type Tip = {
    created_at: string;
    sender: string;
    amount: string;
    asset: string;
    message: string;
    tx_hash: string;
};

function TipsContent() {
    const [tips, setTips] = useState<Tip[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [prevCursors, setPrevCursors] = useState<string[]>([]);
    const [page, setPage] = useState(1);

    // Limits
    const limit = 20;

    const router = useRouter();

    const fetchTips = async (cursor?: string) => {
        setLoading(true);
        const token = localStorage.getItem("user_token");
        if (!token) {
            router.push("/auth");
            return;
        }

        try {
            let url = `${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me/tips?limit=${limit}`;
            if (cursor) url += `&cursor=${cursor}`;

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to fetch tips");

            const data = await res.json();

            // Handle { tips: [], next_cursor: "..." }
            if (data.tips) {
                setTips(data.tips);
                setNextCursor(data.next_cursor || null);
            } else {
                setTips([]); // Fallback
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTips();
    }, []);

    const handleNext = () => {
        if (!nextCursor) return;
        setPrevCursors([...prevCursors, nextCursor]); // Store current cursor as "prev" is wrong logic for cursor pagination usually, but for simple "next" flow:
        // Actually, for cursor pagination:
        // Page 1: no cursor. Returns next_cursor_A.
        // Page 2: cursor=next_cursor_A. Returns next_cursor_B.
        // To go back, we need to store the cursor used to get HERE.
        // Let's simplify: Just forward for now, or use a stack.

        // Better logic:
        // current page is fetched with cursor X. 
        // next page is fetched with next_cursor

        // We need to push the *current* cursor to history? No, the cursor used to fetch the *current* page.
        // Initial fetch: cursor=undefined.
        // API returns tips + next_cursor.

        // Let's just strictly use next_cursor for next page.
        // For prev page, we pop from history?
        // Actually cursor pagination is hard to do "Previous" without bi-directional cursors or keeping history.
        // Let's just implement Load More (Infinite Scroll style) or Simple Next/Prev if API supports it.
        // Assuming forward-only cursor for simplicity in this iteration unless we want to rebuild the stack.

        // Let's simple "Next" for now.
        if (nextCursor) {
            // Save current view's start cursor? 
            // We don't have it easily.
            // Let's just fetch next.
            fetchTips(nextCursor);
            setPage(p => p + 1);
        }
    };

    // Reload (Reset)
    const handleRefresh = () => {
        setNextCursor(null);
        setPage(1);
        fetchTips();
    };


    if (loading && page === 1) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 relative">
            {/* Global Gradient Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/10 pointer-events-none" />

            <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-8 relative z-10">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-white/5 pb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/me" className="p-2 rounded-full bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">All Tips</h1>
                            <p className="text-zinc-400 text-sm">History of all transactions received.</p>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 backdrop-blur-sm">
                        Error: {error}
                    </div>
                )}

                <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl overflow-hidden">
                    {tips.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-4">
                            <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center border border-white/5">
                                <DollarSign size={24} className="text-zinc-600" />
                            </div>
                            <p>No tips found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">Sender</th>
                                        <th className="py-3 px-4">Amount</th>
                                        <th className="py-3 px-4">Message</th>
                                        <th className="py-3 px-4">Tx Hash</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-white/5">
                                    {tips.map((tip, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                                            <td className="py-3 px-4 text-zinc-400 whitespace-nowrap group-hover:text-zinc-300 transition-colors">
                                                {new Date(tip.created_at).toLocaleDateString()} <span className="text-zinc-600 group-hover:text-zinc-500">|</span> {new Date(tip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-3 px-4 font-medium text-white">{tip.sender}</td>
                                            <td className="py-3 px-4 text-green-400 font-mono">
                                                {tip.amount} {tip.asset || "ETH"}
                                            </td>
                                            <td className="py-3 px-4 text-zinc-300 break-words whitespace-normal min-w-[200px] max-w-xs block">
                                                {tip.message}
                                            </td>
                                            <td className="py-3 px-4">
                                                {tip.tx_hash ? (
                                                    <a
                                                        href={`https://basescan.org/tx/${tip.tx_hash}`} // TODO: Dynamic
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-purple-400 hover:text-purple-300 text-xs bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 flex items-center gap-1 w-fit transition-colors hover:bg-purple-500/20"
                                                    >
                                                        View <ExternalLink size={10} />
                                                    </a>
                                                ) : <span className="text-zinc-600">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                        <div className="text-xs text-zinc-500">
                            Page {page} {nextCursor ? "(More available)" : "(End of list)"}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefresh} // Reset to start
                                disabled={page === 1}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors border border-white/5 hover:border-white/10"
                            >
                                First Page
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={!nextCursor || loading}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors flex items-center gap-2 border border-white/5 hover:border-white/10"
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {/* The menu is global, no changes needed */}
        </div>
    );
}

export default function TipsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TipsContent />
        </Suspense>
    );
}
