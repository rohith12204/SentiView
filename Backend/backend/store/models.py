from django.db import models
from django.contrib.auth.models import User


class Product(models.Model):
    """Admin-managed product catalog"""
    name = models.CharField(max_length=200)
    brand = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)  # ✅ add this

    image_url = models.URLField(blank=True, default='')
    category = models.CharField(max_length=100, default='Smartphone')
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Specs
    ram = models.CharField(max_length=50, blank=True)
    battery = models.CharField(max_length=50, blank=True)
    display = models.CharField(max_length=100, blank=True)
    processor = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.brand} {self.model_name}"


class CartItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cart_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'product')

    def subtotal(self):
        return self.product.price * self.quantity

    def __str__(self):
        return f"{self.user.username} – {self.product.name} x{self.quantity}"


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    # Dummy payment info
    payment_method = models.CharField(max_length=50, default='card')
    transaction_id = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"Order #{self.id} – {self.user.username} – {self.status}"


class Review(models.Model):
    """User-submitted review and rating for a product"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField()  # 1–5
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    sentiment = models.CharField(max_length=20, blank=True, default='')
    is_fake = models.BooleanField(null=True, blank=True)
    fake_confidence = models.FloatField(null=True, blank=True)
    fake_score = models.PositiveSmallIntegerField(null=True, blank=True)   # signal count
    fake_signals = models.JSONField(default=list, blank=True)              # list of triggered signals
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'product')

    def __str__(self):
        return f"{self.user.username} → {self.product.name} ({self.rating}★)"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=200)  # snapshot at purchase time
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    def subtotal(self):
        return self.price * self.quantity

    def __str__(self):
        return f"{self.product_name} x{self.quantity}"
