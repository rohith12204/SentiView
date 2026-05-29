from django.urls import path
from . import views


urlpatterns = [
    # Auth
    path('auth/register/', views.register),
    path('auth/login/', views.login_view),
    path('auth/logout/', views.logout_view),
    path('auth/me/', views.me),

    # Public products
    path('products/', views.product_list),
    path('products/<int:pk>/', views.product_detail),

    # Admin product management
    path('admin/products/', views.admin_products),
    path('admin/products/<int:pk>/', views.admin_product_detail),
    path('admin/orders/', views.admin_orders),
    path('admin/orders/<int:pk>/status/', views.admin_order_status),

    # Cart
    path('cart/', views.cart_view),
    path('cart/add/', views.cart_add),
    path('cart/<int:pk>/update/', views.cart_update),
    path('cart/<int:pk>/remove/', views.cart_remove),
    path('cart/clear/', views.cart_clear),

    # Orders
    path('checkout/', views.checkout),
    path('orders/', views.my_orders),

    # Reviews
    # BUG FIX: GET and POST on the same endpoint for reviews
    path('products/<int:pk>/reviews/', views.product_reviews),
    path('products/<int:pk>/reviews/submit/', views.submit_review),
    path('products/<int:pk>/reviews/<int:review_id>/delete/', views.delete_review),
    path('products/<int:pk>/fake-analysis/', views.fake_review_analysis),
    path('products/<int:pk>/all-reviews/', views.all_reviews),

]
