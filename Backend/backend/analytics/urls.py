from django.urls import path
from .views import (
    # ── existing ──────────────────────────────────────────────
    product_analytics,
    search_products,
    product_details,
    dashboard_metrics,
    compare_api,
    product_summary,
    sentiment_trend,
    fake_review_api,
    # ── new: keyword drilldown + XAI ──────────────────────────
    keyword_impact,
    keyword_drilldown,
    review_explain,
    keyword_products,all_reviews,
    customers_say
)

urlpatterns = [
    # ── existing ──────────────────────────────────────────────────────────────
    path("products/",        product_analytics),
    path("search/",          search_products),
    path("product/",         product_details),
    path("dashboard/",       dashboard_metrics),
    path("compare/",         compare_api),
    path("summary/",         product_summary),
    path("sentiment-trend/", sentiment_trend),
    path("fake-review/",     fake_review_api),

    # ── NEW: keyword feature endpoints ───────────────────────────────────────
    # Feature 1 + 2: keyword drilldown panel + product filtering
    path("keyword-drilldown/", keyword_drilldown),   # GET ?keyword=battery&product=all

    # Feature 4: impact score list for all keywords
    path("keyword-impact/",    keyword_impact),      # GET

    # Feature 3: explainable AI for a single review
    path("review-explain/",    review_explain),      # POST { text }

    # Helper: full product list for the filter dropdown
    path("keyword-products/",  keyword_products),    # GET
    path('products/<int:id>/all-reviews/', all_reviews),
    path('all-reviews/', all_reviews),
    path('customers-say/', customers_say),

]