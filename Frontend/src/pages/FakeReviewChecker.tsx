import { useState } from "react";
import { detectFakeReview } from "../services/productApi";

export default function FakeReviewChecker() {
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!text.trim()) {
      setError("Please enter a review");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await detectFakeReview({
        text,
        rating,
      });

      setResult(res);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // 🎯 Confidence color
  const confidenceColor = (c: number) => {
    if (c >= 70) return "text-red-500";
    if (c >= 40) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Fake Review Detector 🧠</h2>

      {/* TEXT INPUT */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a review..."
        className="w-full p-3 border rounded-lg mb-4 dark:bg-slate-800"
      />

      {/* RATING */}
      <input
        type="number"
        min={1}
        max={5}
        placeholder="Rating (optional)"
        onChange={(e) => setRating(Number(e.target.value))}
        className="w-full p-2 border rounded-lg mb-4 dark:bg-slate-800"
      />

      {/* ERROR */}
      {error && (
        <p className="text-red-500 text-sm mb-3">{error}</p>
      )}

      {/* BUTTON */}
      <button
        onClick={handleCheck}
        className="bg-indigo-600 hover:bg-indigo-700 transition text-white px-4 py-2 rounded-lg w-full"
      >
        {loading ? "Checking..." : "Analyze"}
      </button>

      {/* RESULT */}
      {result && (
        <div className="mt-6 space-y-5">

          {/* RESULT LABEL */}
          <div className="text-lg font-semibold">
            Result:{" "}
            <span
              className={
                result.is_fake ? "text-red-500" : "text-green-500"
              }
            >
              {result.is_fake ? "Fake ⚠️" : "Genuine ✅"}
            </span>
          </div>

          {/* ✅ SINGLE CORRECT CONFIDENCE BAR */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>
                {result.is_fake ? "Fake Confidence" : "Genuine Confidence"}
              </span>
              <span className={confidenceColor(result.confidence)}>
                {Math.round(result.confidence)}%
              </span>
            </div>

            <div className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  result.is_fake ? "bg-red-500" : "bg-green-500"
                }`}
                style={{ width: `${result.confidence}%` }}
              />
            </div>

            <div className="text-xs mt-1 text-gray-500 text-right">
              {result.is_fake
                ? "Higher = more likely fake"
                : "Higher = more likely genuine"}
            </div>
          </div>

          {/* RISK SCORE */}
          {result.risk_score != null && (
            <div className="text-sm">
              Risk Score:{" "}
              <span className="font-semibold">
                {Math.round(result.risk_score)}/100
              </span>
            </div>
          )}

          {/* FAKE TYPE */}
          {result.fake_type && (
            <div className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Type: <span className="font-medium">{result.fake_type}</span>
            </div>
          )}

          {/* SIGNAL MESSAGE */}
          <div className="text-xs text-gray-500 italic">
            {result.is_fake
              ? "Fake signals detected"
              : "No fake signals detected"}
          </div>

          {/* REASONS */}
          {result.reasons?.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold mb-1">Reasons:</p>
              <ul className="list-disc pl-5 space-y-1">
                {result.reasons.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}