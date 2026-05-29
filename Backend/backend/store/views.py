from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Product, CartItem, Order, OrderItem, Review
from ml.fake_detector import detect_fake_review as _detect_fake
from decimal import Decimal
from pathlib import Path
import pandas as pd
import uuid
import json

# ─────────────────────────────────────────────────────────────
# CSV SENTIMENT ENRICHMENT
# ─────────────────────────────────────────────────────────────
REVIEWS_PATH = Path(__file__).resolve().parent.parent / "ml" / "data" / "reviews.csv"


def _get_sentiment_map():
    """Read CSV and return sentiment/aspect scores keyed by lowercase model name."""
    try:
        df = pd.read_csv(REVIEWS_PATH)
        result = {}

        for (brand, model), g in df.groupby(["brand", "model"]):
            total = len(g)
            if total == 0:
                continue

            positive = (g["sentiment"] == "Positive").sum()

            def aspect(col):
                if col in g.columns and g[col].notna().any():
                    return round(float(g[col].mean()) * 20, 1)
                return None

            def clean(text):
                return str(text).lower().strip().replace("iphone", "iphone").replace("  ", " ")

            full_key = clean(f"{brand} {model}")
            simple_key = clean(model)

            data = {
                "sentiment_score": round((positive / total) * 100, 1),
                "avg_rating": round(float(g["rating"].mean()), 2),
                "camera_score": aspect("camera_rating"),
                "battery_score": aspect("battery_life_rating"),
                "performance_score": aspect("performance_rating"),
            }

            result[full_key] = data
            result[simple_key] = data
            # print("CSV LOADED:", len(df))
            # print("SAMPLE:", df.head(2))
            # print("MAP KEYS:", list(result.keys())[:5])
            # print("MAP SAMPLE:", list(result.keys())[:10])
        return result
    except Exception:
        return {}


# ─────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get('username', '').strip()
    email    = request.data.get('email', '').strip()
    password = request.data.get('password', '')
    name     = request.data.get('name', '').strip()

    if not username or not password or not email:
        return Response({'error': 'username, email and password are required'}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already taken'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already registered'}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=name.split()[0] if name else '',
        last_name=' '.join(name.split()[1:]) if len(name.split()) > 1 else '',
    )
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': _serialize_user(user)}, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if '@' in username:
        try:
            user_obj = User.objects.get(email=username)
            username = user_obj.username
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=401)

    user = authenticate(username=username, password=password)
    if not user:
        return Response({'error': 'Invalid credentials'}, status=401)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': _serialize_user(user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({'message': 'Logged out'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(_serialize_user(request.user))


def _serialize_user(user):
    return {
        'id':       user.id,
        'username': user.username,
        'email':    user.email,
        'name':     f"{user.first_name} {user.last_name}".strip() or user.username,
        'is_admin': user.is_staff or user.is_superuser,
    }


# ─────────────────────────────────────────────────────────────
# PUBLIC: PRODUCT LISTING
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def product_list(request):
    products = Product.objects.filter(is_active=True)
    query = request.GET.get('search', '')
    if query:
        products = products.filter(name__icontains=query)

    sentiment_map = _get_sentiment_map()
    return Response([_serialize_product(p, sentiment_map) for p in products])


@api_view(['GET'])
@permission_classes([AllowAny])
def product_detail(request, pk):
    try:
        product = Product.objects.get(pk=pk, is_active=True)
        sentiment_map = _get_sentiment_map()
        return Response(_serialize_product(product, sentiment_map))
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)


