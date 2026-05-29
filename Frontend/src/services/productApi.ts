const BASE_URL  = "https://sentiview-api-j728.onrender.com/api/analytics";
const STORE_URL = "https://sentiview-api-j728.onrender.com/api/store";

async function handleResponse(res: Response, label: string) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`❌ ${label} failed (${res.status}):`, body);
    throw new Error(`${label} failed: ${res.status}`);
  }
  return res.json();
}

// ─── Store / Products ─────────────────────────────────────────────────────────

export const fetchProducts = async () => {
  const res = await fetch(`${STORE_URL}/products/`);
  return handleResponse(res, "fetchProducts");
};

export const searchProducts = async (query: string) => {
  const res = await fetch(`${STORE_URL}/products/?search=${encodeURIComponent(query)}`);
  return handleResponse(res, "searchProducts");
};

export const fetchProductDetails = async (name: string) => {
  const res = await fetch(`${BASE_URL}/product/?name=${encodeURIComponent(name)}`);
  return handleResponse(res, "fetchProductDetails");
};

export const fetchDashboard = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/`);
  return handleResponse(res, "fetchDashboard");
};

export const compareProducts = async (products: string[]) => {
  const res = await fetch(`${BASE_URL}/compare/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });
  return handleResponse(res, "compareProducts");
};

export const fetchSummary = async (name: string) => {
  const res = await fetch(`${BASE_URL}/summary/?name=${encodeURIComponent(name)}`);
  return handleResponse(res, "fetchSummary");
};

export const fetchSentimentTrend = async (product: string) => {
  try {
    // BUG FIX: trim and normalise whitespace before sending
    const cleanName = product.trim().replace(/\s+/g, " ");
    const url = `${BASE_URL}/sentiment-trend/?name=${encodeURIComponent(cleanName)}`;

    console.log("Fetching trend for:", cleanName);
    const res = await fetch(url);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("API Error Response:", errorText);
      throw new Error(`API Error: ${res.status}`);
    }

    const data = await res.json();

    if (!data || !data.trend) {
      console.error("Invalid response format:", data);
      throw new Error("Invalid API response");
    }

    return data;
  } catch (error) {
    console.error("fetchSentimentTrend failed:", error);
    throw error;
  }
};

// BUG FIX: detectFakeReview now accepts optional rating for better signal detection
export const detectFakeReview = async (text: string, rating?: number) => {
  const body: Record<string, unknown> = { text };
  if (rating !== undefined && rating > 0) {
    body.rating = rating;
  }
  const res = await fetch(`${BASE_URL}/fake-review/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(res, "detectFakeReview");
};

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const fetchProductReviews = async (productId: number) => {
  const res = await fetch(`${STORE_URL}/products/${productId}/reviews/`);
  return handleResponse(res, "fetchProductReviews");
};

export const submitReview = async (
  productId: number,
  payload: { rating: number; title: string; body: string },
  token: string
) => {
  const res = await fetch(`${STORE_URL}/products/${productId}/reviews/submit/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, "submitReview");
};

export const deleteReview = async (productId: number, reviewId: number, token: string) => {
  const res = await fetch(
    `${STORE_URL}/products/${productId}/reviews/${reviewId}/delete/`,
    { method: "DELETE", headers: { Authorization: `Token ${token}` } }
  );
  return handleResponse(res, "deleteReview");
};

export const fetchFakeAnalysis = async (productId: number) => {
  const res = await fetch(`${STORE_URL}/products/${productId}/fake-analysis/`);
  return handleResponse(res, "fetchFakeAnalysis");
};

export const fetchAllReviews = async (
  productId: number,
  params: { limit?: number; sentiment?: string; show?: string; name?: string } = {}
) => {
  // FIX: use analytics endpoint which reads CSV reviews by product name
  const q = new URLSearchParams();
  if (params.name)      q.set("name",      params.name);
  if (params.limit)     q.set("limit",     String(params.limit));
  if (params.sentiment) q.set("sentiment", params.sentiment);
  if (params.show)      q.set("show",      params.show);
  const res = await fetch(`${BASE_URL}/all-reviews/?${q}`);
  return handleResponse(res, "fetchAllReviews");
};

// NEW: Customers Say summary (Amazon-style)
export const fetchCustomersSay = async (productName: string) => {
  const res = await fetch(`${BASE_URL}/customers-say/?name=${encodeURIComponent(productName)}`);
  return handleResponse(res, "fetchCustomersSay");
};

// ─── Keyword Drilldown + Impact + XAI ────────────────────────────────────────

export const fetchKeywordImpact = async () => {
  const res = await fetch(`${BASE_URL}/keyword-impact/`);
  return handleResponse(res, "fetchKeywordImpact");
};

export const fetchKeywordDrilldown = async (keyword: string, product = "all") => {
  const q = new URLSearchParams({ keyword, product });
  const res = await fetch(`${BASE_URL}/keyword-drilldown/?${q}`);
  return handleResponse(res, "fetchKeywordDrilldown");
};

export const explainReview = async (text: string) => {
  const res = await fetch(`${BASE_URL}/review-explain/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return handleResponse(res, "explainReview");
};

export const fetchKeywordProducts = async () => {
  const res = await fetch(`${BASE_URL}/keyword-products/`);
  return handleResponse(res, "fetchKeywordProducts");
};