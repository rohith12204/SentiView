# Sentiview Backend Setup

## 1. Install Dependencies
```bash
cd Backend
pip install django djangorestframework django-cors-headers pandas
```

## 2. Run Migrations
```bash
cd backend
python manage.py migrate
```

## 3. Create Admin User
```bash
python manage.py createsuperuser
# Enter: username=admin, email=admin@sentiview.com, password=admin123
```

## 4. (Optional) Create token for admin via Django shell
```bash
python manage.py shell
>>> from django.contrib.auth.models import User
>>> from rest_framework.authtoken.models import Token
>>> u = User.objects.get(username='admin')
>>> Token.objects.get_or_create(user=u)
```

## 5. Start Server
```bash
python manage.py runserver
```

Server runs on: https://sentiview-api-j728.onrender.com

## API Endpoints Summary

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| /api/store/auth/register/ | POST | None | Register user |
| /api/store/auth/login/ | POST | None | Login |
| /api/store/auth/logout/ | POST | Token | Logout |
| /api/store/auth/me/ | GET | Token | Get current user |
| /api/store/products/ | GET | None | List store products |
| /api/store/admin/products/ | GET/POST | Admin | Manage products |
| /api/store/admin/products/:id/ | GET/PUT/DELETE | Admin | Edit/delete product |
| /api/store/admin/orders/ | GET | Admin | All orders |
| /api/store/admin/orders/:id/status/ | PUT | Admin | Update order status |
| /api/store/cart/ | GET | Token | View cart |
| /api/store/cart/add/ | POST | Token | Add to cart |
| /api/store/cart/:id/update/ | PUT | Token | Update quantity |
| /api/store/cart/:id/remove/ | DELETE | Token | Remove item |
| /api/store/checkout/ | POST | Token | Place order (dummy payment) |
| /api/store/orders/ | GET | Token | My orders |
| /api/analytics/products/ | GET | None | Analytics products |
| /api/analytics/search/ | GET | None | Search |
| /api/analytics/product/ | GET | None | Product details |
| /api/analytics/dashboard/ | GET | None | Dashboard metrics |
| /api/analytics/compare/ | POST | None | Compare |
| /api/analytics/sentiment-trend/ | GET | None | Trend |
| /api/analytics/fake-review/ | POST | None | Fake detection |