def _serialize_product(p, sentiment_map=None):
    if p.image:
        image = f'http://127.0.0.1:8000{p.image.url}'
    elif p.image_url:
        image = p.image_url
    else:
        image = f'https://via.placeholder.com/300x240/6366f1/ffffff?text={p.model_name}'

    scores = {}
    if sentiment_map:
        model = (p.model_name or "").lower()
        brand = (p.brand or "").lower()

            # try multiple matching strategies
        key = f"{brand} {model}"

        def find_best_match(sentiment_map, key):
            for k, v in sentiment_map.items():
                if key in k or k in key:
                    return v
            return {}

        scores = find_best_match(sentiment_map, key)

        print("MATCHING:", brand, model, "→", scores)

    return {
        'id':                p.id,
        'name':              p.name,
        'brand':             p.brand,
        'model':             p.model_name,
        'price':             float(p.price),
        'description':       p.description,
        'image_url':         image,
        'category':          p.category,
        'stock':             p.stock,
        'is_active':         p.is_active,
        'sentiment_score':   scores.get('sentiment_score'),
        'avg_rating':        scores.get('avg_rating'),
        'camera_score':      scores.get('camera_score'),
        'battery_score':     scores.get('battery_score'),
        'performance_score': scores.get('performance_score'),
        'specs': {
            'ram':       p.ram,
            'battery':   p.battery,
            'display':   p.display,
            'processor': p.processor,
        },
        'created_at': p.created_at.isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# ADMIN: PRODUCT MANAGEMENT
# ─────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_products(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required'}, status=403)

    if request.method == 'GET':
        sentiment_map = _get_sentiment_map()
        products = Product.objects.all()
        return Response([_serialize_product(p, sentiment_map) for p in products])

    data = request.data
    required = ['name', 'brand', 'model_name', 'price']
    for field in required:
        if not data.get(field):
            return Response({'error': f'{field} is required'}, status=400)

    # BUG FIX: handle is_active as string "true"/"false" from FormData
    is_active_raw = data.get('is_active', 'true')
    is_active = str(is_active_raw).lower() in ('true', '1', 'yes')

    product = Product.objects.create(
        name=data['name'],
        brand=data['brand'],
        model_name=data['model_name'],
        price=Decimal(str(data['price'])),
        description=data.get('description', ''),
        image_url=data.get('image_url', ''),
        image=request.FILES.get('image'),
        category=data.get('category', 'Smartphone'),
        stock=int(data.get('stock', 0)),
        is_active=is_active,
        ram=data.get('ram', ''),
        battery=data.get('battery', ''),
        display=data.get('display', ''),
        processor=data.get('processor', ''),
    )
    return Response(_serialize_product(product), status=201)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_product_detail(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required'}, status=403)

    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    if request.method == 'GET':
        sentiment_map = _get_sentiment_map()
        return Response(_serialize_product(product, sentiment_map))

    if request.method == 'PUT':
        data = request.data
        product.name        = data.get('name', product.name)
        product.brand       = data.get('brand', product.brand)
        product.model_name  = data.get('model_name', product.model_name)
        product.price       = Decimal(str(data.get('price', product.price)))
        product.description = data.get('description', product.description)
        product.image_url   = data.get('image_url', product.image_url)
        product.category    = data.get('category', product.category)
        product.stock       = int(data.get('stock', product.stock))
        product.ram         = data.get('ram', product.ram)
        product.battery     = data.get('battery', product.battery)
        product.display     = data.get('display', product.display)
        product.processor   = data.get('processor', product.processor)

        is_active_val = data.get('is_active', None)
        if is_active_val is not None:
            product.is_active = str(is_active_val).lower() in ('true', '1', 'yes')

        if request.FILES.get('image'):
            product.image = request.FILES['image']

        product.save()
        sentiment_map = _get_sentiment_map()
        return Response(_serialize_product(product, sentiment_map))

    if request.method == 'DELETE':
        product.delete()
        return Response({'message': 'Product deleted'})


# ─────────────────────────────────────────────────────────────
# ADMIN: ORDERS
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_orders(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required'}, status=403)

    orders = Order.objects.all().select_related('user').prefetch_related('items').order_by('-created_at')
    return Response([_serialize_order(o) for o in orders])


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_order_status(request, pk):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin access required'}, status=403)
    try:
        order = Order.objects.get(pk=pk)
        order.status = request.data.get('status', order.status)
        order.save()
        return Response(_serialize_order(order))
    except Order.DoesNotExist:
        return Response({'error': 'Order not found'}, status=404)


# ─────────────────────────────────────────────────────────────
# USER: CART
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cart_view(request):
    items = CartItem.objects.filter(user=request.user).select_related('product')
    return Response([_serialize_cart_item(i) for i in items])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cart_add(request):
    product_id = request.data.get('product_id')
    quantity   = int(request.data.get('quantity', 1))

    try:
        product = Product.objects.get(pk=product_id, is_active=True)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    if quantity > product.stock:
        return Response({'error': f'Only {product.stock} in stock'}, status=400)

    item, created = CartItem.objects.get_or_create(
        user=request.user, product=product,
        defaults={'quantity': quantity}
    )
    if not created:
        item.quantity = min(item.quantity + quantity, product.stock)
        item.save()

    return Response(_serialize_cart_item(item), status=201 if created else 200)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def cart_update(request, pk):
    try:
        item = CartItem.objects.get(pk=pk, user=request.user)
    except CartItem.DoesNotExist:
        return Response({'error': 'Cart item not found'}, status=404)

    quantity = int(request.data.get('quantity', item.quantity))
    if quantity <= 0:
        item.delete()
        return Response({'message': 'Item removed'})
    item.quantity = min(quantity, item.product.stock)
    item.save()
    return Response(_serialize_cart_item(item))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cart_remove(request, pk):
    try:
        item = CartItem.objects.get(pk=pk, user=request.user)
        item.delete()
        return Response({'message': 'Removed from cart'})
    except CartItem.DoesNotExist:
        return Response({'error': 'Cart item not found'}, status=404)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cart_clear(request):
    CartItem.objects.filter(user=request.user).delete()
    return Response({'message': 'Cart cleared'})


def _serialize_cart_item(item):
    return {
        'id':       item.id,
        'product':  _serialize_product(item.product),
        'quantity': item.quantity,
        'subtotal': float(item.subtotal()),
    }


# ─────────────────────────────────────────────────────────────
# USER: ORDERS / CHECKOUT
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def checkout(request):
    cart_items = CartItem.objects.filter(user=request.user).select_related('product')

    if not cart_items.exists():
        return Response({'error': 'Cart is empty'}, status=400)

    total          = sum(i.subtotal() for i in cart_items)
    payment_method = request.data.get('payment_method', 'card')
    transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"

    order = Order.objects.create(
        user=request.user,
        total_amount=total,
        status='paid',
        payment_method=payment_method,
        transaction_id=transaction_id,
    )

    for item in cart_items:
        OrderItem.objects.create(
            order=order,
            product=item.product,
            product_name=item.product.name,
            price=item.product.price,
            quantity=item.quantity,
        )
        item.product.stock = max(0, item.product.stock - item.quantity)
        item.product.save()

    cart_items.delete()

    return Response({
        'order':          _serialize_order(order),
        'transaction_id': transaction_id,
        'message':        'Payment successful! Order placed.',
    }, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_orders(request):
    orders = Order.objects.filter(user=request.user).prefetch_related('items').order_by('-created_at')
    return Response([_serialize_order(o) for o in orders])


def _serialize_order(order):
    return {
        'id':             order.id,
        'status':         order.status,
        'total_amount':   float(order.total_amount),
        'payment_method': order.payment_method,
        'transaction_id': order.transaction_id,
        'created_at':     order.created_at.isoformat(),
        'user':           order.user.username,
        'items': [
            {
                'product_name': i.product_name,
                'price':        float(i.price),
                'quantity':     i.quantity,
                'subtotal':     float(i.subtotal()),
            }
            for i in order.items.all()
        ],
    }


# ─────────────────────────────────────────────────────────────
# USER: REVIEWS & RATINGS
# ─────────────────────────────────────────────────────────────

def _simple_sentiment(rating: int) -> str:
    if rating >= 4:
        return 'Positive'
    elif rating == 3:
        return 'Neutral'
    return 'Negative'


def _serialize_review(r):
    # BUG FIX: fake_signals is a JSONField (list) — always return list, never None
    fake_signals = r.fake_signals
    if fake_signals is None:
        fake_signals = []
    elif isinstance(fake_signals, str):
        try:
            fake_signals = json.loads(fake_signals)
        except Exception:
            fake_signals = []

    return {
        'id':               r.id,
        'user':             r.user.username,
        'rating':           r.rating,
        'title':            r.title,
        'body':             r.body,
        'sentiment':        r.sentiment,
        'is_fake':          r.is_fake,
        'fake_confidence':  r.fake_confidence,
        'fake_score':       r.fake_score,
        'fake_signals':     fake_signals,
        'created_at':       r.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def product_reviews(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    reviews = product.reviews.select_related('user').all()
    data = [_serialize_review(r) for r in reviews]

    total         = len(data)
    fake_count    = sum(1 for r in data if r['is_fake'])
    genuine_count = total - fake_count
    genuine_data  = [r for r in data if not r['is_fake']]

    pos = sum(1 for r in data if r['sentiment'] == 'Positive')
    neu = sum(1 for r in data if r['sentiment'] == 'Neutral')
    neg = sum(1 for r in data if r['sentiment'] == 'Negative')

    return Response({
        'reviews': data,
        'stats': {
            'total':         total,
            'fake_count':    fake_count,
            'genuine_count': genuine_count,
            'fake_pct':      round(fake_count / total * 100, 1) if total else 0,
            'avg_rating':    round(sum(r['rating'] for r in genuine_data) / len(genuine_data), 1) if genuine_data else 0,
            'positive_pct':  round(pos / total * 100, 1) if total else 0,
            'neutral_pct':   round(neu / total * 100, 1) if total else 0,
            'negative_pct':  round(neg / total * 100, 1) if total else 0,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_review(request, pk):
    try:
        product = Product.objects.get(pk=pk, is_active=True)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    rating = request.data.get('rating', 0)
    body   = request.data.get('body', '').strip()
    title  = request.data.get('title', '').strip()

    # BUG FIX: safe int conversion
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        rating = 0

    if not (1 <= rating <= 5):
        return Response({'error': 'Rating must be between 1 and 5'}, status=400)
    if not body:
        return Response({'error': 'Review body is required'}, status=400)

    fake_result = _detect_fake(
        body,
        rating=rating,
        product_id=product.id,
        user_id=request.user.id,
    )
    sentiment = _simple_sentiment(rating)

    review, created = Review.objects.update_or_create(
        user=request.user,
        product=product,
        defaults={
            'rating':           rating,
            'title':            title,
            'body':             body,
            'sentiment':        sentiment,
            'is_fake':          fake_result.get('is_fake', False),
            'fake_confidence':  float(fake_result.get('confidence', 0)),
            'fake_score':       int(fake_result.get('score', 0)),
            'fake_signals':     fake_result.get('signals', []),
        }
    )

    return Response(_serialize_review(review), status=201 if created else 200)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_review(request, pk, review_id):
    try:
        review = Review.objects.get(pk=review_id, product_id=pk, user=request.user)
        review.delete()
        return Response({'message': 'Review deleted'})
    except Review.DoesNotExist:
        return Response({'error': 'Review not found'}, status=404)


# ─────────────────────────────────────────────────────────────
# FAKE REVIEW ANALYSIS (per-product)
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def fake_review_analysis(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    reviews = list(product.reviews.select_related('user').all())
    if not reviews:
        return Response({'error': 'No reviews yet'}, status=404)

    total           = len(reviews)
    fake_reviews    = [r for r in reviews if r.is_fake]
    genuine_reviews = [r for r in reviews if not r.is_fake]

    pos = sum(1 for r in reviews if r.sentiment == 'Positive')
    neu = sum(1 for r in reviews if r.sentiment == 'Neutral')
    neg = sum(1 for r in reviews if r.sentiment == 'Negative')

    fake_confidences = [r.fake_confidence for r in fake_reviews if r.fake_confidence is not None]
    avg_fake_conf    = round(sum(fake_confidences) / len(fake_confidences), 2) if fake_confidences else 0

    return Response({
        'product_id':         pk,
        'product_name':       product.name,
        'total_reviews':      total,
        'fake_count':         len(fake_reviews),
        'genuine_count':      len(genuine_reviews),
        'fake_percentage':    round(len(fake_reviews) / total * 100, 1),
        'genuine_percentage': round(len(genuine_reviews) / total * 100, 1),
        'avg_fake_confidence': avg_fake_conf,
        'sentiment_breakdown': {
            'positive':     pos,
            'neutral':      neu,
            'negative':     neg,
            'positive_pct': round(pos / total * 100, 1),
            'neutral_pct':  round(neu / total * 100, 1),
            'negative_pct': round(neg / total * 100, 1),
        },
        'rating_distribution': {
            str(i): sum(1 for r in reviews if r.rating == i)
            for i in range(1, 6)
        },
        'flagged_reviews': [_serialize_review(r) for r in fake_reviews],
        'genuine_reviews': [_serialize_review(r) for r in genuine_reviews[:5]],
    })


# ─────────────────────────────────────────────────────────────
# MERGED REVIEWS: CSV dataset + user DB reviews
# ─────────────────────────────────────────────────────────────

def _load_csv_reviews_for_product(product: Product, limit: int = 40):
    try:
        df = pd.read_csv(REVIEWS_PATH)
        df['_full'] = (df['brand'] + ' ' + df['model']).str.lower()

        model_lower = (product.model_name or '').lower()
        brand_lower = (product.brand or '').lower()
        store_full  = f'{brand_lower} {model_lower}'
        tokens      = [t for t in model_lower.split() if len(t) > 2]

        mask = df['_full'].apply(lambda x: x in store_full)
        if not mask.any():
            mask = df['_full'].apply(lambda x: store_full in x)
        if not mask.any():
            mask = df['_full'].apply(lambda x: any(t in x for t in tokens))
        if not mask.any():
            mask = df['_full'].apply(
                lambda x: any(t in model_lower for t in x.split() if len(t) > 2)
            )
        if not mask.any():
            return []

        n    = int(mask.sum())
        rows = df[mask].sample(min(limit, n), random_state=42)

        result = []
        for idx, row in rows.iterrows():
            text       = str(row.get('review_text', ''))
            rating_val = int(row.get('rating', 3)) if row.get('rating') else 3
            fake_result = _detect_fake(text, rating=rating_val)
            result.append({
                'id':              f'csv-{row.get("review_id", idx)}',
                'source':          'dataset',
                'user':            str(row.get('customer_name', 'Anonymous')),
                'rating':          int(row.get('rating', 3)),
                'title':           '',
                'body':            text,
                'sentiment':       str(row.get('sentiment', 'Neutral')),
                'is_fake':         fake_result.get('is_fake', False),
                'fake_confidence': round(float(fake_result.get('confidence', 0)), 2),
                'fake_score':      int(fake_result.get('score', 0)),
                'fake_signals':    fake_result.get('signals', []),
                'created_at':      str(row.get('review_date', '')),
                'country':         str(row.get('country', '')),
                'verified':        bool(row.get('verified_purchase', False)),
            })
        return result
    except Exception:
        import traceback
        traceback.print_exc()
        return []


@api_view(['GET'])
@permission_classes([AllowAny])
def all_reviews(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

    limit     = int(request.GET.get('limit', 60))
    sentiment = request.GET.get('sentiment', 'all')
    show      = request.GET.get('show', 'all')

    csv_reviews = _load_csv_reviews_for_product(product, limit=limit)

    db_reviews = []
    for r in product.reviews.select_related('user').all():
        # BUG FIX: safely handle fake_signals field
        fake_signals = r.fake_signals or []
        if isinstance(fake_signals, str):
            try:
                fake_signals = json.loads(fake_signals)
            except Exception:
                fake_signals = []

        db_reviews.append({
            'id':              r.id,
            'source':          'user',
            'user':            r.user.username,
            'rating':          r.rating,
            'title':           r.title,
            'body':            r.body,
            'sentiment':       r.sentiment,
            'is_fake':         r.is_fake,
            'fake_confidence': r.fake_confidence,
            'fake_score':      r.fake_score,
            'fake_signals':    fake_signals,
            'created_at':      r.created_at.isoformat(),
            'country':         '',
            'verified':        True,
        })

    merged = db_reviews + csv_reviews

    if sentiment != 'all':
        merged = [r for r in merged if r['sentiment'] == sentiment]
    if show == 'fake':
        merged = [r for r in merged if r['is_fake']]
    elif show == 'genuine':
        merged = [r for r in merged if not r['is_fake']]

    total      = len(merged)
    fake_ct    = sum(1 for r in merged if r['is_fake'])
    genuine_ct = total - fake_ct
    pos_ct     = sum(1 for r in merged if r['sentiment'] == 'Positive')
    neu_ct     = sum(1 for r in merged if r['sentiment'] == 'Neutral')
    neg_ct     = sum(1 for r in merged if r['sentiment'] == 'Negative')

    return Response({
        'product': product.name,
        'reviews': merged,
        'stats': {
            'total':         total,
            'user_reviews':  len(db_reviews),
            'csv_reviews':   len(csv_reviews),
            'fake_count':    fake_ct,
            'genuine_count': genuine_ct,
            'fake_pct':      round(fake_ct    / total * 100, 1) if total else 0,
            'genuine_pct':   round(genuine_ct / total * 100, 1) if total else 0,
            'positive_pct':  round(pos_ct / total * 100, 1) if total else 0,
            'neutral_pct':   round(neu_ct / total * 100, 1) if total else 0,
            'negative_pct':  round(neg_ct / total * 100, 1) if total else 0,
        },
    })



